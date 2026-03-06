import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertPdflatexCompatible,
  compileLatexToDvi,
  convertDviToSvg,
  ensurePdflatexDocumentEnvelope,
  LatexRuntimeError,
  normalizeLatexSource,
  resolveLatexTimeoutMs,
  summarizeLatexOutput,
} from '@continuum/latex-runtime';
import {
  type UnitHtmlAssetRef,
} from '../latex/latex-queue.contract';
import { LatexCompileError } from '../latex/latex-compile';
import { type WorkerObjectStorageService } from '../storage/object-storage';

const OUTPUT_CAPTURE_LIMIT = 128_000;
const OUTPUT_SNIPPET_LIMIT = 12_000;
const TIKZ_RENDER_CACHE_VERSION = 'pdflatex-dvi-v2';
const FIGURE_REF_TOKEN_PREFIX = 'CONTINUUMFIGREF__';
const FIGURE_AUTOREF_TOKEN_PREFIX = 'CONTINUUMFIGAUTOREF__';
const FIGURE_REF_TOKEN_SUFFIX = '__';
const TITLE_PLACEHOLDER_PREFIX = 'CONTINUUMTITLEPLACEHOLDER';
const TIKZ_STANDALONE_DISALLOWED_PACKAGES = new Set([
  'pdfpages',
  'svg',
  'newcomputermodern',
  'fontspec',
  'unicode-math',
  'polyglossia',
  'minted',
]);
const TIKZ_STANDALONE_DISALLOWED_COMMAND_PATTERNS = [
  /^\s*\\defaultfontfeatures(?:\[[^\]]*])?\{/,
  /^\s*\\setmainfont(?:\[[^\]]*])?\{/,
  /^\s*\\setsansfont(?:\[[^\]]*])?\{/,
  /^\s*\\setmonofont(?:\[[^\]]*])?\{/,
  /^\s*\\setmathfont(?:\[[^\]]*])?\{/,
  /^\s*\\newfontfamily(?:\[[^\]]*])?\{/,
  /^\s*\\directlua\b/,
  /^\s*\\includesvg(?:\[[^\]]*])?\{/,
  /^\s*\\tikzexternalize\b/,
];
const TIKZ_BODY_DECLARATION_COMMANDS = [
  'newcommand',
  'renewcommand',
  'providecommand',
  'def',
  'gdef',
  'pgfmathsetmacro',
  'pgfmathsetlengthmacro',
  'tikzset',
  'definecolor',
  'colorlet',
] as const;
const TIKZ_BODY_DECLARATION_PATTERN = new RegExp(
  `\\\\(${TIKZ_BODY_DECLARATION_COMMANDS.join('|')})(?:\\*)?(?![A-Za-z@])`,
  'g',
);
const TIKZ_INLINE_DECLARATION_LINE_PATTERN =
  /^\\(?:def|gdef|pgfmathsetmacro|pgfmathsetlengthmacro)\b/;

type LatexHtmlRenderResult = {
  html: string;
  assetRefs: UnitHtmlAssetRef[];
  logSnippet?: string;
};

type TikzBlock = {
  placeholder: string;
  content: string;
  localDeclarations: string;
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
  argCount: number;
  body: string;
  start: number;
  end: number;
};

type NameHeading = {
  placeholder: string;
  titleLatex: string;
};

type CommandResult = {
  code: number | null;
  timedOut: boolean;
  output: string;
  outputTruncated: boolean;
};

const extractPreamble = (tex: string): string => {
  const documentMatch = tex.match(/\\begin\{document\}/);
  if (!documentMatch || documentMatch.index === undefined) {
    return '\\usepackage{tikz}';
  }
  const beforeDocument = tex.slice(0, documentMatch.index);
  const lines = beforeDocument
    .split(/\r?\n/)
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

const readBalancedDelimitedGroup = (
  source: string,
  openIndex: number,
  openChar: string,
  closeChar: string,
): { content: string; endIndex: number } | null => {
  if (source[openIndex] !== openChar) {
    return null;
  }

  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === openChar) {
      depth += 1;
      continue;
    }
    if (char !== closeChar) {
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return {
        content: source.slice(openIndex + 1, index),
        endIndex: index + 1,
      };
    }
  }

  return null;
};

const readBalancedGroup = (
  source: string,
  openBraceIndex: number,
): { content: string; endIndex: number } | null => {
  return readBalancedDelimitedGroup(source, openBraceIndex, '{', '}');
};

const readBalancedBracketGroup = (
  source: string,
  openBracketIndex: number,
): { content: string; endIndex: number } | null =>
  readBalancedDelimitedGroup(source, openBracketIndex, '[', ']');

const skipWhitespaceAndComments = (source: string, offset: number): number => {
  let cursor = offset;
  while (cursor < source.length) {
    const char = source[cursor];
    if (/\s/.test(char)) {
      cursor += 1;
      continue;
    }
    if (char !== '%') {
      break;
    }
    while (cursor < source.length && source[cursor] !== '\n') {
      cursor += 1;
    }
  }
  return cursor;
};

const readControlSequence = (
  source: string,
  offset: number,
): { name: string; endIndex: number } | null => {
  if (source[offset] !== '\\') {
    return null;
  }
  const first = source[offset + 1];
  if (!first) {
    return null;
  }

  if (/[A-Za-z@]/.test(first)) {
    let cursor = offset + 2;
    while (cursor < source.length && /[A-Za-z@]/.test(source[cursor] ?? '')) {
      cursor += 1;
    }
    return {
      name: source.slice(offset + 1, cursor),
      endIndex: cursor,
    };
  }

  return {
    name: first,
    endIndex: offset + 2,
  };
};

