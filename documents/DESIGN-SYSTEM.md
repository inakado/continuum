# DESIGN-SYSTEM.md
**Проект**: «Континуум»
**Назначение**: дизайн‑система для ежедневной разработки UI (типографика, цвета, материалы, компоненты, UX‑правила, контент/PDF, ReactFlow).
**Важно**: файл описывает текущую продуктовую систему. Вход/лендинги отражены здесь только в части общего визуального языка.

Статус: `Draft` (источник истины — код/CSS).

---

## Статусы фактов

- `Implemented`: правила/токены/паттерны, которые уже видны в текущем UI (сверяется по `apps/web`).
- `Planned`: будущие изменения дизайн‑системы (если добавляются — помечаются явно в разделе).
- Ролевые baseline фиксируются раздельно:
  - teacher dashboard design system — `Implemented`;
  - student dashboard design system — `In progress` (отдельная ветка визуальной системы, старт с `/student`).

## 1) Типографика

### 1.1 Font Roles (фиксировано)
A) Логотипный шрифт (только бренд `Континуум`)
- Шрифт: **Unbounded** (локально через `@fontsource/unbounded`)
- В коде подключены веса: `300/400/500/600/700` (без runtime-зависимости от Google Fonts)
- Токен: `--font-logo`
- Использование: только логотипный текст `Континуум` (включая `/login`)

B) Заголовки и интерфейсные акценты
- Шрифт: **Onest** (локально через `@fontsource/onest`)
- Токен: `--font-onest`
- Для обратной совместимости в стилях: `--font-unbounded` алиасится на `--font-onest`
- Использование: заголовки экранов, заголовки панелей/карточек и интерфейсные акценты, где ранее использовался `--font-unbounded`

C) Интерфейс и чтение
- Шрифт: **Inter** (локально через `@fontsource/inter`)
- Токен: `--font-inter`
- Использование: основной UI‑текст, меню, карточки, формы, длинные тексты

### 1.2 Typography contract (`Implemented`)

- `Unbounded` используется только как `--font-logo` для бренда `Континуум`.
- `Onest` (`--font-heading`) используется для:
  - `display/page/section/card` headings;
  - `label/overline/kicker` ролей;
  - коротких UI-accent элементов.
- `Inter` (`--font-body`) используется для:
  - body copy;
  - form text;
  - table cells;
  - helper/meta/error copy.
- `JetBrains Mono` допускается только как `--font-mono` для technical/meta/counter contexts, где моноширинность действительно нужна.

### 1.3 Semantic type scale (`Implemented`)

В `apps/web/app/globals.css` зафиксирован семантический scale:
- `--text-title-display-*`
- `--text-title-page-*`
- `--text-title-section-*`
- `--text-title-card-*`
- `--text-body-md-*`
- `--text-body-sm-*`
- `--text-label-*`
- `--text-caption-*`
- `--text-overline-*`
- `--text-mono-*`

Правило:
- product screens не задают новые произвольные type levels без причины;
- page/panel/card/status/label роли должны опираться на semantic tokens, а не на локальные случайные `font-size`.
- Teacher detail/drilldown sections (`students`, `review`) используют ту же иерархию:
  - primary identity/header = `page-title`,
  - in-panel stage heading = `section-title`,
  - card/entity title = `card-title`,
  - data/meta copy = `body-sm` / `caption`,
  - pills/status labels = `overline` / `label`.
- Для teacher `students` hierarchy фиксируется дополнительно:
  - `Ученики` = page title;
  - identity header ученика = section title;
  - `Материалы и прогресс` = section title;
  - row/card entity titles (`курс`, `раздел`, `юнит`) = card title.

---

## 2) Цветовая система (Light/Dark)

**Требование:** переключение темы бесшовное (плавный transition), без миганий.

