---
name: "Континуум"
description: "Закрытая учебная платформа с раздельными teacher/student рабочими интерфейсами."
colors:
  ink: "#0f172a"
  paper: "#ffffff"
  surface-muted: "#f8fafc"
  surface-soft: "#f1f5f9"
  dark-surface: "#1e293b"
  dark-outline: "#334155"
  text-muted: "#64748b"
  text-muted-dark: "#94a3b8"
  student-carbon: "#212529"
  student-snow: "#f8f9fa"
  success: "#10b981"
  warning: "#d97706"
  danger: "#ef4444"
typography:
  display:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "clamp(2.125rem, 1.65rem + 1.2vw, 2.75rem)"
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: "-0.02em"
  page:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "clamp(1.625rem, 1.2rem + 1vw, 2rem)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.016em"
  section:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  card:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  body-small:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0em"
  label:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.08em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0em"
rounded:
  panel: "16px"
  card: "14px"
  control: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  section: "24px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    typography: "{typography.body-small}"
    padding: "10px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    typography: "{typography.body-small}"
    padding: "10px 16px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.danger}"
    rounded: "{rounded.control}"
    typography: "{typography.body-small}"
    padding: "10px 16px"
    height: "44px"
  panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "clamp(14px, 2vw, 18px)"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "14px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    typography: "{typography.body}"
    padding: "10px 12px"
    height: "44px"
---

# Design System: Континуум

## 1. Overview

**Creative North Star: "Система координат обучения"**

Визуальная система «Континуума» описывает рабочую учебную среду, где каждый экран помогает определить положение: роль пользователя, текущий раздел, доступность юнита, статус задачи, прогресс и следующий шаг. Это product UI, а не маркетинговая поверхность: дизайн служит навигации, управлению контентом, проверке решений и прохождению материала.

Система держится на строгой светло-тёмной foundation palette, локальных шрифтах `Onest` и `Inter`, аккуратных радиусах 12-16px, glass baseline для teacher dashboard и отдельном student dashboard baseline. Teacher и student интерфейсы не обязаны выглядеть одинаково: они делят foundation tokens и shared primitives, но развиваются через собственные shell/theme layers.

Она прямо отвергает детский edtech, маркетинговый SaaS с фиолетовыми градиентами, перегруженный админский Excel и glass ради glass. Строгость выражается не сухостью, а точной иерархией, стабильными affordances, понятными статусами и спокойной современной плотностью.

**Key Characteristics:**

- Раздельные role-scoped visual baselines для teacher и student routes.
- Foundation-first token model: `globals.css` задаёт основу, role theme modules переопределяют только semantic UI tokens.
- Рабочая плотность без потери сканируемости: списки, таблицы, графы и drilldown-экраны должны оставаться читаемыми.
- Типографика без CDN: `Unbounded` только для логотипа, `Onest` для заголовков и акцентов, `Inter` для UI и чтения.
- Статусы, прогресс и доступность всегда читаются как состояние системы, а не как украшение.

## 2. Colors

Палитра сдержанная: нейтральная foundation шкала, один высокий контрастный акцент для действий и role-specific overlays для teacher/student поведения.

### Primary

- **Continuum Ink** (`ink`): основной светлый accent и текстовый якорь; используется для primary actions, navigation active states и сильных контрастных поверхностей.
- **Student Carbon** (`student-carbon`): student dashboard accent; поддерживает более графичный, монохромный baseline без смены foundation.

### Secondary

- **Semantic Success** (`success`): успешное состояние, accepted/review-positive feedback и completion signals.
- **Semantic Warning** (`warning`): промежуточные и требующие внимания состояния.
- **Semantic Danger** (`danger`): destructive actions, reject/remove flows и критичные ошибки.

### Neutral

- **Paper** (`paper`): базовая светлая поверхность, fields, cards и PDF-like учебный контент.
- **Surface Muted** (`surface-muted`) и **Surface Soft** (`surface-soft`): secondary light layers для table headers, subtle rows и paper-like insets.
- **Dark Surface** (`dark-surface`) и **Dark Outline** (`dark-outline`): dark foundation для dashboard surfaces, borders и table frames.
- **Muted Text** (`text-muted`, `text-muted-dark`): secondary copy; обязана сохранять читаемость на своём фоне.