const parseDeclarationCommandWithBraceGroups = (
  source: string,
  startOffset: number,
  requiredBraceGroups: number,
): { value: string; endIndex: number } | null => {
  const command = readControlSequence(source, startOffset);
  if (!command) return null;

  let cursor = command.endIndex;
  for (let index = 0; index < requiredBraceGroups; index += 1) {
    cursor = skipWhitespaceAndComments(source, cursor);
    while (source[cursor] === '[') {
      const optionalGroup = readBalancedBracketGroup(source, cursor);
      if (!optionalGroup) return null;
      cursor = skipWhitespaceAndComments(source, optionalGroup.endIndex);
    }

    const group = readBalancedGroup(source, cursor);
    if (!group) return null;
    cursor = group.endIndex;
  }

  return {
    value: source.slice(startOffset, cursor),
    endIndex: cursor,
  };
};

const parseCommandWithMacroArgAndBraceGroup = (
  source: string,
  startOffset: number,
): { value: string; endIndex: number } | null => {
  const command = readControlSequence(source, startOffset);
  if (!command) return null;

  let cursor = skipWhitespaceAndComments(source, command.endIndex);
  if (source[cursor] === '{') {
    const macroGroup = readBalancedGroup(source, cursor);
    if (!macroGroup) return null;
    cursor = macroGroup.endIndex;
  } else {
    const macroName = readControlSequence(source, cursor);
    if (!macroName) return null;
    cursor = macroName.endIndex;
  }

  cursor = skipWhitespaceAndComments(source, cursor);
  const valueGroup = readBalancedGroup(source, cursor);
  if (!valueGroup) return null;

  return {
    value: source.slice(startOffset, valueGroup.endIndex),
    endIndex: valueGroup.endIndex,
  };
};

const parseMacroDefinitionDeclaration = (
  source: string,
  startOffset: number,
): { value: string; endIndex: number } | null => {
  const command = readControlSequence(source, startOffset);
  if (!command) return null;

  let cursor = skipWhitespaceAndComments(source, command.endIndex);
  const macroName = readControlSequence(source, cursor);
  if (!macroName) return null;
  cursor = macroName.endIndex;

  while (cursor < source.length) {
    cursor = skipWhitespaceAndComments(source, cursor);
    if (source[cursor] === '{') {
      break;
    }
    if (source[cursor] === '#') {
      cursor += 1;
      if (cursor < source.length) {
        cursor += 1;
      }
      continue;
    }
    if (source[cursor] === '\\') {
      const token = readControlSequence(source, cursor);
      if (!token) return null;
      cursor = token.endIndex;
      continue;
    }
    cursor += 1;
  }

  const body = readBalancedGroup(source, cursor);
  if (!body) return null;

  return {
    value: source.slice(startOffset, body.endIndex),
    endIndex: body.endIndex,
  };
};

const parseBodyDeclarationCommand = (
  source: string,
  startOffset: number,
  commandName: (typeof TIKZ_BODY_DECLARATION_COMMANDS)[number],
): { value: string; endIndex: number } | null => {
  if (
    commandName === 'newcommand' ||
    commandName === 'renewcommand' ||
    commandName === 'providecommand'
  ) {
    const command = readControlSequence(source, startOffset);
    if (!command) return null;

    let cursor = skipWhitespaceAndComments(source, command.endIndex);
    if (source[cursor] === '*') {
      cursor = skipWhitespaceAndComments(source, cursor + 1);
    }
    if (source[cursor] === '{') {
      const macroGroup = readBalancedGroup(source, cursor);
      if (!macroGroup) return null;
      cursor = macroGroup.endIndex;
    } else {
      const macroName = readControlSequence(source, cursor);
      if (!macroName) return null;
      cursor = macroName.endIndex;
    }

    cursor = skipWhitespaceAndComments(source, cursor);
    if (source[cursor] === '[') {
      const argsCount = readBalancedBracketGroup(source, cursor);
      if (!argsCount) return null;
      cursor = skipWhitespaceAndComments(source, argsCount.endIndex);
      if (source[cursor] === '[') {
        const defaultValue = readBalancedBracketGroup(source, cursor);
        if (!defaultValue) return null;
        cursor = defaultValue.endIndex;
      }
    }

    cursor = skipWhitespaceAndComments(source, cursor);
    const body = readBalancedGroup(source, cursor);
    if (!body) return null;

    return {
      value: source.slice(startOffset, body.endIndex),
      endIndex: body.endIndex,
    };
  }

  if (
    commandName === 'def' ||
    commandName === 'gdef'
  ) {
    return parseMacroDefinitionDeclaration(source, startOffset);
  }

  if (commandName === 'definecolor') {
    return parseDeclarationCommandWithBraceGroups(source, startOffset, 3);
  }

  if (
    commandName === 'pgfmathsetmacro' ||
    commandName === 'pgfmathsetlengthmacro'
  ) {
    return parseCommandWithMacroArgAndBraceGroup(source, startOffset);
  }

  if (commandName === 'colorlet') {
    return parseDeclarationCommandWithBraceGroups(source, startOffset, 2);
  }

  if (commandName === 'tikzset') {
    return parseDeclarationCommandWithBraceGroups(source, startOffset, 1);
  }

  return null;
};

