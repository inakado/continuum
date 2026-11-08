import { orbitGeometry } from './orbit-geometry.generated';
import OrbitPlayer from './OrbitPlayer';
import EarthGlobe from './EarthGlobe';

export default function OrbitDemo() {
  return <OrbitPlayer
    earth={<EarthGlobe />}
    moon={<g key="orbit-moon-art" dangerouslySetInnerHTML={{ __html: orbitGeometry.moon }} />}
    sun={<g key="orbit-sun-art" dangerouslySetInnerHTML={{ __html: orbitGeometry.sun }} />}
    view={orbitGeometry.view} width={orbitGeometry.width} height={orbitGeometry.height}
  />;
}
