# DESIGN-SYSTEM.md
**Проект**: «Континуум»
**Назначение**: дизайн‑система для ежедневной разработки UI (типографика, цвета, материалы, компоненты, UX‑правила, контент/PDF, ReactFlow).
**Важно**: файл описывает текущую продуктовую систему. Вход/лендинги отражены здесь только в части общего визуального языка.

Статус: `Draft` (источник истины — код/CSS).

---

## Статусы фактов

- `Implemented`: правила/токены/паттерны, которые уже видны в текущем UI (сверяется по `apps/web`).
- `Planned`: будущие изменения дизайн‑системы (если добавляются — помечаются явно в разделе).

## 1) Типографика

### 1.1 Dual Font System (фиксировано)
A) Акцент / брендинг / крупные заголовки
- Шрифт: **Unbounded** (Google Fonts)
- Вес: **300** (текущая настройка в коде)
- Использование: логотип, экран логина, крупные заголовки, брендинг

B) Интерфейс и чтение
- Шрифт: **Inter** (Google Fonts)
- Использование: основной UI‑текст, меню, карточки, формы, длинные тексты

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
Glass‑стиль — основа для **teacher dashboards** и **student dashboards**.
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

---

## 3) Геометрия UI

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
- Uppercase + letter‑spacing, умеренная толщина
- Hover: мягкий lift/подсветка, без агрессивной инверсии
- Focus: аккуратный outline

**Гайд по кнопкам (чтобы не было расхождений)**
- Всегда используем компонент `Button` (UI kit). Не пишем “ручные” кнопки без причины.
- В glass‑дашбордах кнопки **настраиваются через локальные CSS‑переменные** на контейнере (`.panelActions`, `.toolbar`, `.cardActions` и т.п.).
- Базовый `Button` = нейтральный каркас. В дашбордах почти всегда нужны overrides.

**Glass UI (дашборды)**
- Primary для действий в панелях/toolbar:
  - `--button-bg: var(--glass-tint)` или `var(--surface-1)`
  - `--button-text: var(--text-primary)`
  - `--button-border: var(--panel-border)` или `var(--glass-border)`
  - `--button-border-width: var(--border-width-thin)`
  - `--button-hover-bg: var(--surface-2)`
  - `--button-hover-border: var(--border-primary)`
  - `--button-hover-text: var(--text-primary)`
  - `--button-hover-shadow: var(--nav-hover-shadow)`
- Ghost (вторичные действия):
  - `--button-bg: var(--surface-1)` или `var(--control-bg)`
  - `--button-border: var(--glass-border)`
  - `--button-text: var(--text-primary)`
  - hover как у Primary (см. выше)

**Вне glass‑контекста**
- Primary допускает `bg-accent` (сохранить uppercase + letter‑spacing).
- Ghost остаётся нейтральным и не “инвертирует” цветовую схему.

**Правило совместимости**
- Если кнопка визуально должна совпадать с существующей (например “Добавить курс”), 
  копируем overrides из соответствующего контейнера (например `.panelActions button`).

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

**Правило показа решений:**
1. после правильного ответа, **или**
2. после auto‑credit (6 ошибок)

---

## 7) Motion
- Плавные ease‑in/out переходы
- Движения без рывков, без двойных анимаций
- Базовые переходы: 200–520ms

---

## 8) Dashboard UI (фактические паттерны)
- Дашборды учителя/ученика работают внутри `glass-scope` и используют `--glass-*`, `--surface-*`, `--card-*`, `--control-*`.
- Карточки и панели — **скруглённые** (см. `--radius-*`), с мягкой тенью и стеклянным фоном.
- Активные карточки используют `--nav-active-bg/--nav-active-text` (в glass‑контексте это мягкая подсветка, а не жёсткая инверсия).
- Кнопки внутри панелей/карточек настраиваются через локальные `--button-*` (поверх базового Button).

---

## 9) Anti‑patterns (что не делать)
- толстые (2px) рамки в glass‑интерфейсах
- агрессивная инверсия на hover в контентных кнопках и карточках
- подчёркивание текста по hover вместо лёгкой подсветки
- синий autofill у инпутов
- неконсистентные формы кнопок/контролов
- использование Tailwind классов в продуктовых экранах

---

## 10) Tailwind Usage
- Tailwind CSS **не используется** в продуктовых экранах и не должен менять существующие стили.
- Даже если пакеты Tailwind присутствуют как зависимость, Tailwind не подключается глобально (в проекте нет `@tailwind` директив).

---

## 11) Мини‑чеклист ревью UI
- Unbounded только для брендинга, weight 300
- Цвета соответствуют токенам `bg/text/border/accent/muted`
- Glass‑элементы используют `--glass-*` и `--surface-*`
- Границы 1px/1.5px, без тяжёлых линий
- Hover в glass‑UI — мягкий lift/подсветка
- Инпуты без синего autofill
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
