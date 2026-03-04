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
- Описание: текущий `tectonic --outfmt xdv -> dvisvgm --font-format=woff` path для TikZ figure assets сохраняет рабочий SVG-контур, но math accent-команды вида `\vec{...}` в TikZ labels браузер рендерит с некорректным положением accent glyph.
- Влияние: часть физических обозначений в HTML preview/student view выглядит типографически неверно, хотя общий figure render остаётся рабочим.
- Приоритет: high
- Статус: open
- План устранения: отдельно исследовать classic DVI renderer для figure-only path; если он не даст стабильный SVG для кириллицы и math accents, добавить selective raster fallback для TikZ-блоков с accent-макросами.
