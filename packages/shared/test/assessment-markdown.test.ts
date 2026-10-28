import { describe, expect, it } from 'vitest';
import { parseAssessmentMarkdown } from '../src/assessment-markdown';

describe('assessment Markdown', () => {
  it('renders legacy TeX prose dashes without changing math, identifiers, ranges or escaped hyphens', () => {
    expect(parseAssessmentMarkdown('$x$ --- в метрах; $a---b$; 1--2; source---id; \\-\\-\\-.')).toEqual([
      { kind: 'element', tag: 'p', children: [
        { kind: 'math', value: 'x', display: false }, { kind: 'text', value: ' — в метрах; ' },
        { kind: 'math', value: 'a---b', display: false }, { kind: 'text', value: '; 1--2; source---id; ' },
        { kind: 'text', value: '-' }, { kind: 'text', value: '-' }, { kind: 'text', value: '-' }, { kind: 'text', value: '.' },
      ] },
    ]);
  });
  it('preserves all formulas and prose in the real Shkolkovo 16656 statement', () => {
    const source = 'Координата тела $x$ изменяется с течением времени $t$ согласно закону $$x = 18 + 32t - 6t^2,$$ где $t$ выражено в секундах, а $x$ --- в метрах. Определите проекцию ускорения $a_x$ этого тела. Ответ дайте в м/с$^2$.';
    const nodes = parseAssessmentMarkdown(source);
    const children = nodes.flatMap((node) => node.kind === 'element' ? node.children : [node]);
    expect(children.filter((node) => node.kind === 'math')).toEqual([
      { kind: 'math', value: 'x', display: false },
      { kind: 'math', value: 't', display: false },
      { kind: 'math', value: 'x = 18 + 32t - 6t^2,', display: true },
      { kind: 'math', value: 't', display: false },
      { kind: 'math', value: 'x', display: false },
      { kind: 'math', value: 'a_x', display: false },
      { kind: 'math', value: '^2', display: false },
    ]);
    expect(children.filter((node) => node.kind === 'text').map((node) => node.value).join('')).toContain(' выражено в секундах, а ');
  });
  it.each(['До $$x^2$$ после $t$.', '$$x^2$$ после $t$.'])('keeps display math inside prose: %s', (source) => {
    const json = JSON.stringify(parseAssessmentMarkdown(source));
    expect(json).toContain('"display":true');
    expect(json).toContain('"value":"t","display":false');
    expect(json).toContain(' после ');
  });
  it('keeps multiline display formulas in their own block', () => {
    expect(parseAssessmentMarkdown('До.\n\n$$x^2\n+ y^2$$\n\nПосле.')[1]).toEqual({ kind: 'math', value: 'x^2\n+ y^2', display: true });
  });
  it.each(['Формула $x', 'Формула $$x$', 'Формула $x$$', '$$$x$$$', 'До $$x^2$$ после $t', '$x\ny$'])('rejects unbalanced math delimiters: %s', (source) => {
    expect(() => parseAssessmentMarkdown(source)).toThrow(/формул/);
  });
  it('allows an escaped literal dollar sign', () => {
    expect(JSON.stringify(parseAssessmentMarkdown('Цена 5\\$.'))).toContain('$');
  });
  it('preserves column alignment for every header and body cell', () => {
    const [table] = parseAssessmentMarkdown('| A | B | C |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |');
    if (table.kind !== 'element') throw new Error('Expected a table');
    for (const group of table.children) {
      if (group.kind !== 'element') throw new Error('Expected a table group');
      const row = group.children[0];
      if (row.kind !== 'element') throw new Error('Expected a row');
      expect(row.children.map((cell) => cell.kind === 'element' ? cell.align : null)).toEqual(['left', 'center', 'right']);
    }
  });
  it('keeps TeX intact and renders tables and local images as typed nodes', () => {
    const nodes = parseAssessmentMarkdown('Найдите $\\frac{p_1}{p_2}$.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n![График](images/graph.png)');
    const json = JSON.stringify(nodes);
    expect(json).toContain('\\\\frac{p_1}{p_2}');
    expect(json).toContain('table');
    expect(json).toContain('images/graph.png');
  });
  it.each(['<img src=x onerror=alert(1)>', '![x](https://evil.test/x.png)', '![x](../image.png)', '$\\require{html}$', '[x](javascript:alert(1))'])('rejects unsafe input %s', (input) => {
    expect(() => parseAssessmentMarkdown(input)).toThrow();
  });
});
