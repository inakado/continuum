import { pointGeometry } from './point-geometry.generated';
import TrajectoryPlayer from './TrajectoryPlayer';

export default function TrajectoryDemo() {
  return <TrajectoryPlayer axes={<g key="trajectory-axes" dangerouslySetInnerHTML={{ __html: pointGeometry.art }} />} view={pointGeometry.view} labels={pointGeometry.labels} width={pointGeometry.width} height={pointGeometry.height} />;
}
