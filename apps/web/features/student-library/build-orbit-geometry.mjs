// Anatomy Figure: three spherical bodies; surface inlays follow the same sphere.
// node build-orbit-geometry.mjs /path/to/anatomy/kit/iso-kit.mjs [--audit]
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Pass anatomy kit/iso-kit.mjs');
const kitUrl = pathToFileURL(process.argv[2]);
const k = await import(kitUrl.href);
const G = await import(new URL('./lathe.mjs', kitUrl));
const P = { origin: [0, 0], scale: 1 / Math.sqrt(1.6), azimuth: 110, elevation: 58 };
const V = G.viewOf(P), F = G.frameAlong([0, 0, 0], V);
const path = (points) => k.pathOf(points.map((p) => k.iso(p, P)), true);
const fromFace = ([x, y]) => G.pointOf(F, Math.sqrt(1 - x * x - y * y), Math.hypot(x, y), Math.atan2(y, x));
const body = k.solidSvg(G.sphereOf([0, 0, 0], 50, P, { steps: 120 }), { tone: 'mid' });
const craters = [[-.40,-.27,.14],[.30,-.38,.18],[.10,.25,.21],[-.39,.40,.10],[.48,.18,.08]].map(([x,y,r]) => {
  const normal = fromFace([x,y]), frame = G.frameAlong([0,0,0], normal);
  const points = Array.from({length:49}, (_,i)=>G.pointOf(frame, 50*Math.cos(r),50*Math.sin(r), i/48*2*Math.PI));
  return `<path class="orbit-crater" d="${path(points)}"/>`;
}).join('');
const normalise = (art) => `<g transform="scale(.02)">${art}</g>`;
const orbitP = { ...P, origin: [250,180], scale: 170 / Math.sqrt(1.6) };
const origin = k.iso([0,0,0], orbitP);
const view = { origin, axes: [[1,0,0],[0,1,0],[0,0,1]].map((p)=>{const q=k.iso(p,orbitP);return[q[0]-origin[0],q[1]-origin[1]];}) };
const output = { moon: normalise(body+craters), sun: normalise(body), view, width:500, height:360 };
writeFileSync(new URL('./orbit-geometry.generated.ts',import.meta.url),`// Generated with anatomy sphereOf; authoring kit is not shipped.\nexport const orbitGeometry = ${JSON.stringify(output)} as const;\n`);
if (process.argv.includes('--audit')) {
  const A = await import(new URL('./audit.mjs',kitUrl));
  const R=A.recorder(P);
  for(const [i,name] of ['earth','moon','sun'].entries()) {
    const at=[i*130,0,0], paths=G.sphereOf(at,50,P,{steps:120});
    R.put({piece:name,at,svg:k.solidSvg(paths,{tone:'mid'}),shapes:[A.ball(at,50,{name})],name});
  }
  A.settle(R,P);
  A.auditOrExit(R,P);
}
console.log('Anatomy orbital bodies generated: Earth, Moon, Sun');
