import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, copyFile, chmod, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseAssessmentMarkdown } from '../../packages/shared/src/assessment-markdown.ts';
import { privateWorkspace } from './client.mjs';
import { bindReview } from './evaluation.mjs';
const run = promisify(execFile);
const commands = new Set(['frac','dfrac','tfrac','sqrt','Delta','delta','alpha','beta','gamma','theta','pi','omega','lambda','mu','rho','nu','tau','sigma','phi','varepsilon','cdot','times','text','mathrm','left','right','quad','qquad','approx','min','max','sin','cos','tan','vec','ge','le','geq','leq','ne','neq','to','Rightarrow','pm','ldots','lvert','rvert','vert', ' ', ',', ';', ':', '!', '{', '}']);
export const texText = value => value.replace(/[\\{}%$&#_^~]/g, char => ({'\\':'\\textbackslash{}','{':'\\{','}':'\\}','%':'\\%','$':'\\$','&':'\\&','#':'\\#','_':'\\_','^':'\\textasciicircum{}','~':'\\textasciitilde{}'}[char]));
export function safeMath(value) {
  if (value.includes('^^') || /[%#$]/.test(value) || [...value.matchAll(/\\([A-Za-z]+|[^A-Za-z])/g)].some(match => !commands.has(match[1]))) throw new Error('Недопустимая TeX-команда в разборе.');
  return value;
}
export function texMarkdown(value) {
  function nodes(items) {
    return items.map(node => {
      if (node.kind === 'text') return texText(node.value);
      if (node.kind === 'math') return node.display ? `\\[${safeMath(node.value)}\\]` : `$${safeMath(node.value)}$`;
      if (node.kind !== 'element') throw new Error('PDF-разбор допускает текст и формулы; внешние ссылки/рисунки не включаются.');
      const content = nodes(node.children);
      if (node.tag === 'p') return `${content}\n\\par\n`;
      if (node.tag === 'strong') return `\\textbf{${content}}`;
      if (node.tag === 'em') return `\\emph{${content}}`;
      if (node.tag === 'br') return '\\\\';
      throw new Error('Недопустимый элемент PDF-разбора.');
    }).join('');
  }
  return nodes(parseAssessmentMarkdown(value));
}
export function reviewTex(value, source, references) {
  const { review, reference, decision } = bindReview(value, source, references);
  const color = decision.points === 2 ? 'success' : decision.points === 1 ? 'amber' : decision.points === 0 ? 'danger' : 'muted';
  const grade = decision.points === null ? '—' : `${decision.points} / 2`;
  const sections = [['laws','Физическая модель'],['math','Преобразования и расчёт'],['answer','Ответ и единицы'], ...['notation','relevance'].filter(key => review.findings[key].state !== 'met').map(key => [key,key === 'notation' ? 'Обозначения' : 'Лишние записи'])];
  const findings = sections.map(([key,label]) => `\\textbf{${label}.} ${texMarkdown(review.findings[key].comment)}`).join('\n');
  return String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[margin=18mm]{geometry}
\usepackage{fontspec}
\setmainfont{Arial}
\usepackage[russian]{babel}
\usepackage{amsmath,amssymb,xcolor}
\definecolor{ink}{HTML}{202936}
\definecolor{muted}{HTML}{6F7785}
\definecolor{accent}{HTML}{425F96}
\definecolor{border}{HTML}{D8DDE6}
\definecolor{success}{HTML}{18765C}
\definecolor{amber}{HTML}{985D08}
\definecolor{danger}{HTML}{B13D38}
\color{ink}
\setlength{\parindent}{0pt}
\setlength{\parskip}{5pt}
\setlength{\abovedisplayskip}{7pt}
\setlength{\belowdisplayskip}{7pt}
\linespread{1.05}
\pagestyle{empty}
\newcommand{\sect}[1]{\vspace{7pt}{\large\bfseries #1}\par\vspace{1pt}}
\begin{document}
{\small\color{accent}\textbf{КОНТИНУУМ}}\par
{\color{border}\rule{\linewidth}{0.5pt}}\par
\begin{minipage}[t]{0.79\linewidth}
{\LARGE\bfseries ${texText(String(source.number))}. ${texText(source.title)}}\par
{\small\color{muted}${texText(source.source ?? '')} · ЕГЭ, задание 22}
\end{minipage}\hfill
\begin{minipage}[t]{0.17\linewidth}\raggedleft
{\fontsize{25}{29}\selectfont\bfseries\color{${color}}${texText(grade)}}\par
{\small\color{muted}${decision.points === null ? 'проверка вручную' : 'балла'}}
\end{minipage}\par\vspace{8pt}
${texMarkdown(review.summary)}
\sect{В вашем решении}
${texMarkdown(review.transcription)}
\sect{Почему такой балл}
${findings}
\sect{Возможное решение}
${texMarkdown(reference.solution)}
${review.advice.length ? `\\sect{Что исправить}\n${review.advice.map(item => texMarkdown(item)).join('\n')}` : ''}
\end{document}
`;
}
export async function renderReviewPdf(value, source, references, pdfPath) {
  const tex = reviewTex(value, source, references);
  await privateWorkspace(dirname(pdfPath));
  const work = await mkdtemp(join(dirname(pdfPath), '.review-build-'));
  try {
    await writeFile(join(work, 'review.tex'), tex, { mode: 0o600 });
    await run('xelatex', ['-no-shell-escape','-interaction=nonstopmode','-halt-on-error','review.tex'], { cwd: work, timeout: 60000, maxBuffer: 2*1024*1024, env: { ...process.env, openin_any: 'p', openout_any: 'p' } });
    await copyFile(join(work, 'review.pdf'), pdfPath, constants.COPYFILE_EXCL);
    await chmod(pdfPath, 0o600);
    return pdfPath;
  } finally { await rm(work, { recursive: true, force: true }); }
}