### Named Rules

**The Role Boundary Rule.** Цвета teacher и student интерфейсов меняются через `teacher-dashboard-theme.module.css` и `student-dashboard-theme.module.css`; role-specific задача не переписывает чужой theme layer.

**The Accent Scarcity Rule.** Акцент служит primary action, current selection и status semantics. Не использовать акцент как декоративную заливку для пустых карточек или фона.

**The Glass Legibility Rule.** Glass допустим только с fallback и читаемым foreground. Если blur ухудшает контраст или структуру, поверхность становится непрозрачной.

## 3. Typography

**Display Font:** `Onest` с `system-ui` fallback  
**Body Font:** `Inter` с `system-ui` fallback  
**Label/Mono Font:** `Onest` для labels/kickers, `JetBrains Mono` только для technical/meta/counter contexts  
**Logo Font:** `Unbounded` только для бренда `Континуум`

**Character:** Типографика спокойная и рабочая: низкая контрастность scale, плотные заголовки без крика, body-текст с достаточной строкой и стабильными label roles. Product screens не используют display-font drama там, где нужен интерфейсный контроль.

### Hierarchy

- **Display** (500, `clamp(2.125rem, 1.65rem + 1.2vw, 2.75rem)`, 1.04): крупные dashboard identity moments и редкие top-level hero-like blocks.
- **Page** (500, `clamp(1.625rem, 1.2rem + 1vw, 2rem)`, 1.08): заголовки страниц и primary screen headers.
- **Section** (500, `1.125rem`, 1.2): in-panel stage headings и ключевые секции.
- **Card** (500, `0.9375rem`, 1.25): entity titles в карточках, rows и compact summaries.
- **Body** (400, `0.9375rem`, 1.5): основной UI-текст, формы и учебное чтение.
- **Body Small** (400, `0.8125rem`, 1.45): meta, helper copy, table copy и descriptions.
- **Label / Overline** (500, `0.6875rem` / `0.625rem`, tracked): статусы, pills, compact labels. Не превращать overline в декоративный eyebrow над каждой секцией.
- **Mono** (500, `0.75rem`, 1.4): технические counters, snippets и compact numeric/meta contexts.

### Named Rules

**The Logo Isolation Rule.** `Unbounded` не используется как обычный heading face. Он принадлежит только логотипному тексту `Континуум`.

**The Product Scale Rule.** Product UI использует semantic type tokens из `globals.css`; новые произвольные `font-size` допускаются только как локально обоснованное исключение.

**The No Shouting Rule.** Display letter-spacing не уходит ниже `-0.04em`; текущий ceiling системы держится в безопасной зоне (`-0.02em` для display).

## 4. Elevation

Система использует гибрид tonal layering и мягкого glass elevation. Foundation surfaces задают глубину через `surface-*`, `role-surface-*`, borders и table frame tokens; shadows подключаются для panels, cards, hover и dark-mode separation. Elevation должен помогать отделить рабочие слои, а не имитировать декоративные карточки.

### Shadow Vocabulary

- **Glass Panel** (`--glass-shadow`: `0 12px 30px rgba(15, 23, 42, 0.075)` light / `0 18px 40px rgba(2, 6, 23, 0.34)` dark): teacher dashboard panels и glass-scope containers.
- **Card Low** (`--card-shadow`: `0 9px 20px rgba(15, 23, 42, 0.04)`): secondary cards with minimal lift.
- **Foundation SM/MD/LG** (`--foundation-shadow-sm/md/lg`): reusable role-level elevation for table frames, overlays and dense product surfaces.
- **Button Hover** (`--button-hover-shadow` / variant tokens): interaction feedback, not permanent decoration.

### Named Rules

**The State Earns Shadow Rule.** Shadows appear for hierarchy or interaction state. A resting component should not combine a decorative 1px border with a broad soft shadow unless it is an intentional panel/card primitive.

**The Portal Opaqueness Rule.** Dropdown and select portal surfaces are opaque. Menus do not use transparent glass or backdrop blur.

## 5. Components

Components are role-neutral by API and role-specific by tokens. The shared UI kit lives in `apps/web/components/ui/*`; final color/hover behavior comes from the current shell theme.

