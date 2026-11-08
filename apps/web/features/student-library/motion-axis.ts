import { MOTION_START } from './motion-model';

type ScreenPoint = readonly [number, number];
export type CoordinateAxis = { origin: ScreenPoint; pointer: ScreenPoint };

export function axisFrameAt(position: number, travel: ScreenPoint, axis: CoordinateAxis) {
  const marker = [axis.origin[0] + travel[0] * position, axis.origin[1] + travel[1] * position] as const;
  const offset = position - MOTION_START;
  const pointer = [axis.pointer[0] + travel[0] * offset, axis.pointer[1] + travel[1] * offset];
  return {
    marker,
    progress: `M${axis.origin[0]} ${axis.origin[1]}L${marker[0]} ${marker[1]}`,
    projection: `M${pointer[0]} ${pointer[1]}L${marker[0]} ${marker[1]}`,
  };
}