**Токены (основа):**
- `bg-primary`: light `#ffffff`, dark `#0f172a`
- `text-primary`: light `#0f172a`, dark `#ffffff`
- `border-primary`: light `#0f172a`, dark `#ffffff`
- `bg-accent`: light `#0f172a`, dark `#ffffff`
- `text-accent`: light `#ffffff`, dark `#0f172a`
- `text-muted`: light `#64748b`, dark `#94a3b8`

**Доп. фоны:**
- `bg-surface`: light `#f1f5f9`, dark `#111b34`
- `bg-field`: light `#ffffff`, dark `#0f172a`

**Принцип:** высокий контраст текста. Границы в glass‑режиме — полупрозрачные, без тяжёлых 2px линий.

### 2.1 Материалы (Glass & Air)
Glass‑стиль — основа для **teacher dashboard baseline**.
Экран логина — отдельный случай (Grainient + pill‑контролы), но тоже опирается на glass‑токены.

**Токены (glass):**
- `--glass-bg`, `--glass-border`, `--glass-shadow`, `--glass-blur`, `--glass-tint`
- `--surface-0`, `--surface-1`, `--surface-2` — глубина слоёв
- `--panel-bg`, `--panel-border`, `--panel-shadow`, `--panel-radius`
- `--card-bg`, `--card-border`, `--card-shadow`, `--card-radius`
- `--control-bg`, `--control-border`, `--control-radius`
- `--button-shadow`

**Правило:** стекло всегда с fallback (без blur) и читаемым контентом.

### 2.2 Логин‑фон (Grainient)
На экране логина используется **Grainient** (shader‑фон) как основной визуальный слой.
- Фон ч/б, зернистый, без кислотных оттенков.
- Все элементы входа нейтральные и прозрачные, чтобы не конфликтовать с зерном.

### 2.3 Role-scoped dashboard themes (`Implemented`)

- Foundation tokens остаются общими в `apps/web/app/globals.css`.
- Для dashboard-веток применяется отдельный role theme layer:
  - student: `apps/web/components/student-dashboard-theme.module.css`;
  - teacher: `apps/web/components/teacher-dashboard-theme.module.css`.
- Theme layer живёт на root shell (`StudentDashboardShell`/`TeacherDashboardShell`) и переопределяет только semantic UI tokens (`--bg-accent`, `--text-accent`, `--button-hover-*`, `--nav-*`) в пределах соответствующего subtree.
- Это позволяет использовать общий `Button`/`ButtonLink` API, но получать разные visual baseline для student и teacher без cross-impact.

Порядок источников токенов (от общего к частному):
1. `apps/web/app/globals.css` (foundation)
2. `apps/web/components/ui/button.module.css` и другие shared primitives (semantic contract)
3. `apps/web/components/*-dashboard-theme.module.css` (role overrides)
4. feature-level CSS modules (локальные исключения)

Операционное правило:
- Для role-specific UI/UX-задач нельзя начинать с `globals.css` или shared `ui/*`.
- Сначала правим соответствующий role theme (`student-dashboard-theme.module.css` или `teacher-dashboard-theme.module.css`) и/или role shell CSS.

---

## 3) Геометрия UI

### 3.0 Semantic foundation tokens (`Implemented`)

Поверх foundation tokens в `globals.css` заведён второй слой:
- spacing/layout: `--space-*`, `--layout-*`
- motion: `--motion-fast`, `--motion-base`, `--motion-slow`
- surfaces: `--surface-panel-*`, `--surface-card-*`, `--surface-inset-*`
- actions: `--action-control-height-*`, `--action-padding-x-*`, `--action-font-size-*`

Правило:
- новые shared components должны собираться из semantic tokens;
- локальные CSS overrides допустимы только как feature-specific исключение, а не как default способ стилизации.

### 3.1 Радиусы
**Glass UI:**
- Панели: `--radius-panel` = 16px
- Карточки: `--radius-card` = 14px
- Контролы: `--radius-control` = 12px

**Экран логина (центр):**
- Инпуты и кнопка: pill‑форма (radius 999px)

