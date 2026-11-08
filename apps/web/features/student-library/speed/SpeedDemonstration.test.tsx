import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LessonFormulaProvider } from '@/components/interactive-lesson/authoring/LessonEnvironment';
import SpeedDemonstration, { type SpeedDemoKind } from './SpeedDemonstration';

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function show(kind: SpeedDemoKind) {
  return render(<LessonFormulaProvider value={tex => <span>{tex}</span>}><SpeedDemonstration kind={kind} /></LessonFormulaProvider>);
}

it('открывает среднюю скорость с согласованными интервалом/ползунком и сохраняет Δt при выборе t', () => {
  const view = show('average'), figure = view.container.querySelector('figure')!;
  const sliders = screen.getAllByRole('slider');
  expect(figure.dataset.interval).toBe('6');
  expect(Number((sliders[1] as HTMLInputElement).value)).toBeCloseTo(5.99);
  fireEvent.change(sliders[0], { target: { value: '4' } });
  expect(figure.dataset.start).toBe('4');
  expect(figure.dataset.interval).toBe('6');
});
it('в режиме сравнения сохраняет три различных конечных положения даже у нижней границы', () => {
  const view = show('tangent');
  fireEvent.click(screen.getByRole('checkbox'));
  const slider = screen.getAllByRole('slider')[1] as HTMLInputElement;
  fireEvent.change(slider, { target: { value: slider.max } });
  const groups = [...view.container.querySelectorAll('svg > g[opacity]')].filter(g => g.querySelector('circle'));
  expect(groups).toHaveLength(3);
  const ends = groups.map(g => { const c = g.querySelector('circle')!; return `${c.getAttribute('cx')},${c.getAttribute('cy')}`; });
  expect(new Set(ends).size).toBe(3);
  expect(Number(view.container.querySelector('figure')!.dataset.interval)).toBeCloseTo(.05, 10);
});
it('при малом интервале не округляет ненулевой путь до нуля', () => {
  const view = show('path');
  fireEvent.change(screen.getAllByRole('slider')[1], { target: { value: '0' } });
  expect(view.container.textContent).toContain('0,0067 м');
  fireEvent.click(screen.getByRole('checkbox'));
  expect(view.container.querySelector('figure')!.dataset.interval).toBe('0.01');
});
it('в конце возвращения показывает положительный путь и нулевую среднюю по перемещению', () => {
  const view = show('return');
  fireEvent.change(screen.getByRole('slider'), { target: { value: '12' } });
  expect(view.container.textContent).toContain('L = 10,00');
  expect(view.container.textContent).toContain('0,833');
  expect(view.container.textContent).toContain('0,000');
  expect(screen.getByRole('button', { name: /Повторить/ })).toBeInTheDocument();
});
