import { motionGeometry } from './motion-geometry.generated';
import { materialPointGeometry } from './material-point-geometry.generated';
import MaterialPointPlayer from './MaterialPointPlayer';

export default function MaterialPointDemo() {
  return <MaterialPointPlayer
    layout={materialPointGeometry.layout}
    view={materialPointGeometry.view}
    track={<g key="material-track" dangerouslySetInnerHTML={{ __html: motionGeometry.track }} />}
    carriage={<g key="material-carriage" dangerouslySetInnerHTML={{ __html: motionGeometry.carriage }} />}
    back={<g key="material-gate-back" dangerouslySetInnerHTML={{ __html: materialPointGeometry.back }} />}
    front={<g key="material-gate-front" dangerouslySetInnerHTML={{ __html: materialPointGeometry.front }} />}
  />;
}