const extractDocumentBody = (tex: string): string => {
  const beginMatch = tex.match(/\\begin\{document\}/);
  if (!beginMatch || beginMatch.index === undefined) {
    return '';
  }
  const bodyStart = beginMatch.index + beginMatch[0].length;
  const endIndex = tex.indexOf('\\end{document}', bodyStart);
  if (endIndex === -1) {
    return '';
  }
  return tex.slice(bodyStart, endIndex);
};

const extractBodyTikzDeclarations = (tex: string): string => {
  const body = extractDocumentBody(tex);
  if (!body) {
    return '';
  }
  const bodyWithoutTikzBlocks = body.replace(
    /\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g,
    '\n',
  );

  const declarations: string[] = [];
  const uniqueDeclarations = new Set<string>();

  for (const match of bodyWithoutTikzBlocks.matchAll(TIKZ_BODY_DECLARATION_PATTERN)) {
    if (match.index === undefined) continue;
    const commandName = match[1] as (typeof TIKZ_BODY_DECLARATION_COMMANDS)[number];
    const commandOffsetInMatch = match[0].indexOf('\\');
    if (commandOffsetInMatch < 0) continue;
    const commandStart = match.index + commandOffsetInMatch;
    const parsed = parseBodyDeclarationCommand(bodyWithoutTikzBlocks, commandStart, commandName);
    if (!parsed) continue;

    const declaration = parsed.value.trim();
    if (!declaration || uniqueDeclarations.has(declaration)) continue;
    uniqueDeclarations.add(declaration);
    declarations.push(declaration);
  }

  return declarations.join('\n');
};

const extractFigureMacroDefinitions = (tex: string): Map<string, FigureMacroDefinition> => {
  const definitions = new Map<string, FigureMacroDefinition>();
  const headerPattern = /\\newcommand(?:\*)?\s*\{\\([A-Za-z@][A-Za-z0-9@]*)\}/g;

  for (const match of tex.matchAll(headerPattern)) {
    if (match.index === undefined) continue;

    const macroName = match[1];
    if (!macroName) continue;

    let cursor = skipWhitespaceAndComments(tex, match.index + match[0].length);
    let argCount = 0;
    if (tex[cursor] === '[') {
      const argCountGroup = readBalancedBracketGroup(tex, cursor);
      if (!argCountGroup) continue;
      const parsedArgCount = Number(argCountGroup.content.trim());
      if (!Number.isFinite(parsedArgCount) || parsedArgCount < 0) continue;
      argCount = parsedArgCount;
      cursor = skipWhitespaceAndComments(tex, argCountGroup.endIndex);
      if (tex[cursor] === '[') {
        const defaultArgGroup = readBalancedBracketGroup(tex, cursor);
        if (!defaultArgGroup) continue;
        cursor = skipWhitespaceAndComments(tex, defaultArgGroup.endIndex);
      }
    }

    if (argCount > 1 || tex[cursor] !== '{') {
      continue;
    }

    const bodyOpenIndex = cursor;
    const body = readBalancedGroup(tex, bodyOpenIndex);
    if (!body) continue;

    let end = body.endIndex;
    while (tex[end] === '%' || tex[end] === '\r' || tex[end] === '\n') {
      end += 1;
    }

    const isLegacyFigMacro = argCount === 1 && macroName.startsWith('fig');
    const isZeroArgTikzMacro = argCount === 0 && /\\begin\{tikzpicture\}/.test(body.content);
    if (!isLegacyFigMacro && !isZeroArgTikzMacro) {
      continue;
    }

    definitions.set(macroName, {
      argCount,
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

const unwrapResizeboxAroundTikzBlocks = (tex: string): string => {
  const command = '\\resizebox';
  let next = '';
  let cursor = 0;

  while (cursor < tex.length) {
    const foundAt = tex.indexOf(command, cursor);
    if (foundAt === -1) {
      next += tex.slice(cursor);
      break;
    }

    next += tex.slice(cursor, foundAt);

    let parseCursor = skipWhitespaceAndComments(tex, foundAt + command.length);
    const firstArg = readBalancedGroup(tex, parseCursor);
    if (!firstArg) {
      next += command;
      cursor = foundAt + command.length;
      continue;
    }

    parseCursor = skipWhitespaceAndComments(tex, firstArg.endIndex);
    const secondArg = readBalancedGroup(tex, parseCursor);
    if (!secondArg) {
      next += command;
      cursor = foundAt + command.length;
      continue;
    }

    parseCursor = skipWhitespaceAndComments(tex, secondArg.endIndex);
    const bodyArg = readBalancedGroup(tex, parseCursor);
    if (!bodyArg) {
      next += command;
      cursor = foundAt + command.length;
      continue;
    }

    const original = tex.slice(foundAt, bodyArg.endIndex);
    if (/\\begin\{tikzpicture\}/.test(bodyArg.content)) {
      next += bodyArg.content.trim();
    } else {
      next += original;
    }
    cursor = bodyArg.endIndex;
  }

  return next;
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

    const replacement = replacer(argument.content);
    // Trailing '%' in expanded macro bodies can comment out closing braces on the same line.
    next += replacement.endsWith('%') ? `${replacement}\n` : replacement;
    cursor = argument.endIndex;
  }

  return next;
};

const replaceZeroArgMacroInvocations = (
  tex: string,
  macroName: string,
  replacement: string,
): string => {
  const safeReplacement = replacement.endsWith('%') ? `${replacement}\n` : replacement;
  return tex.replace(new RegExp(`\\\\${escapeRegExp(macroName)}(?![A-Za-z@])`, 'g'), safeReplacement);
};

const extractNameHeadings = (tex: string): { modifiedTex: string; headings: NameHeading[] } => {
  const invocation = '\\name';
  const headings: NameHeading[] = [];
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

    const placeholder = `${TITLE_PLACEHOLDER_PREFIX}${headings.length}`;
    headings.push({
      placeholder,
      titleLatex: argument.content.trim(),
    });
    next += `\n${placeholder}\n`;
    cursor = argument.endIndex;
  }

  return { modifiedTex: next, headings };
};

const normalizeSiunitxForMathJax = (tex: string): string => {
  const replaceUnit = (unit: string): string => {
    const normalized = unit.trim();
    if (!normalized || normalized === '1') {
      return '1';
    }
    return `\\mathrm{${normalized}}`;
  };

  return tex
    .replace(/\\num\{([^{}]+)\}/g, (_, numberValue: string) => numberValue.trim())
    .replace(/\\si\{([^{}]+)\}/g, (_, unit: string) => replaceUnit(unit))
    .replace(
      /\\SI\{([^{}]+)\}\{([^{}]+)\}/g,
      (_, numberValue: string, unit: string) => `${numberValue.trim()}\\,${replaceUnit(unit)}`,
    );
};

const normalizeMhchemForMathJax = (tex: string): string => {
  const normalizeChemicalFormula = (formula: string): string => {
    const withSubscripts = formula.replace(
      /([A-Za-z\)\]])(\d+)/g,
      (_, base: string, digits: string) => `${base}_{${digits}}`,
    );
    const withCharge = withSubscripts.replace(
      /([A-Za-z0-9\}\)\]])([+-])(?![A-Za-z0-9])/g,
      (_, base: string, charge: string) => `${base}^{${charge}}`,
    );
    return withCharge.trim();
  };

  return tex.replace(/\\ce\{([^{}]+)\}/g, (_, formulaRaw: string) => {
    const formula = normalizeChemicalFormula(formulaRaw);
    if (!formula) {
      return '';
    }
    return `\\(\\mathrm{${formula}}\\)`;
  });
};

