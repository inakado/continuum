import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LATEX_MAX_SOURCE_LENGTH,
  type UnitHtmlAssetRef,
} from '../latex/latex-queue.contract';
import { LatexCompileError } from '../latex/latex-compile';
import { type WorkerObjectStorageService } from '../storage/object-storage';

const DEFAULT_TIMEOUT_MS = 120_000;
const OUTPUT_CAPTURE_LIMIT = 128_000;
const OUTPUT_SNIPPET_LIMIT = 12_000;
const TIKZ_RENDER_CACHE_VERSION = 'v6';
const DEFAULT_DOCUMENT_PREAMBLE = [
  '\\documentclass{article}',
  '\\usepackage[english,russian]{babel}',
  '\\usepackage{amsmath,amsthm,mathtools}',
  '\\usepackage{tikz}',
  '\\begin{document}',
];
const TIKZ_STANDALONE_SAFE_FONT_BLOCK = [
  '\\usepackage{fontspec}',
  '\\defaultfontfeatures{Ligatures=TeX}',
  '\\setmainfont{Noto Serif}',
  '\\setsansfont{Noto Sans}',
  '\\setmonofont{DejaVu Sans Mono}',
];
const TIKZ_STANDALONE_DISALLOWED_PACKAGES = new Set([
  'pdfpages',
  'svg',
  'newcomputermodern',
  'fontspec',
  'unicode-math',
]);
const TIKZ_STANDALONE_DISALLOWED_COMMAND_PATTERNS = [
  /^\s*\\defaultfontfeatures(?:\[[^\]]*])?\{/,
  /^\s*\\setmainfont(?:\[[^\]]*])?\{/,
  /^\s*\\setsansfont(?:\[[^\]]*])?\{/,
  /^\s*\\setmonofont(?:\[[^\]]*])?\{/,
  /^\s*\\setmathfont(?:\[[^\]]*])?\{/,
];

type LatexHtmlRenderResult = {
  html: string;
  assetRefs: UnitHtmlAssetRef[];
  logSnippet?: string;
};

type TikzBlock = {
  placeholder: string;
  content: string;
};

type FigureSubfigureDescriptor = {
  label: string | null;
  captionLatex: string | null;
  imagePlaceholders: string[];
  refText: string | null;
};

type FigureDescriptor = {
  placeholder: string;
  label: string | null;
  captionLatex: string | null;
  imagePlaceholders: string[];
  subfigures: FigureSubfigureDescriptor[];
  refText: string | null;
};

type FigureMacroDefinition = {
  body: string;
  start: number;
  end: number;
};

type CommandResult = {
  code: number | null;
  timedOut: boolean;
  output: string;
  outputTruncated: boolean;
};

const ensureTex = (texSource: string): string => {
  if (typeof texSource !== 'string' || !texSource.trim()) {
    throw new LatexCompileError('INVALID_LATEX_INPUT', 'tex must be a non-empty string');
  }
  if (texSource.length > LATEX_MAX_SOURCE_LENGTH) {
    throw new LatexCompileError(
      'LATEX_TOO_LARGE',
      `tex exceeds max length (${LATEX_MAX_SOURCE_LENGTH})`,
    );
  }
  return texSource;
};

const resolveTimeoutMs = (): number => {
  const raw = process.env.LATEX_COMPILE_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.floor(parsed);
};

const ensureDocumentEnvelope = (tex: string): string => {
  if (/\\begin\{document\}/.test(tex) && /\\end\{document\}/.test(tex)) {
    return tex;
  }
  return `${DEFAULT_DOCUMENT_PREAMBLE.join('\n')}\n${tex}\n\\end{document}\n`;
};

const extractPreamble = (tex: string): string => {
  const documentMatch = tex.match(/\\begin\{document\}/);
  if (!documentMatch || documentMatch.index === undefined) {
    return '\\usepackage{tikz}';
  }
  const beforeDocument = tex.slice(0, documentMatch.index);
  const lines = beforeDocument
    .split(/\r?\n/)
    .filter((line) => !/^\s*\\documentclass/.test(line))
    .filter((line) => !TIKZ_STANDALONE_DISALLOWED_COMMAND_PATTERNS.some((pattern) => pattern.test(line)))
    .map(stripDisallowedTikzPackagesFromLine)
    .filter((line) => !/^\s*$/.test(line));
  if (lines.some((line) => /\\usepackage(?:\[[^\]]*])?\{[^}]*tikz[^}]*\}/.test(line))) {
    return lines.join('\n');
  }
  return [...lines, '\\usepackage{tikz}'].join('\n');
};