### 3.2 Границы
- По умолчанию: **1.5px** (`--border-width-strong`) или **1px** (`--border-width-thin`).
- В glass‑режиме — полупрозрачные границы (`--glass-border`).
- Толстые 2px рамки **не используем** в glass‑интерфейсах.

---

## 4) Компоненты и формы

### 4.1 Кнопки
**База:**
- sentence-case copy, умеренная толщина, короткий label rhythm
- Hover: мягкий lift/подсветка, без агрессивной инверсии
- Focus: аккуратный outline

**Гайд по кнопкам (чтобы не было расхождений)**
- Всегда используем компонент `Button` (UI kit). Не пишем “ручные” кнопки без причины.
- Канонический API:
  - variants: `primary`, `secondary`, `ghost`, `danger`
  - sizes: `sm`, `md`, `lg`
- Источник стилизации:
  - shape/typography/interaction contract задаётся в `apps/web/components/ui/button.module.css`;
  - role-specific color/hover behavior приходит из shell theme layer (`student-dashboard-theme.module.css` или `teacher-dashboard-theme.module.css`).
- Для route navigation, которая визуально выглядит как кнопка, используем `ButtonLink` или `Link`, стилизованный через button API; `router.push` не должен быть дефолтным способом навигации из CTA.
- `primary` = main CTA.
- `secondary` = стандартное glass-действие в toolbar/card/dialog.
- `ghost` = тихое вторичное действие, icon-action или non-destructive dismiss.
- `danger` = destructive action без ручного копирования красных overrides по фичам.
- Для teacher dashboard action semantics:
  - `primary` = create/save/confirm/next-step;
  - `secondary` = refresh/open/compile/utility;
  - `ghost` = quiet nav, non-destructive inline edit affordance и quiet dismiss;
  - `danger` = delete/reject/remove edge/remove asset.
- Локальные `--button-*` overrides допускаются только для truly special surfaces; обычные teacher dashboard flows должны обходиться variant/size API.

### 4.2 Инпуты
**Glass UI:**
- `background: --control-bg`
- `border: --control-border`
- `radius: --control-radius`

**Экран логина:**
- Инпуты без рамки
- Мягкая заливка + лёгкий blur
- Autofill без синего оттенка

### 4.3 Ошибки
- Ошибка всегда читается на фоне glass
- На логине: лёгкая плашка‑капсула (без агрессивных красных заливок)

### 4.4 Headless primitives (`Implemented`)
- Сложные interactive-компоненты собраны на Radix primitives, но визуально остаются в текущей системе токенов:
  - `Dialog` / `AlertDialog` / `DropdownMenu` / `Select` / `Switch` / `Tabs`.
- Контракты UI по-прежнему проходят через `apps/web/components/ui/*` (продуктовые экраны не импортируют Radix напрямую).
- Стилизация — только через CSS Modules + `--glass-*`, `--surface-*`, `--control-*`, `--button-*`.
- Для destructive-действий используем `AlertDialog` вместо нативного `window.confirm`, чтобы UX и a11y были консистентны в glass-контексте.
- `Dialog` и `AlertDialog` должны изолировать скролл модального контента через `overscroll-behavior: contain`, чтобы touch/trackpad scroll не протекал на фон.
- `Select` не получает accessible name из `placeholder`; для unlabeled-case используем явный `ariaLabel`.
- В `Portal`-компонентах (`Dialog/AlertDialog/DropdownMenu/Select`) явно задаём DS-токены радиусов/границ:
  - `border-radius`: `--radius-panel` (панели/модалки) или `--radius-control` (меню/контролы),
  - `border`: `--border-width-thin` + `--glass-border` (или токен эквивалентного контекста),
  - не полагаемся на `:root --control-radius` для портального контента.
- `Select.Content` и `DropdownMenu.Content` должны быть непрозрачными:
  - запрещены полупрозрачные фоны для списков,
  - `backdrop-filter`/`-webkit-backdrop-filter` не используются в выпадающих списках,
  - базовый фон списка: `var(--bg-primary)` или другой непрозрачный surface-токен текущей темы.
