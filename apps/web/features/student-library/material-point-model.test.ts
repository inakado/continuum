import { describe, expect, it } from 'vitest';
import { apertureContactAt, aperturePassageAt, materialPointCaption, materialPointFrame, openingAt, type MaterialPointLayout } from './material-point-model';

const layout: MaterialPointLayout = { restX: 108, width: 72, length: 72, pointZ: 71.4, cornerRadius: 5, postCornerRadius: 1, gateX: 360, startX: 145, endX: 460, opening: { min: 56, max: 84, initial: 64 }, worldUnitsPerMetre: 60 };
const view = { origin: [0, 0], axes: [[1, .2], [-.3, .5], [0, -1]] } as const;

describe('task-dependent material point model', () => {
  it('keeps point and carriage together throughout translation', () => {
    const a = materialPointFrame('motion', 0, 64, layout, view);
    const b = materialPointFrame('motion', 1, 64, layout, view);
    expect(b.point[0] - a.point[0]).toBeCloseTo(b.translation[0] - a.translation[0]);
    expect(b.point[1] - a.point[1]).toBeCloseTo(b.translation[1] - a.translation[1]);
    expect(b.translation).toEqual([352, 70.4]);
  });

  it('uses the full body width, with an explicit zero-clearance case', () => {
    expect(openingAt(64, layout)).toMatchObject({ clearance: -8, fit: 'narrow' });
    expect(openingAt(72, layout)).toMatchObject({ clearance: 0, fit: 'exact' });
    expect(openingAt(84, layout)).toMatchObject({ clearance: 12, fit: 'wide' });
  });

  it('changes the opening without changing body size or its initial position', () => {
    const a = materialPointFrame('aperture', 0, 56, layout, view);
    const b = materialPointFrame('aperture', 0, 84, layout, view);
    expect(a.point).toEqual(b.point);
    expect(a.translation).toEqual(b.translation);
    expect(a.beam.top).not.toEqual(b.beam.top);
    expect(a.center).toBe(layout.startX);
    expect(a.openingLine).not.toEqual(b.openingLine);
    expect(openingAt(NaN, layout).opening).toBe(64);
  });

  it('fully passes through a wider opening and remains on the track', () => {
    const end = aperturePassageAt(1, 84, layout);
    expect(end).toMatchObject({ phase: 'passed', finished: true });
    expect(end.center - layout.length / 2).toBeGreaterThan(layout.gateX + 10);
    expect(end.center + layout.length / 2).toBeLessThan(514);
    expect(materialPointCaption('aperture', 84, layout, 1)).toBe('');
  });

  it('contacts rounded posts once, recoils, and never penetrates the opening', () => {
    for (const width of [56, 64, 71]) {
      const contact = apertureContactAt(width, layout), phases = new Set<string>();
      let peak = layout.startX;
      for (let step = 0; step <= 1000; step++) {
        const state = aperturePassageAt(step / 1000, width, layout);
        expect(state.center).toBeLessThanOrEqual(contact + 1e-9);
        expect(Number.isFinite(state.center)).toBe(true);
        // Independently check separation of the actual 72×72 carriage and 10×8 post plans.
        const dx = Math.max(0, layout.gateX + 5 - state.center - (layout.length / 2 - layout.cornerRadius + 5 - layout.postCornerRadius));
        const dy = Math.max(0, width / 2 + 4 - (layout.width / 2 - layout.cornerRadius + 4 - layout.postCornerRadius));
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(layout.cornerRadius + layout.postCornerRadius - 1e-9);
        peak = Math.max(peak, state.center); phases.add(state.phase);
      }
      expect(peak).toBeGreaterThan(contact - .15);
      expect(phases.has('recoiling')).toBe(true);
      const end = aperturePassageAt(1, width, layout);
      expect(end).toMatchObject({ phase: 'blocked', finished: true });
      expect(end.center).toBeLessThan(peak - 5);
    }
  });

  it('handles zero clearance as a calm stop without a fabricated bounce', () => {
    let previous = layout.startX;
    for (let step = 0; step <= 100; step++) {
      const state = aperturePassageAt(step / 100, 72, layout);
      expect(state.center).toBeGreaterThanOrEqual(previous);
      expect(state.center).toBeLessThanOrEqual(apertureContactAt(72, layout));
      previous = state.center;
    }
    expect(aperturePassageAt(1, 72, layout)).toMatchObject({ phase: 'no-clearance', finished: true });
    expect(aperturePassageAt(NaN, 64, layout).center).toBe(layout.startX);
  });
});