const stripDisallowedTikzPackagesFromLine = (line: string): string => {
  const match = line.match(
    /^(\s*\\usepackage\s*(?:\[[^\]]*])?\s*\{)([^}]+)(\}\s*(?:%.*)?)$/,
  );
  if (!match) return line;

  const [, prefix, packageListRaw, suffix] = match;
  const filteredPackages = packageListRaw
    .split(',')
    .map((pkg) => pkg.trim())
    .filter(Boolean)
    .filter((pkg) => !TIKZ_STANDALONE_DISALLOWED_PACKAGES.has(pkg.toLowerCase()));

  if (filteredPackages.length === 0) {
    return '';
  }

  return `${prefix}${filteredPackages.join(',')}${suffix}`;
};

const readBalancedGroup = (
  source: string,
  openBraceIndex: number,
): { content: string; endIndex: number } | null => {
  if (source[openBraceIndex] !== '{') {
    return null;
  }

  let depth = 0;
  for (let index = openBraceIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
      continue;
    }
    if (char !== '}') {
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return {
        content: source.slice(openBraceIndex + 1, index),
        endIndex: index + 1,
      };
    }
  }

  return null;
};

const extractFigureMacroDefinitions = (tex: string): Map<string, FigureMacroDefinition> => {
  const definitions = new Map<string, FigureMacroDefinition>();
  const headerPattern = /\\newcommand\{\\(fig[A-Za-z0-9@]+)\}\[1\]\s*\{/g;

  for (const match of tex.matchAll(headerPattern)) {
    if (match.index === undefined) continue;

    const macroName = match[1];
    if (!macroName) continue;

    const headerText = match[0];
    const bodyOpenIndex = match.index + headerText.length - 1;
    const body = readBalancedGroup(tex, bodyOpenIndex);
    if (!body) continue;

    let end = body.endIndex;
    while (tex[end] === '%' || tex[end] === '\r' || tex[end] === '\n') {
      end += 1;
    }

    definitions.set(macroName, {
      body: body.content,
      start: match.index,
      end,
    });
  }

  return definitions;
};

const removeFigureMacroDefinitions = (
  tex: string,
  definitions: Map<string, FigureMacroDefinition>,
): string => {
  const ranges = [...definitions.values()].sort((left, right) => right.start - left.start);
  let next = tex;
  for (const range of ranges) {
    next = `${next.slice(0, range.start)}${next.slice(range.end)}`;
  }
  return next;
};

const unwrapResizebox = (body: string): string => {
  const trimmed = body.replace(/^\s*%\s*/g, '').trim();
  if (!trimmed.startsWith('\\resizebox')) {
    return trimmed;
  }

  let cursor = '\\resizebox'.length;
  while (/\s/.test(trimmed[cursor] ?? '')) {
    cursor += 1;
  }

  const firstArg = readBalancedGroup(trimmed, cursor);
  if (!firstArg) return trimmed;
  cursor = firstArg.endIndex;
  while (/\s/.test(trimmed[cursor] ?? '')) {
    cursor += 1;
  }

  const secondArg = readBalancedGroup(trimmed, cursor);
  if (!secondArg) return trimmed;
  cursor = secondArg.endIndex;
  while (/\s/.test(trimmed[cursor] ?? '')) {
    cursor += 1;
  }

  const bodyArg = readBalancedGroup(trimmed, cursor);
  if (!bodyArg) return trimmed;
  return bodyArg.content.trim();
};

const replaceMacroInvocations = (
  tex: string,
  macroName: string,
  replacer: (argument: string) => string,
): string => {
  const invocation = `\\${macroName}`;
  let next = '';
  let cursor = 0;

  while (cursor < tex.length) {
    const foundAt = tex.indexOf(invocation, cursor);
    if (foundAt === -1) {
      next += tex.slice(cursor);
      break;
    }

    next += tex.slice(cursor, foundAt);
    let argStart = foundAt + invocation.length;
    while (/\s/.test(tex[argStart] ?? '')) {
      argStart += 1;
    }

    if (tex[argStart] !== '{') {
      next += invocation;
      cursor = foundAt + invocation.length;
      continue;
    }

    const argument = readBalancedGroup(tex, argStart);
    if (!argument) {
      next += invocation;
      cursor = foundAt + invocation.length;
      continue;
    }

    next += replacer(argument.content);
    cursor = argument.endIndex;
  }

  return next;
};

const expandFigureMacros = (tex: string): string => {
  const definitions = extractFigureMacroDefinitions(tex);
  if (definitions.size === 0) {
    return tex;
  }

  let next = removeFigureMacroDefinitions(tex, definitions);
  for (const [macroName, definition] of definitions) {
    const expandedBody = unwrapResizebox(definition.body);
    next = replaceMacroInvocations(next, macroName, (argument) =>
      expandedBody.replaceAll('#1', argument.trim()),
    );
  }
  return next;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeLatexInlineForHtml = (latex: string): string =>
  escapeHtml(
    latex
      .replace(/~/g, ' ')
      .replace(/\\\\/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

const extractFirstCommandArgument = (source: string, command: string): string | null => {
  const commandPattern = new RegExp(`\\\\${command}(?:\\[[^\\]]*\\])?\\s*\\{`, 'g');
  const match = commandPattern.exec(source);
  if (!match || match.index === undefined) {
    return null;
  }

  const openBraceIndex = match.index + match[0].length - 1;
  const group = readBalancedGroup(source, openBraceIndex);
  return group ? group.content.trim() : null;
};

const extractTikzPlaceholderTokens = (source: string): string[] =>
  Array.from(source.matchAll(/CONTINUUMTIKZPLACEHOLDER\d+/g), (match) => match[0]).filter(Boolean);

const stripRanges = (source: string, ranges: Array<{ start: number; end: number }>): string => {
  let next = source;
  const sortedRanges = [...ranges].sort((left, right) => right.start - left.start);
  for (const range of sortedRanges) {
    next = `${next.slice(0, range.start)}${next.slice(range.end)}`;
  }
  return next;
};

const parseSubfigures = (body: string): Array<FigureSubfigureDescriptor & { start: number; end: number }> => {
  const subfigures: Array<FigureSubfigureDescriptor & { start: number; end: number }> = [];
  const subfigurePattern = /\\begin\{subfigure\}(?:\[[^\]]*])?\{[\s\S]*?\}([\s\S]*?)\\end\{subfigure\}/g;

  for (const match of body.matchAll(subfigurePattern)) {
    if (match.index === undefined) continue;
    const content = match[1] ?? '';
    subfigures.push({
      start: match.index,
      end: match.index + match[0].length,
      label: extractFirstCommandArgument(content, 'label'),
      captionLatex: extractFirstCommandArgument(content, 'caption'),
      imagePlaceholders: extractTikzPlaceholderTokens(content),
      refText: null,
    });
  }

  return subfigures;
};

const extractFigures = (tex: string): { modifiedTex: string; figures: FigureDescriptor[] } => {
  const figures: FigureDescriptor[] = [];
  const figurePattern = /\\begin\{figure\}(?:\[[^\]]*])?([\s\S]*?)\\end\{figure\}/g;
  const modifiedTex = tex.replace(figurePattern, (match, bodyRaw) => {
    const body = typeof bodyRaw === 'string' ? bodyRaw : '';
    const placeholder = `CONTINUUMFIGUREPLACEHOLDER${figures.length}`;
    const subfiguresWithRanges = parseSubfigures(body);
    const outerBody = stripRanges(
      body,
      subfiguresWithRanges.map((subfigure) => ({ start: subfigure.start, end: subfigure.end })),
    );

    figures.push({
      placeholder,
      label: extractFirstCommandArgument(outerBody, 'label'),
      captionLatex: extractFirstCommandArgument(outerBody, 'caption'),
      imagePlaceholders: extractTikzPlaceholderTokens(outerBody),
      subfigures: subfiguresWithRanges.map(({ start, end, ...subfigure }) => subfigure),
      refText: String(figures.length + 1),
    });

    return `\n${placeholder}\n`;
  });

  for (const [figureIndex, figure] of figures.entries()) {
    figure.refText = String(figureIndex + 1);
    for (const [subIndex, subfigure] of figure.subfigures.entries()) {
      subfigure.refText = `${figureIndex + 1}${String.fromCharCode(97 + subIndex)}`;
    }
  }

  return { modifiedTex, figures };
};

const extractTikzBlocks = (tex: string): { modifiedTex: string; blocks: TikzBlock[] } => {
  const blocks: TikzBlock[] = [];
  const modifiedTex = tex.replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, (match) => {
    const placeholder = `CONTINUUMTIKZPLACEHOLDER${blocks.length}`;
    blocks.push({ placeholder, content: match });
    return `\n${placeholder}\n`;
  });
  return { modifiedTex, blocks };
};

const sanitizeSvg = (svg: string): string => {
  const normalized = svg.trim();
  const bannedPatterns = [
    /<script[\s>]/i,
    /<foreignObject[\s>]/i,
    /\son[a-z]+\s*=/i,
    /\s(?:href|xlink:href)\s*=\s*["']\s*(?:javascript:|https?:|data:)/i,
  ];
  if (bannedPatterns.some((pattern) => pattern.test(normalized))) {
    throw new LatexCompileError('LATEX_COMPILE_FAILED', 'Generated SVG contains unsupported markup');
  }

  return normalized
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/\s(on[a-z]+)\s*=\s*(["']).*?\2/gi, '')
    .trim();
};

const sanitizeHtml = (html: string): string => {
  const bannedTags = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'meta', 'link'];
  let next = html;
  for (const tag of bannedTags) {
    next = next.replace(new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
    next = next.replace(new RegExp(`<${tag}[^>]*\\/?>`, 'gi'), '');
  }

  next = next
    .replace(/\s(on[a-z]+)\s*=\s*(["']).*?\2/gi, '')
    .replace(/\sstyle\s*=\s*(["']).*?\1/gi, '')
    .replace(/\s(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '');

  return next.trim();
};

const buildTikzStandaloneDocument = (preamble: string, block: string): string => {
  const cleanedPreamble = preamble
    .split(/\r?\n/)
    .filter((line) => !/\\begin\{document\}/.test(line))
    .filter((line) => !/\\end\{document\}/.test(line))
    .join('\n');

  return [
    '\\documentclass[tikz,dvisvgm,border=2pt]{standalone}',
    cleanedPreamble,
    ...TIKZ_STANDALONE_SAFE_FONT_BLOCK,
    '\\begin{document}',
    block,
    '\\end{document}',
    '',
  ].join('\n');
};

const summarizeOutput = (chunks: string[]): string | undefined => {
  const normalized = chunks.map((chunk) => chunk.trim()).filter(Boolean).join('\n');
  if (!normalized) return undefined;
  return normalized.length <= OUTPUT_SNIPPET_LIMIT
    ? normalized
    : `...${normalized.slice(-OUTPUT_SNIPPET_LIMIT)}`;
};

const buildTikzAssetKey = (preamble: string, block: string): string => {
  const hash = createHash('md5')
    .update(TIKZ_RENDER_CACHE_VERSION, 'utf8')
    .update('\n---PREAMBLE---\n', 'utf8')
    .update(preamble, 'utf8')
    .update('\n---BLOCK---\n', 'utf8')
    .update(block, 'utf8')
    .update('\n---DVI2SVG---\n--exact-bbox --font-format=woff\n', 'utf8')
    .digest('hex');
  return `rendering/tikz/${hash}.svg`;
};

const runCommand = (
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    let outputTruncated = false;
    const appendOutput = (chunk: Buffer | string) => {
      output += chunk.toString();
      if (output.length > OUTPUT_CAPTURE_LIMIT) {
        output = output.slice(-OUTPUT_CAPTURE_LIMIT);
        outputTruncated = true;
      }
    };

    child.stdout.on('data', appendOutput);
    child.stderr.on('data', appendOutput);

    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({ code, timedOut, output, outputTruncated });
    });
  });

const ensureCommandSucceeded = (
  command: string,
  result: CommandResult,
  timeoutMs: number,
): string | undefined => {
  const cleaned = result.output.replace(/\u001b\[[0-9;]*m/g, '').trim();
  const snippet =
    cleaned.length <= OUTPUT_SNIPPET_LIMIT ? cleaned : cleaned ? `...${cleaned.slice(-OUTPUT_SNIPPET_LIMIT)}` : undefined;
  if (result.timedOut) {
    throw new LatexCompileError(
      'LATEX_COMPILE_TIMEOUT',
      `${command} exceeded ${timeoutMs}ms`,
      cleaned || undefined,
      snippet,
      result.outputTruncated,
      OUTPUT_CAPTURE_LIMIT,
    );
  }
  if (result.code !== 0) {
    throw new LatexCompileError(
      'LATEX_COMPILE_FAILED',
      `${command} failed`,
      cleaned || undefined,
      snippet,
      result.outputTruncated,
      OUTPUT_CAPTURE_LIMIT,
    );
  }
  return snippet;
};

const compileTikzToSvg = async ({
  storage,
  tempDir,
  preamble,
  block,
  index,
  timeoutMs,
}: {
  storage: WorkerObjectStorageService;
  tempDir: string;
  preamble: string;
  block: string;
  index: number;
  timeoutMs: number;
}): Promise<{ assetKey: string; contentType: 'image/svg+xml'; logSnippet?: string }> => {
  const assetKey = buildTikzAssetKey(preamble, block);
  if (await storage.objectExists(assetKey)) {
    return { assetKey, contentType: 'image/svg+xml' };
  }

  const texName = `tikz-${index}.tex`;
  const texPath = join(tempDir, texName);
  const xdvPath = join(tempDir, `tikz-${index}.xdv`);
  const svgPath = join(tempDir, `tikz-${index}.svg`);
  await fs.writeFile(texPath, buildTikzStandaloneDocument(preamble, block), 'utf8');

  const tectonic = await runCommand(
    'tectonic',
    ['--outfmt', 'xdv', '--outdir', tempDir, texName],
    tempDir,
    timeoutMs,
  );
  const tectonicSnippet = ensureCommandSucceeded('tectonic', tectonic, timeoutMs);

  const dvisvgm = await runCommand(
    'dvisvgm',
    ['--exact-bbox', '--font-format=woff', '-o', svgPath, xdvPath],
    tempDir,
    timeoutMs,
  );
  const dvisvgmSnippet = ensureCommandSucceeded('dvisvgm', dvisvgm, timeoutMs);

  const svg = sanitizeSvg(await fs.readFile(svgPath, 'utf8'));
  await storage.putObject({
    key: assetKey,
    contentType: 'image/svg+xml',
    body: svg,
    cacheControl: 'public, max-age=31536000, immutable',
  });

  return {
    assetKey,
    contentType: 'image/svg+xml',
    logSnippet: summarizeOutput([tectonicSnippet ?? '', dvisvgmSnippet ?? '']),
  };
};

const injectFigurePlaceholders = (html: string, assets: UnitHtmlAssetRef[]): string => {
  let next = html;
  for (const asset of assets) {
    const image = `<img class="unit-html-tikz-image" src="${asset.placeholder}" alt="" loading="lazy" />`;
    next = next.replace(new RegExp(`<p>\\s*${asset.placeholder}\\s*</p>`, 'g'), image);
  }
  return next;
};

const buildFigureCaptionHtml = (figureNumber: string, captionLatex: string): string =>
  `<figcaption><span class="unit-html-figure-number">Рис. ${figureNumber}. </span>${normalizeLatexInlineForHtml(captionLatex)}</figcaption>`;

const buildSubfigureHtml = (subfigure: FigureSubfigureDescriptor): string => {
  const imagesHtml = subfigure.imagePlaceholders
    .map(
      (placeholder) =>
        `<img class="unit-html-tikz-image" src="${placeholder}" alt="" loading="lazy" />`,
    )
    .join('');
  const idAttr = subfigure.label ? ` id="${escapeHtml(subfigure.label)}"` : '';
  const captionHtml = subfigure.captionLatex
    ? `<figcaption>${normalizeLatexInlineForHtml(subfigure.captionLatex)}</figcaption>`
    : '';
  return `<figure class="unit-html-figure unit-html-subfigure"${idAttr}>${imagesHtml}${captionHtml}</figure>`;
};

const buildFigureHtml = (figure: FigureDescriptor): string => {
  const idAttr = figure.label ? ` id="${escapeHtml(figure.label)}"` : '';
  const captionHtml =
    figure.captionLatex && figure.refText
      ? buildFigureCaptionHtml(figure.refText, figure.captionLatex)
      : '';

  if (figure.subfigures.length > 0) {
    const subfigureHtml = figure.subfigures.map(buildSubfigureHtml).join('');
    return `<figure class="unit-html-figure-group"${idAttr}>${subfigureHtml}${captionHtml}</figure>`;
  }

  const imagesHtml = figure.imagePlaceholders
    .map(
      (placeholder) =>
        `<img class="unit-html-tikz-image" src="${placeholder}" alt="" loading="lazy" />`,
    )
    .join('');
  return `<figure class="unit-html-figure"${idAttr}>${imagesHtml}${captionHtml}</figure>`;
};

const injectExtractedFigures = (html: string, figures: FigureDescriptor[]): string => {
  let next = html;
  for (const figure of figures) {
    const figureHtml = buildFigureHtml(figure);
    next = next.replace(new RegExp(`<p>\\s*${figure.placeholder}\\s*</p>`, 'g'), figureHtml);
    next = next.replaceAll(figure.placeholder, figureHtml);
  }
  return next;
};

const replaceFigureReferences = (html: string, figures: FigureDescriptor[]): string => {
  let next = html;
  const references = new Map<string, string>();
  for (const figure of figures) {
    if (figure.label && figure.refText) {
      references.set(figure.label, figure.refText);
    }
    for (const subfigure of figure.subfigures) {
      if (subfigure.label && subfigure.refText) {
        references.set(subfigure.label, subfigure.refText);
      }
    }
  }

  for (const [label, refText] of references) {
    const escapedLabel = escapeRegExp(label);
    const anchorPattern = new RegExp(
      `<a([^>]*?(?:href="#${escapedLabel}"|data-reference="${escapedLabel}")[^>]*)>\\s*\\[${escapedLabel}\\]\\s*<\\/a>`,
      'g',
    );
    next = next.replace(anchorPattern, `<a$1>${refText}</a>`);
    next = next.replace(new RegExp(`\\[${escapedLabel}\\]`, 'g'), refText);
  }

  return next;
};

export const renderLatexToHtml = async (
  texSource: string,
  storage: WorkerObjectStorageService,
): Promise<LatexHtmlRenderResult> => {
  const tex = expandFigureMacros(ensureDocumentEnvelope(ensureTex(texSource)));
  const timeoutMs = resolveTimeoutMs();
  const tempDir = await fs.mkdtemp(join(tmpdir(), 'continuum-tex-html-'));
  const logChunks: string[] = [];

  try {
    const preamble = extractPreamble(tex);
    const { modifiedTex: texWithTikzPlaceholders, blocks } = extractTikzBlocks(tex);
    const { modifiedTex, figures } = extractFigures(texWithTikzPlaceholders);
    const assetRefs: UnitHtmlAssetRef[] = [];

    for (const [index, block] of blocks.entries()) {
      const compiled = await compileTikzToSvg({
        storage,
        tempDir,
        preamble,
        block: block.content,
        index,
        timeoutMs,
      });
      assetRefs.push({
        placeholder: block.placeholder,
        assetKey: compiled.assetKey,
        contentType: compiled.contentType,
      });
      if (compiled.logSnippet) {
        logChunks.push(compiled.logSnippet);
      }
    }

    await fs.writeFile(join(tempDir, 'render-input.tex'), modifiedTex, 'utf8');
    const pandocResult = await runCommand(
      'pandoc',
      ['render-input.tex', '-f', 'latex', '-t', 'html5', '--mathjax', '-o', 'render-output.html'],
      tempDir,
      timeoutMs,
    );
    const pandocSnippet = ensureCommandSucceeded('pandoc', pandocResult, timeoutMs);
    if (pandocSnippet) {
      logChunks.push(pandocSnippet);
    }

    const rawHtml = await fs.readFile(join(tempDir, 'render-output.html'), 'utf8');
    const html = sanitizeHtml(
      replaceFigureReferences(
        injectFigurePlaceholders(injectExtractedFigures(rawHtml, figures), assetRefs),
        figures,
      ),
    );
    const logSnippet = summarizeOutput(logChunks);

    return {
      html,
      assetRefs,
      ...(logSnippet ? { logSnippet } : null),
    };
  } catch (error) {
    if ((error as { code?: string } | null)?.code === 'ENOENT') {
      throw new LatexCompileError(
        'LATEX_RUNTIME_MISSING',
        'pandoc or dvisvgm binary is not available in worker runtime environment',
      );
    }
    if (error instanceof LatexCompileError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new LatexCompileError('LATEX_COMPILE_CRASHED', error.message);
    }
    throw new LatexCompileError('LATEX_COMPILE_CRASHED', 'Unknown html render error');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

export const __test__ = {
  buildTikzAssetKey,
  expandFigureMacros,
  extractFigures,
  injectFigurePlaceholders,
  injectExtractedFigures,
  replaceFigureReferences,
};
