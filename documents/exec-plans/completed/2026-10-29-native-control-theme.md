# Светлая схема нативных элементов

Статус: Completed локально. Дата: 29.10.2026. Production не изменён.

## Цель и scope

Устранить тёмные чекбоксы на белом списке учеников и тот же механизм во всех рабочих интерфейсах desktop/mobile/PWA. Общий foundation обеих ролей и admin; палитра входа сохраняется, новые контролы/настройки/зависимости не вводятся.

## Причина и решения

- Root bootstrap, ThemeHydration и useTheme выбирают `data-theme=dark` из ОС/сохранённого значения. Глобальный CSS задавал root dark tokens и наследуемый `color-scheme: dark`. Рабочие страницы задают белый фон, но не все переопределяют нативную схему.
- До исправления на настоящих `StudentRows` и `SelectionCheckbox`: body/четыре checkbox имеют computed scheme dark при белом фоне страницы. Снимок `native-theme-before.png` сохранён в папке визуализаций чата. Это тот же конфликт, что на пользовательском iPhone.
- Другие прямые потребители: массовый выбор банка/работ, назначения классов, разрешения reviewer, подтверждение удаления класса, общие Dialog/DropdownMenu порталы. Question workspace, банк и отдельные панели уже задавали light локально; системный источник всё равно оставался dark.
- [MDN color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme): наследуется, управляет native controls/scrollbars; `only light` запрещает автоматический перевод light UI в dark.
- Исправление источника: базовые tokens и native scheme светлые на root; dark tokens ограничены декоративным `glass-scope` входа. Нативные controls светлые также там. Низкая специфичность scoped dark сохраняет локальные login overrides. Нет route effects и ручной перерисовки чекбоксов.

## Порядок и критерии

1. Воспроизвести до CSS-правки и зафиксировать computed styles.
2. Проверить dark/light data-theme, mobile/desktop, checkbox unchecked/checked/mixed/disabled, select, teacher/student и общие порталы.
3. Typecheck, boundaries, web tests, docs checks; завершить план, удалить временный стенд.

## Риски и откат

Проверка внутренним браузером не заменяет физический iPhone. Publication отдельно не разрешена. Откат — root/scoped CSS и документация; БД/API не затрагиваются. Сохранённые theme preferences не удаляются.

## Проверки

- До правки во внутреннем браузере воспроизведена dark-схема настоящих StudentRows/SelectionCheckbox на белом фоне; после — root/body/controls `light only`, body RGB 255/255/255 при обоих значениях data-theme. Стенд использовал настоящие исходные компоненты и CSS, синтетические имена/сессию, без запросов к production.
- Mobile 390×844 и desktop 1280×800: ширина документа совпадает с viewport, unchecked checkbox белый, checked/mixed — catalog accent RGB 68/95/146, disabled сохраняет недоступность. Проверены клик выбора и native radio, class select, меню ученика, общий portal Dialog с checkbox/text/select, Escape. У Dialog светлая поверхность, читаемый тёмный текст и light controls; меню белое. StudentWorksShell и нативные student checkbox/radio сохраняют light при data-theme dark.
- Палитра `.glass-scope` при dark осталась `--bg-primary: #0f172a`, при light — `#ffffff`; root в обоих случаях светлый. Тёмный декоративный контур не протекает в body/порталы.
- Снимки в папке визуализаций чата: `native-theme-before.png`, `native-theme-mobile-after.png`, `native-theme-desktop-after.png`. Мобильный итог снят при data-theme dark, один ученик выбран, другой нет. Данные синтетические; это desktop browser responsive QA, не физический iPhone.
- `pnpm lint:boundaries`, `pnpm --filter web typecheck`, полный web suite 75 файлов / 292 теста и `pnpm docs:check` — прошли. `git diff --check` чистый.
- Contract review: только общий CSS (3 добавленных / 5 удалённых строк); без JavaScript, новых настроек, dependencies и per-feature overrides. Нативные controls и доступность сохранены.
- Временный Vite-сервер/каталог/кеш и вкладка удалены; viewport сброшен. Физическую проверку iPhone повторить после отдельного выпуска.