const expandFigureMacros = (tex: string): string => {
  const definitions = extractFigureMacroDefinitions(tex);
  if (definitions.size === 0) {
    return tex;
  }

  let next = removeFigureMacroDefinitions(tex, definitions);
  for (const [macroName, definition] of definitions) {
    const expandedBody = unwrapResizebox(definition.body);
    if (definition.argCount === 0) {
      next = replaceZeroArgMacroInvocations(next, macroName, expandedBody);
      continue;
    }
    next = replaceMacroInvocations(next, macroName, (argument) => expandedBody.replaceAll('#1', argument.trim()));
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

const buildFigureRefToken = (label: string): string =>
  `${FIGURE_REF_TOKEN_PREFIX}${label}${FIGURE_REF_TOKEN_SUFFIX}`;

const buildFigureAutorefToken = (label: string): string =>
  `${FIGURE_AUTOREF_TOKEN_PREFIX}${label}${FIGURE_REF_TOKEN_SUFFIX}`;

const normalizeLatexTextDashes = (latex: string): string => {
  const mathRanges = buildMathRanges(latex);
  const normalizeTextSegment = (segment: string): string =>
    segment
      .replace(/---/g, '—')
      .replace(/--/g, '–');

  if (mathRanges.length === 0) {
    return normalizeTextSegment(latex);
  }

  let next = '';
  let cursor = 0;
  for (const range of mathRanges) {
    if (cursor < range.start) {
      next += normalizeTextSegment(latex.slice(cursor, range.start));
    }
    next += latex.slice(range.start, range.end);
    cursor = range.end;
  }
  if (cursor < latex.length) {
    next += normalizeTextSegment(latex.slice(cursor));
  }

  return next;
};

const normalizeLatexInlineForHtml = (latex: string): string =>
  escapeHtml(
    normalizeLatexTextDashes(latex)
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

const extractInlineTikzDeclarationsBeforeBlock = (source: string, blockStart: number): string => {
  const contextWindowChars = 4000;
  const context = source.slice(Math.max(0, blockStart - contextWindowChars), blockStart);
  const lines = context.split(/\r?\n/);
  const declarations: string[] = [];

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]?.trim();
    if (!line) {
      if (declarations.length > 0) {
        break;
      }
      continue;
    }

    if (line.startsWith('%') || line === '\\begingroup') {
      continue;
    }

    if (TIKZ_INLINE_DECLARATION_LINE_PATTERN.test(line)) {
      declarations.unshift(line);
      continue;
    }

    if (declarations.length > 0) {
      break;
    }
  }

  return declarations.join('\n');
};

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
  const figurePattern =
    /\\begin\{(figure|wrapfigure)\}(?:\[[^\]]*])?(?:\{[^}]*\}\{[^}]*\})?([\s\S]*?)\\end\{\1\}/g;
  const modifiedTex = tex.replace(figurePattern, (match, _env, bodyRaw) => {
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
  const modifiedTex = tex.replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, (match, offset) => {
    const placeholder = `CONTINUUMTIKZPLACEHOLDER${blocks.length}`;
    const blockStart = typeof offset === 'number' ? offset : 0;
    blocks.push({
      placeholder,
      content: match,
      localDeclarations: extractInlineTikzDeclarationsBeforeBlock(tex, blockStart),
    });
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

const buildTikzStandaloneDocument = (
  preamble: string,
  block: string,
  bodyDeclarations = '',
): string => {
  const cleanedPreamble = preamble
    .split(/\r?\n/)
    .filter((line) => !/\\begin\{document\}/.test(line))
    .filter((line) => !/\\end\{document\}/.test(line))
    .join('\n');
  const cleanedBodyDeclarations = bodyDeclarations
    .split(/\r?\n/)
    .filter((line) => !/\\begin\{document\}/.test(line))
    .filter((line) => !/\\end\{document\}/.test(line))
    .join('\n')
    .trim();

  const hasDocumentClass = /\\documentclass(?:\[[^\]]*])?\{[^}]+\}/.test(cleanedPreamble);

  return [
    ...(hasDocumentClass ? [] : ['\\documentclass[a4paper,14pt]{extarticle}']),
    cleanedPreamble,
    '\\begin{document}',
    '\\pagestyle{empty}',
    '\\thispagestyle{empty}',
    ...(cleanedBodyDeclarations ? [cleanedBodyDeclarations] : []),
    block,
    '\\end{document}',
    '',
  ].join('\n');
};

const buildTikzAssetKey = (preamble: string, block: string, bodyDeclarations = ''): string => {
  const hash = createHash('md5')
    .update(TIKZ_RENDER_CACHE_VERSION, 'utf8')
    .update('\n---PREAMBLE---\n', 'utf8')
    .update(preamble, 'utf8')
    .update('\n---BODY-DECLARATIONS---\n', 'utf8')
    .update(bodyDeclarations, 'utf8')
    .update('\n---BLOCK---\n', 'utf8')
    .update(block, 'utf8')
    .update('\n---PDFLATEX-DVI2SVG---\n-output-format=dvi --exact-bbox --font-format=woff\n', 'utf8')
    .digest('hex');
  return `rendering/tikz/${hash}.svg`;
};

const normalizeNumericSuffixControlSequences = (
  declarations: string,
  block: string,
): { declarations: string; block: string } => {
  // Keep original TeX semantics for delimited macros like \def\alpha0{...}.
  // Rewriting such tokens can desync define/use sites across extracted blocks.
  const apply = (source: string): string => source;
  return {
    declarations: apply(declarations),
    block: apply(block),
  };
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
  preamble,
  bodyDeclarations,
  block,
  timeoutMs,
}: {
  storage: WorkerObjectStorageService;
  preamble: string;
  bodyDeclarations: string;
  block: string;
  timeoutMs: number;
}): Promise<{ assetKey: string; contentType: 'image/svg+xml'; logSnippet?: string }> => {
  const assetKey = buildTikzAssetKey(preamble, block, bodyDeclarations);
  if (await storage.objectExists(assetKey)) {
    return { assetKey, contentType: 'image/svg+xml' };
  }

  const compiled = await compileLatexToDvi(
    buildTikzStandaloneDocument(preamble, block, bodyDeclarations),
    {
      timeoutMs,
      tempDirPrefix: 'continuum-tikz-dvi-',
    },
  );
  const converted = await convertDviToSvg(compiled.bytes, {
    timeoutMs,
    tempDirPrefix: 'continuum-tikz-svg-',
  });
  const svg = sanitizeSvg(converted.svg);
  await storage.putObject({
    key: assetKey,
    contentType: 'image/svg+xml',
    body: svg,
    cacheControl: 'public, max-age=31536000, immutable',
  });

  return {
    assetKey,
    contentType: 'image/svg+xml',
    logSnippet: summarizeLatexOutput([compiled.logSnippet ?? '', converted.logSnippet ?? '']),
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
    return `<figure class="unit-html-figure-group"${idAttr}><div class="unit-html-figure-group-grid">${subfigureHtml}</div>${captionHtml}</figure>`;
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

const injectNameHeadings = (html: string, headings: NameHeading[]): string => {
  let next = html;
  for (const heading of headings) {
    const headingHtml = `<h1 class="unit-html-title">${normalizeLatexInlineForHtml(heading.titleLatex)}</h1>`;
    next = next.replace(new RegExp(`<p>\\s*${heading.placeholder}\\s*</p>`, 'g'), headingHtml);
    next = next.replaceAll(heading.placeholder, headingHtml);
  }
  return next;
};

const replaceFigureReferences = (html: string, figures: FigureDescriptor[]): string => {
  let next = html;
  const references = buildFigureReferenceMap(figures);

  for (const [label, refText] of references) {
    const escapedLabel = escapeRegExp(label);
    const escapedLabelForHtml = escapeHtml(label);
    const escapedRefText = escapeHtml(refText);
    const linkHtml = `<a href="#${escapedLabelForHtml}" data-reference="${escapedLabelForHtml}">${escapedRefText}</a>`;
    const anchorPattern = new RegExp(
      `<a([^>]*?(?:href="#${escapedLabel}"|data-reference="${escapedLabel}")[^>]*)>\\s*\\[${escapedLabel}\\]\\s*<\\/a>`,
      'g',
    );
    next = next.replace(anchorPattern, `<a$1>${escapedRefText}</a>`);
    next = next.replace(new RegExp(`\\[${escapedLabel}\\]`, 'g'), linkHtml);
    next = next.replace(new RegExp(escapeRegExp(buildFigureRefToken(label)), 'g'), linkHtml);
    next = next.replace(
      new RegExp(escapeRegExp(buildFigureAutorefToken(label)), 'g'),
      `рис. ${linkHtml}`,
    );
  }

  return next;
};

const buildFigureReferenceMap = (figures: FigureDescriptor[]): Map<string, string> => {
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
  return references;
};

const buildTableReferenceMap = (tex: string): Map<string, string> => {
  const references = new Map<string, string>();
  let tableCounter = 0;
  const tableEnvPattern = /\\begin\{table\*?\}(?:\[[^\]]*])?([\s\S]*?)\\end\{table\*?\}/g;

  for (const match of tex.matchAll(tableEnvPattern)) {
    const body = match[1] ?? '';
    const bodyLabels = extractLabels(body);
    if (bodyLabels.length === 0) {
      continue;
    }
    const referenceText = String(++tableCounter);
    for (const label of bodyLabels) {
      references.set(label, referenceText);
    }
  }

  return references;
};

const splitEquationRows = (body: string): string[] => {
  const rows: string[] = [];
  let rowStart = 0;

  for (let index = 0; index < body.length - 1; index += 1) {
    if (body[index] !== '\\' || body[index + 1] !== '\\') {
      continue;
    }
    if (index > 0 && body[index - 1] === '\\') {
      continue;
    }

    rows.push(body.slice(rowStart, index));
    rowStart = index + 2;
    index += 1;
  }

  rows.push(body.slice(rowStart));
  return rows;
};

const extractLabels = (source: string): string[] =>
  Array.from(source.matchAll(/\\label\{([^}]+)\}/g), (match) => match[1]).filter(Boolean);

