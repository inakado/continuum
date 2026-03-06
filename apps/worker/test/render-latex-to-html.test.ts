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

  it('extracts body declarations and injects them into tikz standalone document', () => {
    const tex = String.raw`\documentclass{article}
\usepackage{tikz}
\begin{document}
\def\R{2}
\pgfmathsetmacro{\H}{3}
\begin{tikzpicture}
\draw (\R,0) -- (0,\H);
\end{tikzpicture}
\end{document}`;

    const declarations = __test__.extractBodyTikzDeclarations(tex);

    expect(declarations).toContain('\\def\\R{2}');
    expect(declarations).toContain('\\pgfmathsetmacro{\\H}{3}');

    const doc = __test__.buildTikzStandaloneDocument(
      __test__.extractPreamble(tex),
      '\\begin{tikzpicture}\\draw (\\R,0)--(0,\\H);\\end{tikzpicture}',
      declarations,
    );

    expect(doc).toContain('\\def\\R{2}');
    expect(doc).toContain('\\pgfmathsetmacro{\\H}{3}');
    expect(doc.indexOf('\\def\\R{2}')).toBeLessThan(doc.indexOf('\\begin{tikzpicture}'));
  });

  it('extracts starred newcommand declarations from document body', () => {
    const tex = String.raw`\documentclass{article}
\usepackage{tikz}
\begin{document}
\newcommand*{\R}{2}
\begin{tikzpicture}
\draw (\R,0) -- (1,1);
\end{tikzpicture}
\end{document}`;

    const declarations = __test__.extractBodyTikzDeclarations(tex);
    expect(declarations).toContain('\\newcommand*{\\R}{2}');
  });

  it('extracts pgfmathsetmacro declarations when macro arg is passed without braces', () => {
    const tex = String.raw`\documentclass{article}
\usepackage{tikz}
\begin{document}
\pgfmathsetmacro\R{2}
\begin{tikzpicture}
\draw (\R,0) -- (1,1);
\end{tikzpicture}
\end{document}`;

    const declarations = __test__.extractBodyTikzDeclarations(tex);
    expect(declarations).toContain('\\pgfmathsetmacro\\R{2}');
  });

  it('extracts delimited def declarations from document body', () => {
    const tex = String.raw`\documentclass{article}
\usepackage{tikz}
\begin{document}
\def\alpha0{-180}
\begin{tikzpicture}
\pgfmathsetmacro{\ang}{\alpha0 + 1}
\draw (0,0) -- (1,1);
\end{tikzpicture}
\end{document}`;

    const declarations = __test__.extractBodyTikzDeclarations(tex);
    expect(declarations).toContain('\\def\\alpha0{-180}');
  });

  it('does not extract executable pgfmath declarations from inside tikz blocks', () => {
    const tex = String.raw`\documentclass{article}
\usepackage{tikz}
\begin{document}
\begin{tikzpicture}
\def\alpha0{-180}
\def\spread{30}
\pgfmathsetmacro{\ang}{\alpha0 + \spread*(2*rnd-1)}
\draw (0,0) -- (1,1);
\end{tikzpicture}
\end{document}`;

    const declarations = __test__.extractBodyTikzDeclarations(tex);
    expect(declarations).toBe('');
  });

  it('extracts inline declarations before tikz block inside macro definitions', () => {
    const tex = String.raw`\documentclass{article}
\newcommand{\TikzGraphField}{%
\begingroup
\def\R{2}
\def\A{8}
\begin{tikzpicture}
\draw (\R,0) -- (1,1);
\end{tikzpicture}
\endgroup
}
\begin{document}
\TikzGraphField
\end{document}`;

    const extracted = __test__.extractTikzBlocks(tex);
    expect(extracted.blocks).toHaveLength(1);
    expect(extracted.blocks[0]?.localDeclarations).toContain('\\def\\R{2}');
    expect(extracted.blocks[0]?.localDeclarations).toContain('\\def\\A{8}');
  });

  it('does not extract partial multiline tikzset as inline declaration', () => {
    const tex = String.raw`\documentclass{article}
\newcommand{\TikzGraphField}{%
\begingroup
\tikzset{
  myarrow/.style={-{Latex}}
}
\def\R{2}
\begin{tikzpicture}
\draw[myarrow] (\R,0) -- (1,1);
\end{tikzpicture}
\endgroup
}
\begin{document}
\TikzGraphField
\end{document}`;

    const extracted = __test__.extractTikzBlocks(tex);
    expect(extracted.blocks).toHaveLength(1);
    expect(extracted.blocks[0]?.localDeclarations).toContain('\\def\\R{2}');
    expect(extracted.blocks[0]?.localDeclarations).not.toContain('\\tikzset{');
  });

  it('keeps numeric suffix control-sequences unchanged', () => {
    const normalized = __test__.normalizeNumericSuffixControlSequences(
      '\\def\\alpha0{-180}\n\\def\\spread{30}',
      '\\pgfmathsetmacro{\\ang}{\\alpha0 + \\spread*(2*rnd-1)}',
    );

    expect(normalized.declarations).toContain('\\def\\alpha0{-180}');
    expect(normalized.block).toContain('\\alpha0 + \\spread*(2*rnd-1)');
  });

  it('keeps numeric suffix control-sequences declared inside tikz block unchanged', () => {
    const normalized = __test__.normalizeNumericSuffixControlSequences(
      '',
      '\\def\\alpha0{-180}\n\\pgfmathsetmacro{\\ang}{\\alpha0 + 1}',
    );

    expect(normalized.block).toContain('\\def\\alpha0{-180}');
    expect(normalized.block).toContain('\\alpha0 + 1');
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

  it('expands zero-argument Tikz macros declared via newcommand', () => {
    const tex = String.raw`\documentclass{article}
\newcommand{\TikzDemo}{%
\begin{tikzpicture}
  \draw (0,0) -- (1,1);
\end{tikzpicture}
}
\begin{document}
\begin{figure}
\centering
\resizebox{0.8\textwidth}{!}{\TikzDemo}
\caption{Demo}
\end{figure}
\end{document}`;

    const expanded = __test__.expandFigureMacros(tex);

    expect(expanded).not.toContain('\\newcommand{\\TikzDemo}');
    expect(expanded).not.toContain('\\TikzDemo');
    expect(expanded).toContain('\\begin{tikzpicture}');
    expect(expanded).toContain('\\caption{Demo}');
  });

  it('keeps resizebox argument balanced when expanded macro body ends with percent', () => {
    const tex = String.raw`\documentclass{article}
\newcommand{\TikzDemo}{%
\begin{tikzpicture}
  \draw (0,0) -- (1,1);
\end{tikzpicture}%
}
\begin{document}
\resizebox{0.8\textwidth}{!}{\TikzDemo}
\end{document}`;

    const expanded = __test__.expandFigureMacros(tex);
    expect(expanded).toContain('\\resizebox{0.8\\textwidth}{!}{\\begin{tikzpicture}');
    expect(expanded).toContain('\\end{tikzpicture}%\n}');
  });

  it('unwraps resizebox wrappers around tikz blocks so placeholder extraction remains stable', () => {
    const tex = String.raw`\documentclass{article}
\begin{document}
\resizebox{\linewidth}{!}{\begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}}
\end{document}`;

    const unwrapped = __test__.unwrapResizeboxAroundTikzBlocks(tex);
    const extracted = __test__.extractTikzBlocks(unwrapped);

    expect(unwrapped).not.toContain('\\resizebox{\\linewidth}{!}{');
    expect(extracted.blocks).toHaveLength(1);
    expect(extracted.modifiedTex).toContain('CONTINUUMTIKZPLACEHOLDER0');
  });

  it('normalizes siunitx commands for mathjax compatibility in html pipeline', () => {
    const normalized = __test__.normalizeSiunitxForMathJax(
      String.raw`[\varepsilon]=\si{1},\quad U=\SI{220}{V},\quad N=\num{1,5}`,
    );

    expect(normalized).toContain('[\\varepsilon]=1');
    expect(normalized).toContain('U=220\\,\\mathrm{V}');
    expect(normalized).toContain('N=1,5');
  });

  it('normalizes mhchem formulas for mathjax compatibility in html pipeline', () => {
    const normalized = __test__.normalizeMhchemForMathJax(
      String.raw`вода \ce{H2O}, аммиак \ce{NH3}, хлороводород \ce{HCl}, этанол \ce{C2H5OH}, ионы \ce{Na+} и \ce{Cl-}`,
    );

    expect(normalized).toContain(String.raw`\(\mathrm{H_{2}O}\)`);
    expect(normalized).toContain(String.raw`\(\mathrm{NH_{3}}\)`);
    expect(normalized).toContain(String.raw`\(\mathrm{HCl}\)`);
    expect(normalized).toContain(String.raw`\(\mathrm{C_{2}H_{5}OH}\)`);
    expect(normalized).toContain(String.raw`\(\mathrm{Na^{+}}\)`);
    expect(normalized).toContain(String.raw`\(\mathrm{Cl^{-}}\)`);
  });

  it('extracts and injects \\name headings as dedicated html title blocks', () => {
    const tex = String.raw`\documentclass{article}
\newcommand{\name}[1]{\begin{center}#1\end{center}}
\begin{document}
\name{Электростатическое поле в веществе}
Текст.
\end{document}`;

    const extracted = __test__.extractNameHeadings(tex);
    expect(extracted.headings).toEqual([
      {
        placeholder: 'CONTINUUMTITLEPLACEHOLDER0',
        titleLatex: 'Электростатическое поле в веществе',
      },
    ]);
    expect(extracted.modifiedTex).toContain('CONTINUUMTITLEPLACEHOLDER0');

    const html = __test__.injectNameHeadings('<p>CONTINUUMTITLEPLACEHOLDER0</p>', extracted.headings);
    expect(html).toContain('<h1 class="unit-html-title">Электростатическое поле в веществе</h1>');
  });

  it('keeps subfigure tikz placeholders after macro expansion and resizebox unwrapping', () => {
    const tex = String.raw`\documentclass{article}
\newcommand{\TikzAtomNoField}{%
\begin{tikzpicture}
\draw (0,0) -- (1,1);
\end{tikzpicture}%
}
\begin{document}
\begin{figure}[H]
  \centering
  \begin{subfigure}{0.45\textwidth}
    \resizebox{\linewidth}{!}{\TikzAtomNoField}
    \caption{A}
    \label{fig:a}
  \end{subfigure}
  \caption{Demo}
  \label{fig:demo}
\end{figure}
\end{document}`;

    const expanded = __test__.expandFigureMacros(tex);
    const unwrapped = __test__.unwrapResizeboxAroundTikzBlocks(expanded);
    const withTikzPlaceholders = __test__.extractTikzBlocks(unwrapped);
    const withFigurePlaceholders = __test__.extractFigures(withTikzPlaceholders.modifiedTex);

    expect(withTikzPlaceholders.blocks).toHaveLength(1);
    expect(withFigurePlaceholders.figures).toHaveLength(1);
    expect(withFigurePlaceholders.figures[0]?.subfigures[0]?.imagePlaceholders).toEqual([
      'CONTINUUMTIKZPLACEHOLDER0',
    ]);
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

  it('extracts wrapfigure as numbered figure with caption, label and image placeholder', () => {
    const tex = String.raw`\begin{document}
\begin{wrapfigure}{r}{0.38\textwidth}
  CONTINUUMTIKZPLACEHOLDER7
  \caption{Электрический диполь}
  \label{fig:pol-diel}
\end{wrapfigure}
\end{document}`;

    const extracted = __test__.extractFigures(tex);

    expect(extracted.modifiedTex).toContain('CONTINUUMFIGUREPLACEHOLDER0');
    expect(extracted.modifiedTex).not.toContain('{r}{0.38\\textwidth}');
    expect(extracted.figures).toHaveLength(1);
    expect(extracted.figures[0]).toMatchObject({
      label: 'fig:pol-diel',
      captionLatex: 'Электрический диполь',
      imagePlaceholders: ['CONTINUUMTIKZPLACEHOLDER7'],
      refText: '1',
    });
  });

  it('resolves wrapfigure references into numbered links', () => {
    const figures = [
      {
        placeholder: 'CONTINUUMFIGUREPLACEHOLDER0',
        label: 'fig:pol-diel',
        captionLatex: 'Электрический диполь',
        imagePlaceholders: ['CONTINUUMTIKZPLACEHOLDER7'],
        subfigures: [],
        refText: '7',
      },
    ];

    const html = __test__.replaceFigureReferences('<p>[fig:pol-diel]</p>', figures);
    const withFigure = __test__.injectExtractedFigures(
      '<p>CONTINUUMFIGUREPLACEHOLDER0</p>',
      figures,
    );

    expect(html).toContain('href="#fig:pol-diel"');
    expect(html).toContain('>7</a>');
    expect(withFigure).toContain('id="fig:pol-diel"');
    expect(withFigure).toContain('Рис. 7.');
    expect(withFigure).toContain('Электрический диполь');
    expect(withFigure).toContain('src="CONTINUUMTIKZPLACEHOLDER7"');
  });

  it('keeps three consecutive dipole figures (wrapfigure + figure + figure) after macro expansion', () => {
    const tex = String.raw`\documentclass{article}
\newcommand{\TikzPolDiel}{%
\begin{tikzpicture}
  \draw (0,0) -- (1,0);
\end{tikzpicture}%
}
\newcommand{\TikzPolDielNoField}{%
\begingroup
\begin{tikzpicture}
  \draw (0,0) -- (1,1);
\end{tikzpicture}
\endgroup%
}
\newcommand{\TikzPolDielField}{%
\begingroup
\begin{tikzpicture}
  \draw (0,0) -- (1,-1);
\end{tikzpicture}
\endgroup%
}
\begin{document}
\begin{wrapfigure}{r}{0.38\textwidth}
  \resizebox{0.65\linewidth}{!}{\TikzPolDiel}
  \caption{Электрический диполь}
  \label{fig:pol-diel}
\end{wrapfigure}

\begin{figure}
  \centering
  \resizebox{0.72\textwidth}{!}{\TikzPolDielNoField}
  \caption{Случайная ориентация}
  \label{fig:pol-diel-nofield}
\end{figure}

\begin{figure}
  \centering
  \resizebox{0.9\textwidth}{!}{\TikzPolDielField}
  \caption{Ориентация во внешнем поле}
  \label{fig:pol-diel-field}
\end{figure}
\end{document}`;

    const expanded = __test__.expandFigureMacros(tex);
    const unwrapped = __test__.unwrapResizeboxAroundTikzBlocks(expanded);
    const withTikzPlaceholders = __test__.extractTikzBlocks(unwrapped);
    const withFigurePlaceholders = __test__.extractFigures(withTikzPlaceholders.modifiedTex);

    expect(withTikzPlaceholders.blocks).toHaveLength(3);
    expect(withFigurePlaceholders.modifiedTex).not.toContain('{r}{0.38\\textwidth}');
    expect(withFigurePlaceholders.figures).toHaveLength(3);
    expect(withFigurePlaceholders.figures.map((figure) => figure.label)).toEqual([
      'fig:pol-diel',
      'fig:pol-diel-nofield',
      'fig:pol-diel-field',
    ]);
    expect(withFigurePlaceholders.figures.map((figure) => figure.imagePlaceholders)).toEqual([
      ['CONTINUUMTIKZPLACEHOLDER0'],
      ['CONTINUUMTIKZPLACEHOLDER1'],
      ['CONTINUUMTIKZPLACEHOLDER2'],
    ]);
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

  it('normalizes latex dash markers in figure captions outside math', () => {
    const withFigures = __test__.injectExtractedFigures('<p>CONTINUUMFIGUREPLACEHOLDER0</p>', [
      {
        placeholder: 'CONTINUUMFIGUREPLACEHOLDER0',
        label: 'fig:dash',
        captionLatex: String.raw`$\vec E_+$ --- поле -- вакуум`,
        imagePlaceholders: ['CONTINUUMTIKZPLACEHOLDER0'],
        refText: '9',
        subfigures: [],
      },
    ]);

    expect(withFigures).toContain('Рис. 9.');
    expect(withFigures).toContain('$\\vec E_+$');
    expect(withFigures).toContain('— поле – вакуум');
    expect(withFigures).not.toContain('---');
    expect(withFigures).not.toContain(' -- ');
  });

  it('versions tikz asset keys by renderer inputs and cache version', () => {
    const baseKey = __test__.buildTikzAssetKey(
      '\\usepackage{tikz}',
      '\\begin{tikzpicture}\\draw (0,0)--(1,1);\\end{tikzpicture}',
      '\\def\\R{2}',
    );
    const changedPreambleKey = __test__.buildTikzAssetKey(
      '\\usepackage{tikz}\n\\usetikzlibrary{arrows.meta}',
      '\\begin{tikzpicture}\\draw (0,0)--(1,1);\\end{tikzpicture}',
      '\\def\\R{2}',
    );
    const changedBlockKey = __test__.buildTikzAssetKey(
      '\\usepackage{tikz}',
      '\\begin{tikzpicture}\\draw (0,0)--(2,2);\\end{tikzpicture}',
      '\\def\\R{2}',
    );
    const changedBodyDeclarationsKey = __test__.buildTikzAssetKey(
      '\\usepackage{tikz}',
      '\\begin{tikzpicture}\\draw (0,0)--(1,1);\\end{tikzpicture}',
      '\\def\\R{3}',
    );

    expect(baseKey).toMatch(/^rendering\/tikz\/[a-f0-9]{32}\.svg$/);
    expect(changedPreambleKey).not.toBe(baseKey);
    expect(changedBlockKey).not.toBe(baseKey);
    expect(changedBodyDeclarationsKey).not.toBe(baseKey);
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

  it('builds table reference map and resolves table refs in tex', () => {
    const tex = String.raw`\begin{document}
В таблице \ref{tab:epsilon} приведены данные.
См. \autoref{tab:epsilon}.
\begin{table}[H]
\caption{Диэлектрическая проницаемость}
\label{tab:epsilon}
\begin{tabular}{lc}
A & B \\
\end{tabular}
\end{table}
\end{document}`;

    const tableRefs = __test__.buildTableReferenceMap(tex);
    expect(tableRefs.get('tab:epsilon')).toBe('1');

    const resolved = __test__.resolveLatexReferencesInTex(tex, tableRefs, new Map());
    expect(resolved).toContain('В таблице 1 приведены данные.');
    expect(resolved).toContain('См. табл. 1.');
  });

  it('injects russian numbered table caption prefix in html output', () => {
    const html = [
      '<p>См. <a href="#tab:epsilon" data-reference="tab:epsilon">[tab:epsilon]</a>.</p>',
      '<table id="tab:epsilon">',
      '<caption>Диэлектрическая проницаемость некоторых веществ</caption>',
      '<tbody><tr><td>Вода</td><td>81</td></tr></tbody>',
      '</table>',
    ].join('');

    const withCaptions = __test__.injectTableCaptionNumbers(
      html,
      new Map([['tab:epsilon', '1']]),
    );
    const withRefs = __test__.replaceResolvedReferencesInHtml(
      withCaptions,
      new Map([['tab:epsilon', '1']]),
    );

    expect(withCaptions).toContain('class="unit-html-table-number">Таблица 1. </span>');
    expect(withCaptions).toContain('Диэлектрическая проницаемость некоторых веществ');
    expect(withRefs).toContain('href="#tab:epsilon" data-reference="tab:epsilon">1</a>');
  });
});
