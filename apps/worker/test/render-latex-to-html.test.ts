import { describe, expect, it } from 'vitest';
import { __test__ } from '../src/latex-html/render-latex-to-html';

describe('render-latex-to-html helpers', () => {
  it('extracts preamble without dropping source documentclass', () => {
    const preamble = __test__.extractPreamble(
      [
        '\\PassOptionsToPackage{dvipsnames}{xcolor}',
        '\\documentclass[14pt,a4paper,oneside]{extreport}',
        '\\usepackage{svg}',
        '\\usepackage{tikz}',
        '\\begin{document}',
        'ok',
        '\\end{document}',
      ].join('\n'),
    );

    expect(preamble).toContain('\\documentclass[14pt,a4paper,oneside]{extreport}');
    expect(preamble).not.toContain('\\usepackage{svg}');
  });

  it('keeps original documentclass in tikz standalone document when source already defines one', () => {
    const doc = __test__.buildTikzStandaloneDocument(
      [
        '\\documentclass[14pt,a4paper,oneside]{extreport}',
        '\\usepackage{tikz}',
        '\\newcounter{definition}[chapter]',
      ].join('\n'),
      '\\begin{tikzpicture}\\draw (0,0)--(1,1);\\end{tikzpicture}',
    );

    expect(doc).toContain('\\documentclass[14pt,a4paper,oneside]{extreport}');
    expect(doc).not.toContain('\\documentclass[a4paper,14pt]{extarticle}');
    expect(doc).toContain('\\newcounter{definition}[chapter]');
  });

  it('expands one-argument fig macros into raw tikz blocks', () => {
    const tex = String.raw`\documentclass{article}
\newcommand{\figDemo}[1]{%
  \resizebox{#1}{!}{%
    \begin{tikzpicture}
      \draw (0,0) -- (1,1);
    \end{tikzpicture}
  }%
}
\begin{document}
\begin{figure}
\centering
\figDemo{0.8\textwidth}
\caption{Demo}
\end{figure}
\end{document}`;

    const expanded = __test__.expandFigureMacros(tex);

    expect(expanded).not.toContain('\\newcommand{\\figDemo}');
    expect(expanded).not.toContain('\\figDemo{0.8\\textwidth}');
    expect(expanded).not.toContain('\\resizebox');
    expect(expanded).toContain('\\begin{tikzpicture}');
    expect(expanded).toContain('\\caption{Demo}');
  });

  it('injects image tags for compiled tikz placeholders', () => {
    const html = '<figure><p>CONTINUUMTIKZPLACEHOLDER0</p><figcaption>Demo</figcaption></figure>';
    const result = __test__.injectFigurePlaceholders(html, [
      {
        placeholder: 'CONTINUUMTIKZPLACEHOLDER0',
        assetKey: 'rendering/tikz/demo.svg',
        contentType: 'image/svg+xml',
      },
    ]);

    expect(result).toContain('unit-html-tikz-image');
    expect(result).toContain('src="CONTINUUMTIKZPLACEHOLDER0"');
    expect(result).toContain('<figcaption>Demo</figcaption>');
  });

  it('extracts figure and subfigure metadata from tex with tikz placeholders', () => {
    const tex = String.raw`\begin{document}
\begin{figure}[H]
  \centering
  \begin{subfigure}{0.45\textwidth}
    CONTINUUMTIKZPLACEHOLDER0
    \caption{q>0}
    \label{fig:point-field-a}
  \end{subfigure}\hfill
  \begin{subfigure}{0.45\textwidth}
    CONTINUUMTIKZPLACEHOLDER1
    \caption{q<0}
    \label{fig:point-field-b}
  \end{subfigure}
  \caption{Напряженность электростатического поля точечного заряда.}
  \label{fig:point-field}
\end{figure}
\end{document}`;

    const extracted = __test__.extractFigures(tex);

    expect(extracted.modifiedTex).toContain('CONTINUUMFIGUREPLACEHOLDER0');
    expect(extracted.figures).toHaveLength(1);
    expect(extracted.figures[0]).toMatchObject({
      label: 'fig:point-field',
      captionLatex: 'Напряженность электростатического поля точечного заряда.',
      refText: '1',
      subfigures: [
        {
          label: 'fig:point-field-a',
          captionLatex: 'q>0',
          imagePlaceholders: ['CONTINUUMTIKZPLACEHOLDER0'],
          refText: '1a',
        },
        {
          label: 'fig:point-field-b',
          captionLatex: 'q<0',
          imagePlaceholders: ['CONTINUUMTIKZPLACEHOLDER1'],
          refText: '1b',
        },
      ],
    });
  });

  it('injects figure markup and resolves numbered references', () => {
    const html = [
      '<p>На рисунке <a href="#fig:point-field" data-reference="fig:point-field">[fig:point-field]</a>',
      'и на рис.<a href="#fig:point-field-a" data-reference="fig:point-field-a">[fig:point-field-a]</a></p>',
      '<p>CONTINUUMFIGUREPLACEHOLDER0</p>',
    ].join('');

    const figures = [
      {
        placeholder: 'CONTINUUMFIGUREPLACEHOLDER0',
        label: 'fig:point-field',
        captionLatex: 'Напряженность поля.',
        imagePlaceholders: [],
        refText: '1',
        subfigures: [
          {
            label: 'fig:point-field-a',
            captionLatex: 'q>0',
            imagePlaceholders: ['CONTINUUMTIKZPLACEHOLDER0'],
            refText: '1a',
          },
          {
            label: 'fig:point-field-b',
            captionLatex: 'q<0',
            imagePlaceholders: ['CONTINUUMTIKZPLACEHOLDER1'],
            refText: '1b',
          },
        ],
      },
    ];

    const withFigures = __test__.injectExtractedFigures(html, figures);
    const withRefs = __test__.replaceFigureReferences(withFigures, figures);
    const withImages = __test__.injectFigurePlaceholders(withRefs, [
      {
        placeholder: 'CONTINUUMTIKZPLACEHOLDER0',
        assetKey: 'rendering/tikz/demo-a.svg',
        contentType: 'image/svg+xml',
      },
      {
        placeholder: 'CONTINUUMTIKZPLACEHOLDER1',
        assetKey: 'rendering/tikz/demo-b.svg',
        contentType: 'image/svg+xml',
      },
    ]);

    expect(withImages).toContain('class="unit-html-figure-group"');
    expect(withImages).toContain('class="unit-html-figure-group-grid"');
    expect(withImages).toContain('id="fig:point-field"');
    expect(withImages).toContain('id="fig:point-field-a"');
    expect(withImages).toContain('Рис. 1.');
    expect(withImages).toContain('>1</a>');
    expect(withImages).toContain('>1a</a>');
    expect(withImages).toContain('class="unit-html-tikz-image"');
    expect(withImages).toContain('src="CONTINUUMTIKZPLACEHOLDER0"');
  });

  it('versions tikz asset keys by renderer inputs and cache version', () => {
    const baseKey = __test__.buildTikzAssetKey(
      '\\usepackage{tikz}',
      '\\begin{tikzpicture}\\draw (0,0)--(1,1);\\end{tikzpicture}',
    );
    const changedPreambleKey = __test__.buildTikzAssetKey(
      '\\usepackage{tikz}\n\\usetikzlibrary{arrows.meta}',
      '\\begin{tikzpicture}\\draw (0,0)--(1,1);\\end{tikzpicture}',
    );
    const changedBlockKey = __test__.buildTikzAssetKey(
      '\\usepackage{tikz}',
      '\\begin{tikzpicture}\\draw (0,0)--(2,2);\\end{tikzpicture}',
    );

    expect(baseKey).toMatch(/^rendering\/tikz\/[a-f0-9]{32}\.svg$/);
    expect(changedPreambleKey).not.toBe(baseKey);
    expect(changedBlockKey).not.toBe(baseKey);
  });

  it('builds equation reference map and resolves \\ref/\\eqref in tex before pandoc', () => {
    const tex = String.raw`\begin{document}
\begin{equation}
\label{eq:work}
W = q\varphi
\end{equation}
Подставляя \eqref{eq:work} в \ref{eq:work}, получаем.
\end{document}`;

    const refs = __test__.buildEquationReferenceMap(tex);
    expect(refs.get('eq:work')).toBe('1');

    const resolved = __test__.resolveLatexReferencesInTex(tex, refs, refs);
    expect(resolved).toContain('Подставляя (1) в 1, получаем.');
    expect(resolved).toContain('\\tag{1}');
    expect(resolved).not.toContain('\\eqref{eq:work}');
    expect(resolved).not.toContain('\\ref{eq:work}');
    expect(resolved).not.toContain('\\label{eq:work}');
  });

  it('preserves figure refs as tokens only outside math and converts text refs to clickable anchors', () => {
    const tex = String.raw`\begin{document}
См. \ref{fig:point-field} и \autoref{fig:point-field-a}.
\[
\vec E \xrightarrow{\text{\autoref{fig:point-field-a}}} \vec E_0
\]
\end{document}`;

    const references = new Map([
      ['fig:point-field', '1'],
      ['fig:point-field-a', '1a'],
    ]);
    const resolved = __test__.resolveLatexReferencesInTex(tex, references, new Map(), {
      preserveFigureRefTokens: true,
    });
    expect(resolved).toContain('CONTINUUMFIGREF__fig:point-field__');
    expect(resolved).toContain('CONTINUUMFIGAUTOREF__fig:point-field-a__');
    expect(resolved).toContain('\\xrightarrow{\\text{рис. 1a}}');

    const html = __test__.replaceFigureReferences(`<p>${resolved}</p>`, [
      {
        placeholder: 'CONTINUUMFIGUREPLACEHOLDER0',
        label: 'fig:point-field',
        captionLatex: null,
        imagePlaceholders: [],
        refText: '1',
        subfigures: [
          {
            label: 'fig:point-field-a',
            captionLatex: null,
            imagePlaceholders: [],
            refText: '1a',
          },
        ],
      },
    ]);

    expect(html).toContain('href="#fig:point-field"');
    expect(html).toContain('href="#fig:point-field-a"');
    expect(html).toContain('data-reference="fig:point-field"');
    expect(html).toContain('data-reference="fig:point-field-a"');
    expect(html).toContain('>1</a>');
    expect(html).toContain('рис. <a href="#fig:point-field-a"');
    expect(html).toContain('\\xrightarrow{\\text{рис. 1a}}');
  });

  it('builds equation references for display math blocks with labels', () => {
    const tex = String.raw`\begin{document}
\[
W_C = \frac{q^2}{2C}.
\label{eq:energy-1}
\]
$$
W_C = \frac{qU}{2}.
\label{eq:energy-2}
$$
\end{document}`;

    const refs = __test__.buildEquationReferenceMap(tex);
    expect(refs.get('eq:energy-1')).toBe('1');
    expect(refs.get('eq:energy-2')).toBe('2');
  });

  it('replaces unresolved html reference anchors and bracket placeholders', () => {
    const html = [
      '<p><a href="#eq:work" data-reference="eq:work">[eq:work]</a></p>',
      '<p><a href="#eq:work">(???)</a></p>',
      '<p>[eq:work]</p>',
    ].join('');

    const replaced = __test__.replaceResolvedReferencesInHtml(
      html,
      new Map([['eq:work', '3']]),
    );

    expect(replaced).toContain('href="#eq:work" data-reference="eq:work">3</a>');
    expect(replaced).toContain('href="#eq:work">3</a>');
    expect(replaced).toContain('<p>3</p>');
  });
});
