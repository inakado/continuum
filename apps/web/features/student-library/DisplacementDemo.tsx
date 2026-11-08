import { pointGeometry } from './point-geometry.generated';
import DisplacementPlayer from './DisplacementPlayer';

export default function DisplacementDemo() {
  return <DisplacementPlayer axes={<g key="displacement-axes" dangerouslySetInnerHTML={{ __html: pointGeometry.art }} />} view={pointGeometry.view} labels={pointGeometry.labels} width={pointGeometry.width} height={pointGeometry.height} />;
}