### Buttons

- **Shape:** restrained rounded controls (`12px`) with full pill allowed only for tags, login-specific controls or semantic pills.
- **Primary:** high-contrast action surface (`--bg-accent` / `--text-accent`), `44px` medium height, `10px 16px` padding, `Inter` 600.
- **Hover / Focus:** primary lifts by `translateY(-1px)` and uses variant hover tokens; focus uses semantic `--focus-ring-*`.
- **Secondary / Ghost / Danger:** secondary and ghost are quiet utility actions; danger uses restrained red mixing and remains visually subordinate until hover/destructive confirmation.

### Chips

- **Style:** status chips are pill-shaped (`999px`) with `1px` borders, tracked `Onest` overline typography and semantic color mixes.
- **State:** `muted`, `default`, `success`, `warning`, `danger` map to actual system state; no raw enum labels in UI.

### Cards / Containers

- **Corner Style:** panels use `16px`, cards use `14px`, insets and controls use `12px`.
- **Background:** surfaces resolve through `--surface-panel-*`, `--surface-card-*`, `--surface-inset-*` or role aliases.
- **Shadow Strategy:** panel/card shadows are low and functional; table frames use `--table-frame-*`.
- **Border:** `1.5px` strong borders for panels/cards, `1px` thin borders for controls, menus and insets.
- **Internal Padding:** panels use `clamp(14px, 2vw, 18px)`, cards `14px`, insets `12px`.

### Inputs / Fields

- **Style:** full-width controls with `44px` medium height, `10px 12px` padding, tokenized background and border.
- **Focus:** no browser default outline; border shifts to `--focus-ring-border-color` with a soft `box-shadow` ring.
- **Error / Disabled:** errors remain readable on glass and elevated surfaces; disabled states lower contrast without disappearing.

### Navigation

- **Teacher navigation:** glass baseline, active state as surface/foreground change inside `TeacherDashboardShell`.
- **Student navigation:** separate monochrome student baseline, active and hover behavior from `student-dashboard-theme.module.css`.
- **Mobile treatment:** shell/sidebar sizing and motion are defined by role-specific shell CSS, not by feature screens.

### Signature Components

- **PageHeader:** canonical teacher section header with breadcrumbs, title, subtitle, actions and status slots.
- **SurfaceCard:** shared panel/section/inset primitive for role-neutral presentation.
- **InlineStatus:** canonical status pill; use label mappings, not raw enum rendering.
- **Radix wrappers:** `Dialog`, `AlertDialog`, `DropdownMenu`, `Select`, `Switch`, `Tabs` keep a11y behavior while staying inside the token system.

## 6. Do's and Don'ts

### Do:

- **Do** preserve role boundaries: teacher changes stay in teacher shell/theme/features; student changes stay in student shell/theme/features.
- **Do** use foundation and role tokens for surfaces, borders, shadows, status colors and controls instead of raw neutral literals in feature CSS.
- **Do** keep `completionPercent` and `solvedPercent`, locked/available states, draft/published states and review statuses visually distinct.
- **Do** use `Button`, `ButtonLink`, `SurfaceCard`, `PageHeader`, `InlineStatus` and Radix-backed primitives before writing one-off controls.
- **Do** keep teacher screens compact and scannable; dense tables and registry rows are acceptable when they improve repeated work.
- **Do** support dark theme, focus states, reduced motion and WCAG AA contrast as baseline requirements.

### Don't:

- **Don't** make the product feel like детский edtech with decorative gamified visuals as the baseline.
- **Don't** turn product screens into маркетинговый SaaS с фиолетовыми градиентами, hero metrics or promotional copy.
- **Don't** build перегруженный админский Excel: density without hierarchy is a failure.
- **Don't** use glass ради glass. Transparent blur is forbidden when it harms contrast, menus, forms or table readability.
- **Don't** use gradient text, side-stripe card borders, repeating stripe backgrounds, nested cards or numbered section scaffolding as default patterns.
- **Don't** import `@/components/DashboardShell` from role-specific feature code; use `StudentDashboardShell` or `TeacherDashboardShell`.
- **Don't** render raw enum strings in UI. Map statuses through `apps/web/lib/status-labels.ts`.
