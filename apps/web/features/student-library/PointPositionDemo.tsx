import { pointGeometry } from './point-geometry.generated';
import PointPositionMethods from './PointPositionMethods';

export default function PointPositionDemo() {
  return <PointPositionMethods
    axes={<g key="point-axes" dangerouslySetInnerHTML={{ __html: pointGeometry.art }} />}
    view={pointGeometry.view}
    labels={pointGeometry.labels}
    width={pointGeometry.width}
    height={pointGeometry.height}
  />;
}
