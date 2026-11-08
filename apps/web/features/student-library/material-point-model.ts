import { projectPoint, type Point2, type Point3, type PointView } from './point-position-model';

export type MaterialPointMode = 'motion' | 'aperture';
export type MaterialPointLayout = {
  restX: number; width: number; length: number; pointZ: number;
  cornerRadius: number; postCornerRadius: number;
  gateX: number; startX: number; endX: number;
  opening: { min: number; max: number; initial: number };
  worldUnitsPerMetre: number;
};

export const APERTURE_DURATION = 3.8;
const fractionOf = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const smooth = (value: number) => value * value * (3 - 2 * value);

export function openingAt(width: number, layout: MaterialPointLayout) {
  const opening = Math.min(layout.opening.max, Math.max(layout.opening.min, Number.isFinite(width) ? width : layout.opening.initial));
  const clearance = opening - layout.width;
  return { opening, clearance, fit: Math.abs(clearance) < 1e-6 ? 'exact' : clearance > 0 ? 'wide' : 'narrow' } as const;
}

export function apertureContactAt(width: number, layout: MaterialPointLayout) {
  const { opening } = openingAt(width, layout);
  const radius = layout.cornerRadius + layout.postCornerRadius;
  const across = Math.max(0, opening / 2 - layout.width / 2 + radius);
  // Minkowski sum of the two rounded rectangular plans, at carriage-bed height.
  return layout.gateX - layout.length / 2 + radius - Math.sqrt(Math.max(0, radius * radius - across * across));
}

export function aperturePassageAt(progress: number, width: number, layout: MaterialPointLayout) {
  const fraction = fractionOf(progress), aperture = openingAt(width, layout);
  const travel = layout.endX - layout.startX;
  if (aperture.fit === 'wide') return {
    center: layout.startX + travel * smooth(fraction),
    phase: fraction === 1 ? 'passed' : fraction === 0 ? 'ready' : 'passing',
    finished: fraction === 1,
  } as const;
  const contact = apertureContactAt(width, layout);
  if (aperture.fit === 'exact') return {
    center: layout.startX + (contact - layout.startX) * smooth(fraction),
    phase: fraction === 1 ? 'no-clearance' : fraction === 0 ? 'ready' : 'approaching',
    finished: fraction === 1,
  } as const;
  const impactFraction = .5 - Math.sin(Math.asin(1 - 2 * (contact - layout.startX) / travel) / 3);
  if (fraction < impactFraction) return {
    center: layout.startX + travel * smooth(fraction), phase: fraction === 0 ? 'ready' : 'approaching', finished: false,
  } as const;
  const reboundSpeed = .2 * travel * 6 * impactFraction * (1 - impactFraction) / APERTURE_DURATION;
  const deceleration = 35;
  const elapsed = (fraction - impactFraction) * APERTURE_DURATION;
  const recoilTime = Math.min(elapsed, reboundSpeed / deceleration);
  return {
    center: contact - reboundSpeed * recoilTime + deceleration * recoilTime * recoilTime / 2,
    phase: elapsed === 0 ? 'contact' : elapsed < reboundSpeed / deceleration ? 'recoiling' : 'blocked',
    finished: elapsed >= reboundSpeed / deceleration,
  } as const;
}

const pathOf = (points: readonly Point2[]) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join('');

export function materialPointFrame(mode: MaterialPointMode, progress: number, width: number, layout: MaterialPointLayout, view: PointView) {
  const aperture = openingAt(width, layout);
  const fraction = fractionOf(progress);
  const passage = mode === 'aperture' ? aperturePassageAt(fraction, width, layout) : undefined;
  const center = passage?.center ?? layout.startX + (layout.endX - layout.startX) * fraction;
  const delta = center - layout.restX;
  const translation: Point2 = [view.axes[0][0] * delta, view.axes[0][1] * delta];
  const point = projectPoint([center, 0, layout.pointZ], view);
  const start = projectPoint([layout.startX, 0, layout.pointZ], view);
  const half = aperture.opening / 2;
  const at = (x: number, y: number, z: number) => projectPoint([x, y, z], view);
  const face = (points: readonly Point3[]) => pathOf(points.map((p) => projectPoint(p, view))) + 'Z';
  const x = layout.gateX - 2, right = x + 14;
  const far = -half - 8, near = half + 8;
  return {
    ...aperture, center, passage, translation, point,
    trail: pathOf([start, point]),
    postShift: [(aperture.opening - layout.opening.initial) * view.axes[1][0] / 2, (aperture.opening - layout.opening.initial) * view.axes[1][1] / 2] as Point2,
    beam: {
      top: face([[x, far, 118], [right, far, 118], [right, near, 118], [x, near, 118]]),
      side: face([[right, far, 110], [right, near, 110], [right, near, 118], [right, far, 118]]),
      front: face([[x, near, 110], [right, near, 110], [right, near, 118], [x, near, 118]]),
    },
    // Both end faces lie on the actual inner edges of the posts.
    openingLine: pathOf([at(layout.gateX + 15, -half, 23), at(layout.gateX + 15, half, 23)]),
  };
}

export function materialPointCaption(mode: MaterialPointMode, width: number, layout: MaterialPointLayout, progress = 0) {
  if (mode === 'motion') return 'Для описания перемещения достаточно точки.';
  const aperture = openingAt(width, layout);
  const body = (layout.width / layout.worldUnitsPerMetre).toFixed(2).replace('.', ',');
  const passage = aperturePassageAt(progress, width, layout);
  if (passage.phase === 'recoiling' || passage.phase === 'contact') return 'Не проходит: каретка упёрлась и откатывается.';
  if (passage.phase === 'blocked') return 'Не проходит: каретка упёрлась в стойки.';
  if (passage.phase === 'passed') return '';
  return aperture.fit === 'narrow' ? `Каретка шириной ${body} м не поместится: нужны габариты.`
    : aperture.fit === 'exact' ? `Ширины равны — ${body} м. Зазора нет.`
      : `Каретка шириной ${body} м помещается. Размеры учтены.`;
}
