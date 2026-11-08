import { motionGeometry } from './motion-geometry.generated';
import MechanicalMotionPlayer from './MechanicalMotionPlayer';

export default function MechanicalMotionDemo() {
  return (
    <MechanicalMotionPlayer
      travel={motionGeometry.travelPerMetre}
      referenceAnchor={motionGeometry.referenceAnchor}
      zeroAnchor={motionGeometry.zeroAnchor}
      axisAnchor={motionGeometry.axisAnchor}
      axis={<g key="axis" dangerouslySetInnerHTML={{ __html: motionGeometry.axis }} />}
      coordinateAxis={motionGeometry.coordinateAxis}
      base={<g key="base" data-motion-platform dangerouslySetInnerHTML={{ __html: motionGeometry.stationary }} />}
      carriage={<g key="carriage" dangerouslySetInnerHTML={{ __html: motionGeometry.moving }} />}
    />
  );
}