- Иконка-триггер “три точки” (`MoreHorizontal`) в карточках:
  - без pill-фона/тени/рамки,
  - с видимым `:focus-visible` ring,
  - позиционирование и отступы задаются локально в фиче, но с сохранением читаемости и hit-area.

### 4.5 Shared presentation primitives (`Implemented`)

- `PageHeader` — канонический header для teacher dashboard sections:
  - `kicker`
  - `title`
  - `subtitle`
  - optional `breadcrumbs/actions/status`
- `SurfaceCard` + `PanelCard` / `SectionCard` / `InsetCard` — общие glass surfaces вместо копирования panel/card shell по фичам.
- `FieldLabel` — единый label wrapper для forms.
- `InlineStatus` — единый status-pill для short status copy.
- `EmptyState` — единый empty-state block.
- `Kicker` — короткая overline/accent text role.

Правило:
- shared primitives остаются presentation-only и не содержат data orchestration;
- teacher features собирают layout из shared primitives + semantic tokens, а не из ad hoc локальных паттернов.
- Для teacher `students` presentation baseline:
  - список учеников строится как compact registry с тихой action-zone;
  - identity header ученика остаётся единственным сильным surface над drilldown;
  - `courses` и `sections` не используют oversized empty cards и визуально ведут к более плотному `units` table view.

### 4.6 Teacher dashboard card hover (`Implemented`)

- Для interactive card surfaces в teacher dashboard (`курсы`, `разделы`, `ученики`, drilldown row-cards) используется единый hover-contract.
- Hover-состояние карточки:
  - `transform: translateY(-2px)`;
  - усиленная тень уровня `--glass-shadow`;
  - фон карточки переходит в `--surface-2`;
  - border смещается к `--glass-border`.
- `focus-within` для таких карточек всегда получает видимый focus ring через `--focus-ring-*`.
- Локальные feature overrides не должны вводить отдельный hover-language для teacher cards, если это не особый доменный случай.

---

## 5) ReactFlow (графы юнитов)

### 5.1 Узлы
- Форма: скруглённые карточки
- Фон: `--card-bg`
- Контур: `--card-border`
- Тень: `--card-shadow`

**Состояния:**
- `locked`: приглушённый текст
- `available`: стандартный
- `in_progress`: аккуратная метка
- `completed`: допустимо лёгкое усиление контраста, без новых цветов

### 5.2 Рёбра
- Тип: `smoothstep`
- Цвет: muted для неактивных, `border-primary` для активных
- Анимации — только для текущего фокуса

---

## 6) Контент (LiteTeX + PDF)

### 6.1 LiteTeX
- KaTeX на клиенте
- выглядит как нативный текст, без iframe
- размер формул: `1.05–1.1em`

### 6.2 PDF / решения
- без browser viewer UI
- PDF.js canvas/text-layer

### 6.3 HTML unit content (`Implemented`)
- Для student unit `theory/method` при наличии собранного HTML показываем адаптивный HTML panel вместо PDF canvas.
- HTML panel ощущается частью glass-страницы, а не отдельным viewer:
  - собственный content-skin внутри panel scope;
  - responsive `img/svg`;
  - читаемая верстка длинного текста, списков, table, blockquote, code;
  - локальный math typesetting внутри panel scope.
- Teacher preview использует тот же content-skin внутри preview container, но остаётся переключаемым режимом рядом с PDF preview.
- Контентные выделения в HTML panel:
  - `DefinitionBox` без отдельного label-префикса;
  - `RemarkBox` с жирным `Замечание` (без точки);
  - figure cards с белой подложкой, скруглением и центрированной подписью.
- Заголовки в HTML content-skin должны иметь явную иерархию и не сливаться с body-текстом:
  - `h1/h2/h3/h4` имеют отдельные размеры/вес/ритм отступов;
  - `h2` допускает мягкий разделитель секции (top-border в пределах panel scope).
- Ссылки на figure/equation references в long-form HTML контенте визуально выделяются цветом/подложкой внутри panel scope; зависимость от underline не обязательна.
- При отсутствии HTML допускается fallback на legacy PDF panel.

