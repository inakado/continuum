import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import LessonArticle from '@/components/interactive-lesson/authoring/LessonArticle';
import { LessonFormulaProvider } from '@/components/interactive-lesson/authoring/LessonEnvironment';
import styles from '@/components/interactive-lesson/authoring/lesson-theory.module.css';
import definition from './speed-definition';
import { speedEquationId } from './speed-equations';

vi.mock('./SpeedDemonstration', () => ({
  default: ({ kind }: { kind: 'average' | 'tangent' | 'path' | 'return' }) => <figure id={'kin02-' + kind + '-demo'} />,
}));

it('preserves the source structure and keeps every equation, section and demonstration reference reachable', () => {
  const html = renderToStaticMarkup(
    <LessonFormulaProvider value={(tex) => <code data-formula>{tex}</code>}>
      <LessonArticle definition={definition} />
    </LessonFormulaProvider>,
  );
  const { body } = new DOMParser().parseFromString(html, 'text/html');
  const equations = Array.from(body.querySelectorAll<HTMLElement>('[data-equation-number]'));
  expect(equations.map(node => Number(node.dataset.equationNumber))).toEqual(Array.from({ length: 23 }, (_, index) => index + 1));
  expect(equations.map(node => node.id)).toEqual(Array.from({ length: 23 }, (_, index) => 'kin02-equation-' + (index + 1)));
  const ids = Array.from(body.querySelectorAll('[id]'), node => node.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const link of body.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    expect(ids, link.outerHTML).toContain(link.getAttribute('href')!.slice(1));
  }
  expect(definition.sections).toHaveLength(8);
  for (const section of definition.sections) {
    expect(body.querySelector('#' + section.id)?.hasAttribute('data-lesson-section'), section.id).toBe(true);
  }
  expect(body.getElementsByClassName(styles.definition)).toHaveLength(5);
  expect(body.getElementsByClassName(styles.remark)).toHaveLength(6);
  expect(body.getElementsByClassName(styles.rule)).toHaveLength(2);
  expect(body.querySelectorAll('figure')).toHaveLength(4);
  const finalEquation = body.querySelector('#' + speedEquationId(23))!;
  const returnDemo = body.querySelector('#kin02-return-demo')!;
  expect(finalEquation.compareDocumentPosition(returnDemo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  for (const [number, references] of [[12, [11]], [13, [11]], [14, [11]], [20, [4, 18]], [23, [9, 21]]] as const) {
    const links = body.querySelectorAll<HTMLAnchorElement>('#' + speedEquationId(number) + ' a');
    expect(Array.from(links, link => link.getAttribute('href'))).toEqual(references.map(reference => '#' + speedEquationId(reference)));
    expect(Array.from(links, link => link.getAttribute('aria-label'))).toEqual(references.map(reference => 'По формуле ' + reference));
  }
});
