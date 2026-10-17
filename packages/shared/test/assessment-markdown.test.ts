import { describe, expect, it } from 'vitest';
import { parseAssessmentMarkdown } from '../src/assessment-markdown';

describe('assessment Markdown', () => {
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