const buildEquationReferenceMap = (tex: string): Map<string, string> => {
  const references = new Map<string, string>();
  let equationCounter = 0;
  const equationEnvPattern =
    /\\begin\{(equation\*?|align\*?|alignat\*?|gather\*?|multline\*?|flalign\*?)\}(?:\{[^}]*\})?([\s\S]*?)\\end\{\1\}/g;
  const multilineEnvs = new Set(['align', 'alignat', 'gather', 'multline', 'flalign']);

  for (const match of tex.matchAll(equationEnvPattern)) {
    const environment = match[1] ?? '';
    const body = match[2] ?? '';
    if (!environment || environment.endsWith('*')) {
      continue;
    }

    const environmentName = environment.replace('*', '');
    const bodyLabels = extractLabels(body);
    if (bodyLabels.length === 0) {
      continue;
    }

    if (!multilineEnvs.has(environmentName)) {
      const customTag = body.match(/\\tag\*?\{([^}]+)\}/)?.[1]?.trim() ?? null;
      const referenceText = customTag || String(++equationCounter);
      for (const label of bodyLabels) {
        references.set(label, referenceText);
      }
      continue;
    }

    let assignedInRows = false;
    for (const row of splitEquationRows(body)) {
      const rowLabels = extractLabels(row);
      if (rowLabels.length === 0) {
        continue;
      }
      if (/\\(?:nonumber|notag)\b/.test(row)) {
        continue;
      }

      const customTag = row.match(/\\tag\*?\{([^}]+)\}/)?.[1]?.trim() ?? null;
      const referenceText = customTag || String(++equationCounter);
      for (const label of rowLabels) {
        references.set(label, referenceText);
      }
      assignedInRows = true;
    }

    if (!assignedInRows) {
      const customTag = body.match(/\\tag\*?\{([^}]+)\}/)?.[1]?.trim() ?? null;
      const referenceText = customTag || String(++equationCounter);
      for (const label of bodyLabels) {
        references.set(label, referenceText);
      }
    }
  }

  const bracketDisplayPattern = /\\\[((?:[\s\S]*?))\\\]/g;
  for (const match of tex.matchAll(bracketDisplayPattern)) {
    const body = match[1] ?? '';
    const bodyLabels = extractLabels(body);
    if (bodyLabels.length === 0) continue;
    if (/\\(?:nonumber|notag)\b/.test(body)) continue;
    const customTag = body.match(/\\tag\*?\{([^}]+)\}/)?.[1]?.trim() ?? null;
    const referenceText = customTag || String(++equationCounter);
    for (const label of bodyLabels) {
      references.set(label, referenceText);
    }
  }

  const dollarDisplayPattern = /\$\$([\s\S]*?)\$\$/g;
  for (const match of tex.matchAll(dollarDisplayPattern)) {
    const body = match[1] ?? '';
    const bodyLabels = extractLabels(body);
    if (bodyLabels.length === 0) continue;
    if (/\\(?:nonumber|notag)\b/.test(body)) continue;
    const customTag = body.match(/\\tag\*?\{([^}]+)\}/)?.[1]?.trim() ?? null;
    const referenceText = customTag || String(++equationCounter);
    for (const label of bodyLabels) {
      references.set(label, referenceText);
    }
  }

  return references;
};

