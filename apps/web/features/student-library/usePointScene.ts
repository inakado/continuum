'use client';

import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { createPointPainter } from './point-position-painter';
import { dragPointAxis, dragPointVertical, dragPointXY, INITIAL_POINT, POINT_LIMIT, pointNumber, type Point3, type PointAxis, type PointView } from './point-position-model';
import type { PointController } from './usePointPosition';

export function usePointScene(controller: PointController, view: PointView, width: number, height: number) {
  const root = useRef<HTMLElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; scale: number; point: Point3; ground: boolean; axis?: PointAxis } | null>(null);
  useEffect(() => {
    if (!root.current) return;
    const paint = createPointPainter(root.current, view, width, height);
    const unsubscribe = controller.subscribe(paint);
    const observer = new ResizeObserver(() => paint(controller.read()));
    observer.observe(root.current);
    return () => { unsubscribe(); observer.disconnect(); };
  }, [controller, view, width, height]);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>, axis?: PointAxis) {
    if (event.button !== 0 || !root.current || drag.current) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const scale = root.current.querySelector('svg')!.getBoundingClientRect().width / width;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, point: controller.read(), scale, ground: event.shiftKey, axis };
    root.current.dataset.dragging = 'true';
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || event.pointerId !== start.id) return;
    const dx = (event.clientX - start.x) / start.scale;
    const dy = (event.clientY - start.y) / start.scale;
    controller.set(start.axis !== undefined ? dragPointAxis(start.point, [dx, dy], start.axis, view)
      : start.ground ? dragPointXY(start.point, [dx, dy], view) : dragPointVertical(start.point, [dx, dy], view));
  }

  function onPointerEnd(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    if (root.current) delete root.current.dataset.dragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, selectedAxis?: PointAxis) {
    const point = [...controller.read()] as [number, number, number];
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', ...(selectedAxis !== undefined ? ['End'] : [])].includes(event.key)) return;
    event.preventDefault();
    if (selectedAxis !== undefined) {
      point[selectedAxis] = event.key === 'Home' ? 0 : event.key === 'End' ? POINT_LIMIT
        : point[selectedAxis] + (event.key === 'ArrowRight' || event.key === 'ArrowUp' ? .1 : -.1);
      controller.set(point);
    } else if (event.key === 'Home') controller.set(INITIAL_POINT);
    else {
      const axis = event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? 0 : event.shiftKey ? 2 : 1;
      point[axis] += event.key === 'ArrowRight' || event.key === 'ArrowUp' ? .1 : -.1;
      controller.set(point);
    }
    const status = root.current?.querySelector('[data-point-status]');
    if (status) status.textContent = controller.read().map((value, i) => `${['X', 'Y', 'Z'][i]} ${pointNumber(value)} м`).join('; ');
  }

  return { root, onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onLostPointerCapture: onPointerEnd, onKeyDown };
}
