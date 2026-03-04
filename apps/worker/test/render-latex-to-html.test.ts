import { describe, expect, it } from 'vitest';
import { __test__ } from '../src/latex-html/render-latex-to-html';

describe('render-latex-to-html helpers', () => {
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
});
