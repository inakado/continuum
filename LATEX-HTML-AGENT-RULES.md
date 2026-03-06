# LaTeX HTML Agent Rules

Назначение: практические правила для агента, который пишет/правит TeX под наш pipeline `LaTeX -> HTML` (Pandoc + TikZ->SVG).
Основано на рабочих шаблонах `reference-1.tex`, `reference-2.tex` и текущем рендерере в `apps/worker/src/latex-html/render-latex-to-html.ts`.

## 1. Цель и границы

- Не менять физический смысл теории.
- Сохранять формулы, таблицы, подписи и рисунки.
- Делать TeX, который стабильно компилируется в PDF и предсказуемо рендерится в HTML.
- Писать верстку без учебно-служебного мусора (задачи/литература/лишние шапки) в reference-файлах теории.

## 2. Базовый стиль reference-файла

- Использовать один заголовок темы через `\name{...}`.
- Не добавлять нумерацию страниц и колонтитулы.
- Блоки определений/замечаний оформлять согласованными макросами (`\DEF`, `\opr`, ...).
- Комментарии:
  - удалять смысловые `% ...`;
  - оставлять только технические `%`, которые нужны для корректной TeX-склейки.

## 3. Пакеты: что держим, что избегаем

Рекомендуемый минимум (как в `reference-1/2`):

- `cmap`, `fontenc`, `inputenc`, `babel`
- `enumitem`, `indentfirst`
- `amsmath`, `amsfonts`, `amssymb`, `amsthm`, `mathtools`
- `siunitx`, `mhchem`
- `hyperref`
- `graphicx`, `xcolor`, `caption`, `subcaption`, `float`, `wrapfig`, `booktabs`
- `tikz`, `pgfplots`, `tcolorbox`

Избегать в материалах, идущих в HTML-рендер:

- `pdfpages`, `svg`, `fontspec`, `unicode-math`, `polyglossia`, `minted`, `newcomputermodern`
- `\includesvg`, `\tikzexternalize`, `\directlua`
- font-команды типа `\setmainfont`, `\setmathfont`, `\defaultfontfeatures`

## 4. Рисунки (TikZ) — обязательные правила

- Основной паттерн: `\newcommand{\Tikz...}{\begin{tikzpicture}...\end{tikzpicture}}`.
- Вставка в документ:
  - `figure`/`wrapfigure`, при необходимости `subfigure`;
  - обязательно `\caption{...}` и `\label{fig:...}`.
- Если используется `\resizebox`, оборачивать только TikZ-контент (рендер это поддерживает).
- Для подрисунков: отдельные `\label{fig:...a}`, `\label{fig:...b}` при необходимости ссылок.

Рекомендация по макросам:

- Предпочитать zero-arg TikZ макросы (`\newcommand{\TikzName}{...}`).
- Legacy one-arg fig-макросы допустимы, но только в простом виде.

## 5. Таблицы — обязательные правила

- Всегда:
  - `\begin{table}[H] ... \caption{...} \label{tab:...} ... \end{table}`
  - подпись перед `\label`.
- Для линий таблицы использовать `booktabs` (`\toprule`, `\midrule`, `\bottomrule`).
- Ссылки в тексте только через `\ref{tab:...}` или `\autoref{tab:...}`.
- В HTML префикс `Таблица N.` добавляется автоматически рендерером.

## 6. Формулы и ссылки

- Префиксы label:
  - `eq:*` для формул,
  - `fig:*` для рисунков,
  - `tab:*` для таблиц.
- Для формул использовать `\eqref{eq:...}`.
- Для рисунков/таблиц использовать `\ref{...}` или `\autoref{...}`.
- Поддерживаемые авто-замены в HTML:
  - `\autoref{fig:*}` -> `рис. N`
  - `\autoref{tab:*}` -> `табл. N`
  - `\eqref{eq:*}` -> `(N)`

## 7. Единицы и химия в HTML

- Разрешено и рекомендуется:
  - `\num{...}`
  - `\si{...}`
  - `\SI{...}{...}`
  - `\ce{...}`
- Эти команды нормализуются в pipeline для MathJax-совместимого HTML.

## 8. Что чаще всего ломает HTML-рендер

- Отсутствует `\caption`/`\label` у figure/table.
- Непоследовательные префиксы label (`fig:`/`tab:`/`eq:`).
- Слишком экзотические TeX-конструкции внутри подписи.
- Пакеты/команды из списка запрещённых для standalone TikZ.
- Макросы с нетипичной сигнатурой, которые не раскрываются на этапе preprocessing.

## 9. Мини-чеклист перед публикацией

1. PDF компилируется без фатальных ошибок.
2. Все `\ref/\autoref/\eqref` в теории резолвятся.
3. У каждой таблицы есть `\caption + \label{tab:*}`.
4. У каждого ключевого рисунка есть `\caption + \label{fig:*}`.
5. В HTML отображаются SVG-рисунки, подписи и номера.
6. В HTML нет «сырых» `\si`, `\SI`, `\ce`.

## 10. Рекомендованный каркас нового reference

```tex
\documentclass[14pt,a4paper,oneside]{extreport}
% пакеты из согласованного минимума

\newcommand{\name}[1]{...}
\newcommand{\DEF}[2]{...}
\newcommand{\opr}[3]{...}

% TikZ-макросы
\newcommand{\TikzExample}{%
\begin{tikzpicture}
  ...
\end{tikzpicture}
}

\begin{document}
\pagestyle{empty}
\name{Тема}

Текст со ссылкой на рис.~\ref{fig:demo} и табл.~\ref{tab:data}.

\begin{figure}[H]
\centering
\resizebox{0.8\textwidth}{!}{\TikzExample}
\caption{Подпись рисунка}
\label{fig:demo}
\end{figure}

\begin{table}[H]
\centering
\caption{Подпись таблицы}
\label{tab:data}
\begin{tabular}{lc}
\toprule
A & B \\
\midrule
1 & 2 \\
\bottomrule
\end{tabular}
\end{table}
\end{document}
```