**Правило показа решений:**
1. после правильного ответа, **или**
2. после auto‑credit (6 ошибок)

---

## 7) Motion
- Плавные ease‑in/out переходы
- Движения без рывков, без двойных анимаций
- Базовые переходы: 200–520ms
- Для React-компонентов с поэлементной анимацией используем `framer-motion`; для layout/geometric переходов (ширина, паддинги, сетка) приоритет у CSS custom properties и transitions.
- В часто повторяющихся UI-сценариях (например, hover sidebar) не используем blur-фильтры в motion-цепочках; базовые эффекты: `opacity/translate`.
- Motion обязан учитывать `prefers-reduced-motion` (сокращение/отключение анимации).

---

## 8) Dashboard UI (фактические паттерны)
- Teacher dashboard работает внутри `glass-scope` и использует `--glass-*`, `--surface-*`, `--card-*`, `--control-*`.
- Для teacher dashboard карточки и панели — **скруглённые** (см. `--radius-*`), с мягкой тенью и стеклянным фоном.
- В teacher glass-контексте активные карточки используют `--nav-active-bg/--nav-active-text` (мягкая подсветка, а не жёсткая инверсия).
- Teacher dashboard считается каноническим baseline только для teacher routes; параллельный legacy CRUD-слой для teacher course/section management удалён из active web codepath.
- Page/panel/card headers и empty/status blocks в teacher flows должны опираться на `PageHeader`, `SurfaceCard`, `InlineStatus`, `EmptyState`, `Kicker`, `FieldLabel`.
- Student dashboard v2 развивается отдельно в `apps/web/features/student-dashboard/*` и может использовать другой visual language; teacher presentation baseline не является обязательным шаблоном для student UI.

---

## 9) Anti‑patterns (что не делать)
- толстые (2px) рамки в glass‑интерфейсах
- агрессивная инверсия на hover в контентных кнопках и карточках
- подчёркивание текста по hover вместо лёгкой подсветки
- синий autofill у инпутов
- неконсистентные формы кнопок/контролов
- использование Tailwind классов в продуктовых экранах
- полупрозрачные выпадающие списки (`Select`/`DropdownMenu`), через которые виден задник и ухудшается читаемость
- острые углы у модалок/меню/кнопок из-за потери токенов в `Portal`

---

## 10) Tailwind Usage
- Tailwind CSS **не используется** в продуктовых экранах и не должен менять существующие стили.
- Даже если пакеты Tailwind присутствуют как зависимость, Tailwind не подключается глобально (в проекте нет `@tailwind` директив).

---

## 11) Мини‑чеклист ревью UI
- Unbounded используется только как логотипный шрифт для текста `Континуум` (включая `/login` c weight 300)
- Заголовки и интерфейсные акценты используют Onest (`--font-onest`; legacy `--font-unbounded` = алиас на Onest)
- Цвета соответствуют токенам `bg/text/border/accent/muted`
- Glass‑элементы используют `--glass-*` и `--surface-*`
- Границы 1px/1.5px, без тяжёлых линий
- Hover в glass‑UI — мягкий lift/подсветка
- Инпуты без синего autofill
- `Select`/`Dropdown` непрозрачны и не просвечивают фон
- Портальные `Dialog/AlertDialog/Dropdown/Select` сохраняют DS-радиусы и DS-границы
- PDF выглядит как часть страницы, без viewer UI
- Решения показываются только после `correct` или `auto-credit`

## Source links

- Typography + theme init:
  - `apps/web/app/layout.tsx`
  - `apps/web/app/globals.css`
- Grainient login background:
  - `apps/web/components/Grainient.jsx`
  - `apps/web/features/auth/UnifiedLoginScreen.tsx`
- UI kit components:
  - `apps/web/components/ui/Button.tsx`
  - `apps/web/components/ui/Input.tsx`
- PDF rendering:
  - `apps/web/components/PdfCanvasPreview.tsx`