const buildReferenceMap = (
  equationReferences: Map<string, string>,
  figureReferences: Map<string, string>,
  tableReferences: Map<string, string>,
): Map<string, string> => {
  const references = new Map<string, string>();

  for (const [label, refText] of equationReferences) {
    references.set(label, refText);
  }
  for (const [label, refText] of figureReferences) {
    references.set(label, refText);
  }
  for (const [label, refText] of tableReferences) {
    references.set(label, refText);
  }

  return references;
};

const stripHtmlTags = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const extractHtmlAttribute = (attributes: string, attributeName: string): string | null => {
  const escapedAttribute = escapeRegExp(attributeName);
  const pattern = new RegExp(`${escapedAttribute}\\s*=\\s*"([^"]+)"`, 'i');
  const match = attributes.match(pattern);
  return match?.[1]?.trim() || null;
};

const injectTableCaptionNumbers = (
  html: string,
  tableReferences: Map<string, string>,
): string => {
  let sequentialCounter = 0;

  return html.replace(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi, (tableHtml, tableAttributes, tableBody) => {
    const captionMatch = tableBody.match(/<caption\b([^>]*)>([\s\S]*?)<\/caption>/i);
    if (!captionMatch) {
      return tableHtml;
    }

    const captionAttributes = captionMatch[1] ?? '';
    const captionContent = captionMatch[2] ?? '';
    const captionText = stripHtmlTags(captionContent);
    const hasNumberPrefix =
      /unit-html-table-number/.test(captionContent) ||
      /^(?:таблица|table)\s+[0-9]+[.:]?\s*/i.test(captionText);
    if (hasNumberPrefix) {
      return tableHtml;
    }
    sequentialCounter += 1;

    const tableId = extractHtmlAttribute(tableAttributes ?? '', 'id');
    const captionId = extractHtmlAttribute(captionAttributes, 'id');
    const resolvedReference =
      (tableId ? tableReferences.get(tableId) : null) ??
      (captionId ? tableReferences.get(captionId) : null) ??
      String(sequentialCounter);

    const normalizedCaptionContent = captionContent.trim();
    const numberedCaption = `<caption${captionAttributes}><span class="unit-html-table-number">Таблица ${escapeHtml(
      resolvedReference,
    )}. </span>${normalizedCaptionContent}</caption>`;

    return tableHtml.replace(captionMatch[0], numberedCaption);
  });
};

