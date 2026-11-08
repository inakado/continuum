'use client';

import { useEffect, useMemo, useRef } from 'react';
import { clampPoint, INITIAL_POINT, type Point3 } from './point-position-model';

export type PointController = {
  read: () => Point3;
  set: (point: Point3) => void;
  subscribe: (paint: (point: Point3) => void) => () => void;
};

export function usePointPosition(): PointController {
  const point = useRef<Point3>(INITIAL_POINT);
  const painters = useRef(new Set<(point: Point3) => void>());
  const frame = useRef(0);
  useEffect(() => () => { cancelAnimationFrame(frame.current); frame.current = 0; }, []);
  return useMemo(() => ({
    read: () => point.current,
    set: (value: Point3) => {
      point.current = clampPoint(value);
      if (!frame.current) frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        painters.current.forEach((paint) => paint(point.current));
      });
    },
    subscribe: (paint: (point: Point3) => void) => {
      painters.current.add(paint);
      paint(point.current);
      return () => { painters.current.delete(paint); };
    },
  }), []);
}
