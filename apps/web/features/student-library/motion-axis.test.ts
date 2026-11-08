import { describe, expect, it } from 'vitest';
import { axisFrameAt } from './motion-axis';

const axis = { origin: [0, 20], pointer: [20, 0] } as const;
const travel = [10, 1] as const;

describe('coordinate axis projection', () => {
  it('starts the gradient at zero and joins its end to the carriage pointer', () => {
    expect(axisFrameAt(2, travel, axis)).toEqual({
      marker: [20, 22], progress: 'M0 20L20 22', projection: 'M20 0L20 22',
    });
    expect(axisFrameAt(4.5, travel, axis)).toEqual({
      marker: [45, 24.5], progress: 'M0 20L45 24.5', projection: 'M45 2.5L45 24.5',
    });
  });

  it('returns to the same geometry when time is scrubbed backwards', () => {
    const initial = axisFrameAt(2, travel, axis);
    expect(axisFrameAt(7, travel, axis).marker).toEqual([70, 27]);
    expect(axisFrameAt(2, travel, axis)).toEqual(initial);
  });
});
