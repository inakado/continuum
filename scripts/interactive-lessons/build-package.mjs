import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer, build } from 'vite';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const web = path.join(repository, 'apps/web');
const webRequire = createRequire(path.join(web, 'package.json'));
const apiRequire = createRequire(path.join(repository, 'apps/api/package.json'));
const definitionPath = path.resolve(repository, process.argv[2] ?? 'apps/web/features/student-library/kinematics-package.tsx');
const outputDirectory = path.resolve(repository, process.argv[3] ?? 'output/interactive-lessons');
const authoring = path.join(web, 'components/interactive-lesson/authoring');
const shared = path.join(repository, 'packages/shared/src/index.ts');
const importPath = value => JSON.stringify(value.replaceAll('\\', '/'));
const mathKey = (tex, display) => JSON.stringify([tex, display]);
const aliases = { '@': web, '@continuum/shared': shared };
let formulas = new Map();

const collectorCode = `
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import definition from ${importPath(definitionPath)};
  import LessonArticle from ${importPath(path.join(authoring, 'LessonArticle.tsx'))};
  import {LessonFormulaProvider} from ${importPath(path.join(authoring, 'LessonEnvironment.tsx'))};
  export function collect() {
    const formulas = new Map();
    const render = (tex, display) => { formulas.set(JSON.stringify([tex, display]), {tex, display}); return tex; };
    const html = renderToStaticMarkup(React.createElement(LessonFormulaProvider, {value:render}, React.createElement(LessonArticle, {definition})));
    const {Content, ...metadata} = definition;
    return {html,metadata,formulas:[...formulas.values()]};
  }
`;
const collectorPlugin = { name: 'lesson-collector', resolveId(id) { if (id === 'virtual:lesson-collector') return '\0lesson-collector'; }, load(id) { if (id === '\0lesson-collector') return collectorCode; } };
const server = await createServer({ configFile: false, root: web, resolve: { alias: aliases }, plugins: [collectorPlugin], esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
let collected;
try { collected = (await server.ssrLoadModule('virtual:lesson-collector')).collect(); }
finally { await server.close(); }

// Reject broken local navigation before the archive reaches the import screen.
const identifiers = [...collected.html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const ids = new Set(identifiers);
if (ids.size !== identifiers.length) throw new Error('Повторяющиеся DOM id в лекции');
for (const section of collected.metadata.sections) {
  if (!ids.has(section.id)) throw new Error(`Отсутствует раздел ${section.id}`);
}
for (const [, target] of collected.html.matchAll(/href="#([^"]+)"/g)) {
  if (!ids.has(target)) throw new Error(`Ссылка на отсутствующее построение ${target}`);
}

// Author-side MathJax produces the same em-based CHTML glyphs without runtime network loading.
const MathJax = (await import(pathToFileURL(webRequire.resolve('mathjax')).href)).default;
await MathJax.init({ loader: { load: ['input/tex', 'output/chtml'] }, tex: { packages: ['base', 'ams'], maxBuffer: 8000, maxMacros: 1000 }, output: { font: 'mathjax-newcm', linebreaks: { inline: false } }, startup: { typeset: false } });
// Medeo Sans has x-height 0.53em, matching getMetricsFor in the web renderer.
// Preserve MathJax's font-height matching when serializing CHTML outside a browser.
const textXHeight = .53;
const mathScale = textXHeight / MathJax.startup.document.outputJax.font.params.x_height;
for (const { tex, display } of collected.formulas) {
  const node = await MathJax.tex2chtmlPromise(tex, { display, em: 16, ex: 16 * textXHeight, scale: mathScale, containerWidth: 960 });
  const html = MathJax.startup.adaptor.outerHTML(node);
  if (/data-mjx-error|<mjx-merror/.test(html)) throw new Error(`MathJax error: ${tex}`);
  formulas.set(mathKey(tex, display), html);
}
let mathCss = MathJax.startup.adaptor.textContent(MathJax.startup.document.outputJax.styleSheet(MathJax.startup.document));
const mathRequire = createRequire(webRequire.resolve('mathjax/package.json'));
for (const match of [...mathCss.matchAll(/url\("([^\"]+)"\)/g)]) {
  const filename = mathRequire.resolve(match[1]);
  const data = await readFile(filename);
  mathCss = mathCss.replace(match[0], `url("data:font/woff2;base64,${data.toString('base64')}")`);
}
const dataModule = `export default ${JSON.stringify(Object.fromEntries(formulas))};`;
const entryCode = `
  import React from 'react';
  import definition from ${importPath(definitionPath)};
  import { mountLesson } from ${importPath(path.join(authoring, 'package-runtime.tsx'))};
  import formulas from 'virtual:lesson-formulas';
  import ${importPath(path.join(authoring, 'authoring-base.css'))};
  mountLesson(definition, (tex, display) => {
    const html = formulas[JSON.stringify([tex, display])];
    if (!html) throw new Error('Формула отсутствует в сборке: ' + tex);
    return React.createElement('span', {dangerouslySetInnerHTML:{__html:html}});
  });
`;
const packagePlugin = { name: 'self-contained-lesson', enforce: 'pre', resolveId(id, importer) {
  if (id === 'next/image' || (id === './AssessmentImage' && importer?.endsWith('/components/assessment/AssessmentMarkdown.tsx'))) return path.join(authoring, 'PackagedAssessmentImage.tsx'); if (id === path.join(authoring, 'virtual:lesson-entry') || id === 'virtual:lesson-entry' || id === 'virtual:lesson-formulas') return '\0' + (id.endsWith('virtual:lesson-entry') ? 'virtual:lesson-entry' : id); }, load(id) { if (id === '\0virtual:lesson-entry') return entryCode; if (id === '\0virtual:lesson-formulas') return dataModule; } };
const clientDirectivePlugin = { name: 'remove-framework-directives', enforce: 'pre', transform(code, id) { if (/\.[tj]sx?$/.test(id) && /^['"]use client['"];/.test(code)) return { code: code.replace(/^['"]use client['"];\s*/, ''), map: null }; } };
// The collector uses Vite's development SSR; the deliverable must use production JSX.
process.env.NODE_ENV = 'production';
const result = await build({ configFile: false, define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'process.env.NEXT_PUBLIC_API_BASE_URL': JSON.stringify('') }, root: web, resolve: { alias: aliases }, plugins: [clientDirectivePlugin, packagePlugin], esbuild: { jsx: 'automatic', jsxDev: false }, build: { write: false, target: 'es2020', assetsInlineLimit: Infinity, cssCodeSplit: false, minify: true, lib: { entry: path.join(authoring, 'virtual:lesson-entry'), formats: ['iife'], name: 'ContinuumLesson' }, rollupOptions: { output: { inlineDynamicImports: true } } } });
const files = (Array.isArray(result) ? result : [result]).flatMap(item => item.output);
const js = files.filter(item => item.type === 'chunk').map(item => item.code).join('\n');
if (/\bjsxDEV\b/.test(js)) throw new Error('В автономную сборку попал development JSX runtime');
if (/\bprocess\s*\.\s*env\b/.test(js)) throw new Error('В автономную сборку попала зависимость от Node process.env: ' + [...js.matchAll(/.{0,60}\bprocess\s*\..{0,120}/g)].map(match => match[0]).join('\n'));
const css = files.filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => String(item.source)).join('\n');
const unexpected = files.filter(item => item.type === 'asset' && !item.fileName.endsWith('.css'));
if (unexpected.length) throw new Error(`Не встроены ресурсы: ${unexpected.map(item => item.fileName).join(', ')}`);
const title = collected.metadata.title.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const licenseTexts = [];
for (const name of ['react', 'react-dom', 'lucide-react', 'zod', 'medeo-font', 'mathjax']) {
  const packageFile = webRequire.resolve(`${name}/package.json`);
  const metadata = JSON.parse(await readFile(packageFile, 'utf8'));
  const license = await readFile(path.join(path.dirname(packageFile), name === 'medeo-font' ? 'LICENSE.txt' : 'LICENSE'), 'utf8');
  licenseTexts.push(`${name} ${metadata.version} (${metadata.license})\n${license}`);
}
const fontMetadata = JSON.parse(await readFile(mathRequire.resolve('@mathjax/mathjax-newcm-font/package.json'), 'utf8'));
licenseTexts.push(`@mathjax/mathjax-newcm-font ${fontMetadata.version} (${fontMetadata.license}); Apache-2.0 text included above with MathJax.`);
const notices = licenseTexts.join('\n\n').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css.replaceAll('</style', '<\\/style')}\n${mathCss.replaceAll('</style', '<\\/style')}</style></head><body><template id="lesson-third-party-notices"><pre>${notices}</pre></template><div id="lesson-root"></div><script>${js.replaceAll('</script', '<\\/script')}</script></body></html>`;
const { lessonId, sections, questions } = collected.metadata;
const manifest = { schemaVersion: 1, lessonId, title: collected.metadata.title, entrypoint: 'lesson.html', contentSha256: createHash('sha256').update(html).digest('hex'), sections, questions };
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, `${lessonId}.html`), html);
await writeFile(path.join(outputDirectory, `${lessonId}.manifest.json`), JSON.stringify(manifest, null, 2) + '\n');
const { ZipFile } = apiRequire('yazl');
const zip = new ZipFile();
const fixedTime = new Date('2000-01-01T00:00:00Z');
zip.addBuffer(Buffer.from(JSON.stringify(manifest, null, 2) + '\n'), 'manifest.json', { mtime: fixedTime, mode: 0o100644 });
zip.addBuffer(Buffer.from(html), 'lesson.html', { mtime: fixedTime, mode: 0o100644 });
zip.end();
const chunks = [];
for await (const chunk of zip.outputStream) chunks.push(chunk);
const archive = Buffer.concat(chunks);
await writeFile(path.join(outputDirectory, `${lessonId}.zip`), archive);
console.log(JSON.stringify({ archive: path.join(outputDirectory, `${lessonId}.zip`), zipBytes: archive.length, htmlBytes: Buffer.byteLength(html), formulas: formulas.size, sha256: createHash('sha256').update(archive).digest('hex') }, null, 2));
