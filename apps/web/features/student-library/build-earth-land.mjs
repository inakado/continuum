// Authoring only: node build-earth-land.mjs /path/to/d3-geo/src/index.js
// Natural Earth 1:110m land, public domain. See documents/FRONTEND.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Pass the installed d3-geo entry point');
const { geoOrthographic, geoPath } = await import(pathToFileURL(process.argv[2]).href);
const land = JSON.parse(readFileSync(new URL('./assets/earth-land.geojson', import.meta.url), 'utf8'));
const projection = geoOrthographic().rotate([-20, -20]).translate([0, 0]).scale(1).precision(.003);
const path = geoPath(projection).digits(3);
const outline = land.features.map((feature) => path(feature)).filter(Boolean).join('');
writeFileSync(new URL('./earth-land.generated.ts', import.meta.url), `// Generated from Natural Earth 1:110m land with an orthographic projection.\nexport const earthLandPath = ${JSON.stringify(outline)};\n`);
