import { describe, expect, it } from 'vitest';
import { motionAt } from './motion-model';

describe('mechanical motion demonstration', () => {
  it('moves uniformly relative to the fixed zero', () => {
    expect(motionAt(0)).toEqual({ time: 0, position: 2, finished: false });
    expect(motionAt(3)).toEqual({ time: 3, position: 4.5, finished: false });
    expect(motionAt(6)).toEqual({ time: 6, position: 7, finished: true });
  });

  it('stops at the end of the rail without wrapping or accepting invalid time', () => {
    expect(motionAt(20)).toEqual(motionAt(6));
    for (const time of [-1, NaN, Infinity]) expect(motionAt(time)).toEqual(motionAt(0));
  });
});
