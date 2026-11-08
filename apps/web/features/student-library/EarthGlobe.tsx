'use client';

import { useId } from 'react';
import { earthLandPath } from './earth-land.generated';

export default function EarthGlobe() {
  const id = useId();
  return <g>
    <defs>
      <radialGradient id={`${id}-ocean`} cx=".3" cy=".25" r=".8">
        <stop stopColor="#d2e3ee" /><stop offset=".6" stopColor="#94b4d4" /><stop offset="1" stopColor="#7899bf" />
      </radialGradient>
      <radialGradient id={`${id}-shade`} cx=".3" cy=".25" r=".8">
        <stop stopColor="white" stopOpacity=".16" /><stop offset=".55" stopColor="white" stopOpacity="0" /><stop offset="1" stopColor="#27344a" stopOpacity=".3" />
      </radialGradient>
    </defs>
    <circle r="1" fill={`url(#${id}-ocean)`} />
    <path d={earthLandPath} fill="#8fae9d" />
    <circle r="1" fill={`url(#${id}-shade)`} stroke="#8da5c1" strokeWidth=".015" />
  </g>;
}