const buildMathRanges = (tex: string): Array<{ start: number; end: number }> => {
  const ranges: Array<{ start: number; end: number }> = [];
  const patterns = [
    /\\begin\{(equation\*?|align\*?|alignat\*?|gather\*?|multline\*?|flalign\*?|math|displaymath)\}[\s\S]*?\\end\{\1\}/g,
    /\\\[[\s\S]*?\\\]/g,
    /\\\([\s\S]*?\\\)/g,
    /(?<!\\)\$\$[\s\S]*?(?<!\\)\$\$/g,
    /(?<!\\)\$(?!\$)[\s\S]*?(?<!\\)\$(?!\$)/g,
  ];

  for (const pattern of patterns) {
    for (const match of tex.matchAll(pattern)) {
      if (match.index === undefined || !match[0]) {
        continue;
      }
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  if (ranges.length <= 1) {
    return ranges;
  }

  ranges.sort((left, right) => left.start - right.start);
  const merged: Array<{ start: number; end: number }> = [ranges[0]];
  for (let index = 1; index < ranges.length; index += 1) {
    const current = ranges[index];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
      continue;
    }
    merged.push(current);
  }

  return merged;
};

const isOffsetInsideRanges = (offset: number, ranges: Array<{ start: number; end: number }>): boolean =>
  ranges.some((range) => offset >= range.start && offset < range.end);

const resolveLatexReferencesInTex = (
  tex: string,
  references: Map<string, string>,
  equationReferences: Map<string, string>,
  options?: {
    preserveFigureRefTokens?: boolean;
  },
): string => {
  const preserveFigureRefTokens = options?.preserveFigureRefTokens ?? false;
  const mathRanges = buildMathRanges(tex);
  const resolveByLabel = (label: string): string | null => {
    const reference = references.get(label);
    return reference ? reference.trim() : null;
  };
  const commandPattern = /\\(eqref|autoref|ref)\{([^}]+)\}/g;
  let withRefs = '';
  let cursor = 0;

  for (const match of tex.matchAll(commandPattern)) {
    if (match.index === undefined) {
      continue;
    }

    const fullMatch = match[0] ?? '';
    const command = match[1];
    const label = match[2] ?? '';
    const start = match.index;
    const end = start + fullMatch.length;
    const resolved = resolveByLabel(label);
    const insideMath = isOffsetInsideRanges(start, mathRanges);
    let replacement = fullMatch;

    if (resolved) {
      if (command === 'eqref') {
        replacement = `(${resolved})`;
      } else if (command === 'autoref') {
        if (label.startsWith('fig:')) {
          replacement =
            preserveFigureRefTokens && !insideMath
              ? buildFigureAutorefToken(label)
              : `рис. ${resolved}`;
        } else if (label.startsWith('eq:')) {
          replacement = `(${resolved})`;
        } else if (label.startsWith('tab:')) {
          replacement = `табл. ${resolved}`;
        } else {
          replacement = resolved;
        }
      } else if (command === 'ref') {
        replacement =
          preserveFigureRefTokens && label.startsWith('fig:') && !insideMath
            ? buildFigureRefToken(label)
            : resolved;
      }
    }

    withRefs += tex.slice(cursor, start);
    withRefs += replacement;
    cursor = end;
  }

  withRefs += tex.slice(cursor);

  const taggedEquationRefs = new Set<string>();
  return withRefs.replace(/\\label\{([^}]+)\}/g, (match, label: string) => {
    const equationRef = equationReferences.get(label)?.trim();
    if (!equationRef) {
      return match;
    }
    if (taggedEquationRefs.has(equationRef)) {
      return '';
    }
    taggedEquationRefs.add(equationRef);
    return `\\tag{${equationRef}}`;
  });
};

