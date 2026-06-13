# deferred-roadmap

Назначение: единое место для неактивных future items, которые не являются техдолгом и не вынесены в active execution plan.

## Правила записи

- Здесь хранятся только отложенные инициативы и направления.
- Файл не хранит progress logs и не заменяет active execution plans.
- Как только item становится активной инициативой, он переезжает в `documents/exec-plans/active/*`.

## Формат записи

- ID
- Область
- Описание
- Почему отложено
- Trigger / когда вернуться
- Источник
- Статус: `deferred`

## Категории

### Architecture

#### DR-001

- Область: Security / Architecture
- Описание: собрать отдельный threat model по trust boundaries `web ↔ api`, `api ↔ db/redis/s3`, `worker ↔ api/s3`.
- Почему отложено: не является текущим blocking work для runtime или docs cleanup.
- Trigger: отдельная security initiative или заметное изменение trust boundaries.
- Источник: `documents/SECURITY.md`
- Статус: `deferred`

#### DR-002

- Область: Learning / Product
- Описание: расширить notification coverage для `photo_reviewed` и `unit_override_opened`, если это понадобится продукту.
- Почему отложено: текущая функциональность работает без этих событий.
- Trigger: продуктовый запрос на расширение teacher/student feedback.
- Источник: `documents/LEARNING.md`
- Статус: `deferred`

#### DR-007

- Область: Content / Search
- Описание: спроектировать concepts/content search контур, включая модели, индекс и read-path.
- Почему отложено: в текущем коде нет моделей `concepts` и поискового индекса.
- Trigger: продуктовый запрос на поиск по учебному контенту или concepts.
- Источник: `documents/ARCHITECTURE.md`
- Статус: `deferred`

#### DR-008

- Область: Analytics / Read models
- Описание: добавить analytics/read-model projections поверх доменных событий и learning snapshots.
- Почему отложено: текущий продуктовый UI закрывается `student_unit_state`, `/student/dashboard` и teacher read-paths без отдельного analytics BC.
- Trigger: запрос на расширенную аналитику, отчёты или новые метрики за пределами текущих progress snapshots.
- Источник: `documents/ARCHITECTURE.md`, `documents/DECISIONS.md`
- Статус: `deferred`

#### DR-010

- Область: Audit / Domain events
- Описание: рассмотреть дополнительные события `UserAuthenticated`, `UserLoggedOut`, `UserPasswordChanged`, `UnitBecameAvailableForStudent`, `UnitProgressStartedForStudent`, `UnitCompletedByStudent`, `TaskRequiredFlagChanged` и rendering job lifecycle events.
- Почему отложено: эти события встречались в старых планах, но не подтверждены текущими emitters и не нужны core behavior.
- Trigger: появление downstream consumers, analytics/reach сценариев или требований к расширенному audit trail.
- Источник: `documents/DOMAIN-EVENTS.md`
- Статус: `deferred`

### Product

#### DR-003

- Область: Design / UX
- Описание: формализовать teacher/student user journeys (happy path + error/empty states).
- Почему отложено: сначала stabilizing architecture and docs governance.
- Trigger: отдельная UX/product initiative.
- Источник: `documents/DESIGN.md`
- Статус: `deferred`

#### DR-004

- Область: Design system / UX
- Описание: зафиксировать визуальные и interaction principles после стабилизации дизайн-системы.
- Почему отложено: текущая дизайн-система ещё продолжает оформляться в коде.
- Trigger: отдельная design-system initiative.
- Источник: `documents/DESIGN.md`
- Статус: `deferred`

### Documentation

#### DR-005

- Область: Security / Docs
- Описание: добавить минимальный security checklist для CI/docs governance.
- Почему отложено: это улучшение quality contour, но не обязательный шаг текущего cleanup.
- Trigger: отдельная security/docs automation initiative.
- Источник: `documents/SECURITY.md`
- Статус: `deferred`

### Frontend

#### DR-006

- Область: Frontend
- Описание: формализовать UI state patterns, accessibility baseline и retry/backoff conventions для list screens.
- Почему отложено: текущий frontend SoR уже должен отражать только стабильную модель, а не backlog.
- Trigger: отдельная frontend quality initiative.
- Источник: `documents/FRONTEND.md`
- Статус: `deferred`

#### DR-009

- Область: Reliability / Operations
- Описание: формализовать SLO/SLA для критических сценариев, runbooks деградации Redis/S3/worker/migrations и внешнюю healthcheck/alerting интеграцию.
- Почему отложено: текущий reliability SoR фиксирует реализованные runtime invariants и базовый deploy contour.
- Trigger: production hardening initiative или рост эксплуатационной нагрузки.
- Источник: `documents/RELIABILITY.md`
- Статус: `deferred`

#### DR-011

- Область: Security / Reliability
- Описание: сформулировать CSRF strategy для cookie-based auth, retention policy для assets/events и RPO/RTO backup recovery policy.
- Почему отложено: текущие cookie/session/storage инварианты работают без отдельного расширенного policy-документа.
- Trigger: security hardening, audit requirements или production backup/restore initiative.
- Источник: `documents/DECISIONS.md`
- Статус: `deferred`
