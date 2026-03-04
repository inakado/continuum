# tech-debt-tracker

Назначение: единое место для признанного техдолга, багов и deferred engineering work.

## Формат записи

- ID
- Область
- Описание
- Влияние
- Приоритет
- Статус
- План устранения

## Текущие записи

### TD-001 — Event payload normalization

- Область: Learning / Audit / Events
- Описание: в event payload местами дублируются snake_case и camelCase ключи.
- Влияние: лишняя сложность downstream parsing и audit consumers.
- Приоритет: medium
- Статус: open
- План устранения: выбрать единый payload style и провести ratchet cleanup с backward-compatibility.

### TD-002 — Availability recompute writes-on-read

- Область: Learning
- Описание: `student_unit_state` обновляется в read-path через recompute.
- Влияние: сложнее reasoning о side effects и performance profile.
- Приоритет: medium
- Статус: open
- План устранения: решить, остаётся ли writes-on-read как сознательная стратегия или выносится в другой recompute contour.

### TD-003 — Assets model unification

- Область: Content / Storage / Learning
- Описание: asset keys хранятся прямо в доменных сущностях, универсальной модели привязки assets нет.
- Влияние: сложнее расширять file model и переиспользовать asset rules.
- Приоритет: medium
- Статус: open
- План устранения: спроектировать единый asset model только если появится реальная потребность в обобщении.

### TD-004 — TikZ vector accents in HTML SVG path

- Область: Rendering / Content / Web
- Описание: текущий `pdflatex --output-format=dvi -> dvisvgm --font-format=woff` path для TikZ figure assets должен дать более совместимый SVG-контур, но кейс с math accent-командами вида `\vec{...}` в TikZ labels требует отдельной acceptance-верификации и может остаться типографически нестабильным.
- Влияние: часть физических обозначений в HTML preview/student view выглядит типографически неверно, хотя общий figure render остаётся рабочим.
- Приоритет: high
- Статус: open
- План устранения: отдельно исследовать classic DVI renderer для figure-only path; если он не даст стабильный SVG для кириллицы и math accents, добавить selective raster fallback для TikZ-блоков с accent-макросами.

### TD-005 — HTML fidelity gaps against teacher LaTeX/PDF source

- Область: Rendering / Content / Web
- Описание: текущий HTML render path для unit `theory/method` уже сохраняет основной semantic content, MathJax math и figure references, но ещё не гарантирует типографическую близость к teacher-authored PDF во всех случаях. На реальном corpus остаются недочёты по верстке кастомных блоков, layout figure-heavy sections и общему качеству LaTeX -> HTML преобразования.
- Влияние: student/teacher HTML preview функционально рабочий, но отдельные unit могут выглядеть менее аккуратно, чем PDF, и требуют ручной regression-верификации после compile.
- Приоритет: medium
- Статус: open
- План устранения: продолжать tuning worker post-processing и scoped content CSS на реальном corpus; новые найденные системные cases сначала классифицировать как renderer issue, а не исправлять точечно в teacher source.
