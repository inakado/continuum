import { describe, expect, it } from 'vitest';
import { orbitGeometry } from './orbit-geometry.generated';
import { projectPoint } from './point-position-model';
import { EARTH_YEAR, MOON_MONTH, LUNAR_DISTANCE_RATIO, ORBIT_EXAGGERATION, orbitAt, orbitPath } from './orbit-model';

describe('the same Moon in two frames', () => {
  it('has a sidereal lunar month and terrestrial year, rather than one shared period', () => {
    const start = orbitAt(0), month = orbitAt(MOON_MONTH), year = orbitAt(EARTH_YEAR);
    expect(month.relativeMoon[0]).toBeCloseTo(start.relativeMoon[0]);
    expect(month.relativeMoon[1]).toBeCloseTo(start.relativeMoon[1]);
    expect(month.earth[0]).not.toBeCloseTo(start.earth[0]);
    expect(year.earth[0]).toBeCloseTo(start.earth[0]);
    expect(year.earth[1]).toBeCloseTo(start.earth[1]);
    expect(year.relativeMoon[0]).not.toBeCloseTo(start.relativeMoon[0]);
  });
  it('translates the lunar position by the Earth position in the solar frame', () => {
    for (let days = 0; days <= EARTH_YEAR; days += .5) {
      const state = orbitAt(days), scale = LUNAR_DISTANCE_RATIO * ORBIT_EXAGGERATION;
      expect(Math.hypot(...state.relativeMoon)).toBeCloseTo(1);
      expect(Math.hypot(...state.earth)).toBeCloseTo(1);
      expect(state.moon[0] - state.earth[0]).toBeCloseTo(scale * state.relativeMoon[0]);
      expect(state.moon[1] - state.earth[1]).toBeCloseTo(scale * state.relativeMoon[1]);
      const earth = projectPoint(state.earth, orbitGeometry.view), moon = projectPoint(state.moon, orbitGeometry.view);
      expect(Math.hypot(moon[0] - earth[0], moon[1] - earth[1])).toBeGreaterThan(7.1);
    }
  });
  it('ends each growing trace exactly at the current Moon, without closing the annual path', () => {
    for (const days of [0, 4.15, MOON_MONTH, 180.071, EARTH_YEAR]) {
      const state = orbitAt(days), solar = orbitPath(days, 'sun', orbitGeometry.view);
      const endpoint = projectPoint(state.moon, orbitGeometry.view).map((v) => v.toFixed(2)).join(' ');
      expect(solar.endsWith(endpoint)).toBe(true);
      expect(solar).not.toContain('Z');
      expect(solar).not.toMatch(/NaN|Infinity/);
    }
    expect(orbitPath(MOON_MONTH, 'earth', orbitGeometry.view)).toBe(orbitPath(EARTH_YEAR, 'earth', orbitGeometry.view));
  });
  it('bounds scrubbing to the demonstrated interval', () => {
    expect(orbitAt(-1)).toEqual(orbitAt(0));
    expect(orbitAt(NaN)).toEqual(orbitAt(0));
    expect(orbitAt(500)).toEqual(orbitAt(EARTH_YEAR));
  });
});