const replaceResolvedReferencesInHtml = (html: string, references: Map<string, string>): string => {
  let next = html;
  for (const [label, refText] of references) {
    const escapedLabel = escapeRegExp(label);
    const escapedRefText = escapeHtml(refText);
    const anchorPattern = new RegExp(
      `<a([^>]*?(?:href="#${escapedLabel}"|data-reference="${escapedLabel}")[^>]*)>\\s*(?:\\[${escapedLabel}\\]|\\(\\?\\?\\?\\)|\\?\\?\\?)\\s*<\\/a>`,
      'g',
    );
    next = next.replace(anchorPattern, `<a$1>${escapedRefText}</a>`);
    next = next.replace(new RegExp(`\\[${escapedLabel}\\]`, 'g'), escapedRefText);
  }
  return next;
};

export const renderLatexToHtml = async (
  texSource: string,
  storage: WorkerObjectStorageService,
): Promise<LatexHtmlRenderResult> => {
  const normalizedTex = normalizeLatexSource(texSource);
  const wrappedTex = ensurePdflatexDocumentEnvelope(normalizedTex);
  assertPdflatexCompatible(wrappedTex);
  const texWithoutResizebox = unwrapResizeboxAroundTikzBlocks(expandFigureMacros(wrappedTex));
  const { modifiedTex: tex, headings } = extractNameHeadings(texWithoutResizebox);
  const timeoutMs = resolveLatexTimeoutMs();
  const tempDir = await fs.mkdtemp(join(tmpdir(), 'continuum-tex-html-'));
  const logChunks: string[] = [];

  try {
    const preamble = extractPreamble(tex);
    const bodyDeclarations = extractBodyTikzDeclarations(tex);
    const { modifiedTex: texWithTikzPlaceholders, blocks } = extractTikzBlocks(tex);
    const { modifiedTex, figures } = extractFigures(texWithTikzPlaceholders);
    const equationReferences = buildEquationReferenceMap(modifiedTex);
    const figureReferences = buildFigureReferenceMap(figures);
    const tableReferences = buildTableReferenceMap(modifiedTex);
    const references = buildReferenceMap(equationReferences, figureReferences, tableReferences);
    const resolvedTex = resolveLatexReferencesInTex(modifiedTex, references, equationReferences, {
      preserveFigureRefTokens: true,
    });
    const pandocInputTex = normalizeMhchemForMathJax(normalizeSiunitxForMathJax(resolvedTex));
    const assetRefs: UnitHtmlAssetRef[] = [];

    for (const block of blocks) {
      const resolvedBlockContent = resolveLatexReferencesInTex(
        block.content,
        references,
        equationReferences,
      );
      const mergedDeclarations = [bodyDeclarations, block.localDeclarations]
        .filter((chunk) => chunk.trim().length > 0)
        .join('\n');
      const normalizedTikzInput = normalizeNumericSuffixControlSequences(
        mergedDeclarations,
        resolvedBlockContent,
      );
      const compiled = await compileTikzToSvg({
        storage,
        preamble,
        bodyDeclarations: normalizedTikzInput.declarations,
        block: normalizedTikzInput.block,
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

    await fs.writeFile(join(tempDir, 'render-input.tex'), pandocInputTex, 'utf8');
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
      replaceResolvedReferencesInHtml(
        replaceFigureReferences(
          injectTableCaptionNumbers(
            injectNameHeadings(
              injectFigurePlaceholders(injectExtractedFigures(rawHtml, figures), assetRefs),
              headings,
            ),
            tableReferences,
          ),
          figures,
        ),
        references,
      ),
    );
    const logSnippet = summarizeLatexOutput(logChunks);

    return {
      html,
      assetRefs,
      ...(logSnippet ? { logSnippet } : null),
    };
  } catch (error) {
    if (error instanceof LatexRuntimeError) {
      throw new LatexCompileError(
        error.code,
        error.message,
        error.log,
        error.logSnippet,
        error.logTruncated,
        error.logLimitBytes,
      );
    }
    if ((error as { code?: string } | null)?.code === 'ENOENT') {
      throw new LatexCompileError(
        'LATEX_RUNTIME_MISSING',
        'pandoc binary is not available in worker runtime environment',
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
  buildTikzStandaloneDocument,
  extractBodyTikzDeclarations,
  extractInlineTikzDeclarationsBeforeBlock,
  normalizeNumericSuffixControlSequences,
  extractTikzBlocks,
  extractPreamble,
  expandFigureMacros,
  unwrapResizeboxAroundTikzBlocks,
  extractNameHeadings,
  normalizeSiunitxForMathJax,
  normalizeMhchemForMathJax,
  extractFigures,
  injectFigurePlaceholders,
  injectExtractedFigures,
  injectNameHeadings,
  injectTableCaptionNumbers,
  replaceFigureReferences,
  buildEquationReferenceMap,
  buildTableReferenceMap,
  resolveLatexReferencesInTex,
  replaceResolvedReferencesInHtml,
};
