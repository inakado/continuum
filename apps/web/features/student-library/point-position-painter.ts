import { pointFrame, pointNumber, type Point3, type PointView } from './point-position-model';
import { placeAngleLabels, type LabelBox } from './point-angle-labels';
import type { Point2 } from './point-position-model';

export function createPointPainter(root: HTMLElement, view: PointView, width: number, height: number) {
  const svg = root.querySelector('svg')!;
  const handle = root.querySelector<HTMLElement>('[data-point-handle]')!;
  const axisHandles = [...root.querySelectorAll<HTMLElement>('[data-point-axis]')];
  const radiusLabel = root.querySelector<HTMLElement>('[data-vector-label]');
  const hint = root.querySelector<HTMLElement>('[data-point-hint]');
  const paths = new Map([...root.querySelectorAll<SVGPathElement>('[data-point-path]')].map((node) => [node.dataset.pointPath!, node]));
  const values = new Map([...root.querySelectorAll<HTMLOutputElement>('[data-point-value]')].map((node) => [node.dataset.pointValue!, node]));
  const feet = [...root.querySelectorAll<SVGCircleElement>('[data-point-foot]')];
  const angleLabels = [...root.querySelectorAll<HTMLElement>('[data-angle-label]')];
  const angleObstacles = [...root.querySelectorAll<HTMLElement>('[data-angle-obstacle]')];
  return (point: Point3) => {
    const scale = svg.getBoundingClientRect().width / width || 1;
    const frame = pointFrame(point, view, scale);
    const fields: Record<string, string> = {
      plane: frame.plane, projections: frame.projections, vector: frame.vector, arrow: frame.arrow,
      x: frame.coordinatePaths[0], y: frame.coordinatePaths[1], z: frame.coordinatePaths[2],
      arc0: frame.arcs[0], arc1: frame.arcs[1], arc2: frame.arcs[2],
    };
    for (const [key, value] of Object.entries(fields)) paths.get(key)?.setAttribute('d', value);
    feet.forEach((node, i) => {
      node.setAttribute('cx', String(frame.feet[i][0]));
      node.setAttribute('cy', String(frame.feet[i][1]));
      node.setAttribute('r', String(3 / scale));
    });
    handle.style.left = `${100 * frame.point[0] / width}%`;
    handle.style.top = `${100 * frame.point[1] / height}%`;
    ['x', 'y', 'z'].forEach((key, i) => { const node = values.get(key); if (node) node.textContent = pointNumber(point[i]); });
    frame.angles.forEach((angle, i) => { const node = values.get(`angle${i}`); if (node) node.textContent = angle === null ? '—' : `${angle.toFixed(1).replace('.', ',')}°`; });
    const length = values.get('length');
    if (length) length.textContent = pointNumber(frame.length);
    axisHandles.forEach((node, i) => {
      node.style.left = `${100 * frame.feet[i][0] / width}%`;
      node.style.top = `${100 * frame.feet[i][1] / height}%`;
      node.setAttribute('aria-valuenow', String(point[i]));
      node.setAttribute('aria-valuetext', `${pointNumber(point[i])} м`);
    });
    if (radiusLabel) {
      radiusLabel.hidden = frame.arrow === '';
      radiusLabel.style.left = `${100 * frame.vectorLabel[0] / width}%`;
      radiusLabel.style.top = `${100 * frame.vectorLabel[1] / height}%`;
    }
    if (angleLabels.length) {
      const rect = svg.getBoundingClientRect();
      const obstacles: LabelBox[] = angleObstacles.filter((node) => !node.hidden).map((node) => {
        const box = node.getBoundingClientRect();
        return { x: (box.x - rect.x) / scale - 3, y: (box.y - rect.y) / scale - 5, width: box.width / scale + 6, height: box.height / scale + 8 };
      });
      for (const [x, y] of [frame.point, ...frame.feet]) obstacles.push({ x: x - 7 / scale, y: y - 7 / scale, width: 14 / scale, height: 14 / scale });
      const sizes = angleLabels.map((node): Point2 => {
        node.hidden = false;
        const box = node.getBoundingClientRect();
        return [box.width / scale, box.height / scale];
      });
      const segments: [Point2, Point2][] = view.axes.map(([x, y]) => [view.origin, [view.origin[0] + x * 6.3, view.origin[1] + y * 6.3]]);
      if (frame.length) segments.push([view.origin, frame.point]);
      for (const curve of frame.angleCurves) for (let i = 1; i < curve.length; i++) segments.push([curve[i - 1], curve[i]]);
      const positions = placeAngleLabels(frame.angleCurves, view.origin, segments, obstacles, sizes, [width, height], scale);
      angleLabels.forEach((node, i) => {
        const label = positions[i];
        node.hidden = !label;
        if (label) {
          node.style.left = `${100 * label.point[0] / width}%`; node.style.top = `${100 * label.point[1] / height}%`;
          node.style.opacity = String(label.opacity);
        }
      });
    }
    if (hint) hint.textContent = radiusLabel && frame.length < 1e-9
      ? 'В точке O радиус-вектор равен нулю; его углы не определены.'
      : 'Тяни M или её проекции на осях';
  };
}
