# TECH-STACK.md
**Проект:** «Континуум» закрытая платформа обучения (2+ преподавателя + их ученики)  
**Назначение:** единый источник правды по технологиям/библиотекам/версионированию/безопасности для AI-агента и команды.  
**Последнее обновление:** 2026-02-01 (Europe/Belgrade)

---

## 0) Ключевые принципы (non-negotiables)

1) **Latest stable React + Next.js** (из-за критичных уязвимостей в RSC, включая CVE-2025-55182).
2) **Никаких уязвимых версий RSC-пакетов**: `react-server-dom-webpack`, `react-server-dom-turbopack`, `react-server-dom-parcel` должны быть на patched/последних версиях.
3) **Modular Monolith (NestJS) + отдельный worker** для Rich LaTeX (Tectonic). Рендер не блокирует web/API.
4) **S3-совместимое хранилище** (MinIO в dev; S3/совместимое в prod). Доступ к файлам — через backend (signed URLs + ACL).
5) **Иерархическая видимость draft/published**: если родитель draft → всё скрыто; unpublish → объект не учитывается в статистике (с пересчётом).
6) **Безопасность по умолчанию**: минимальные привилегии, секреты вне репо, регулярные обновления зависимостей.

---

## 1) Версионирование и политика обновлений (Security-first)

### 1.1 Политика версий
- **React:** `latest` (stable).
- **Next.js:** `latest` (stable).
- **Node.js:** **LTS** (рекомендуем Active LTS, см. ниже).
- Все зависимости фиксируются через **lockfile** (`pnpm-lock.yaml`) и обновляются контролируемо.

> Примечание по CVE-2025-55182 (React Server Components / “React2Shell”):
> - Уязвимость затрагивала RSC-пакеты в ряде версий и требовала немедленного обновления на патч-ветки.
> - Мы выбираем политику “latest stable” и автоматизацию обновлений, чтобы не отслеживать вручную все линии фиксов.

### 1.2 Автоматизация обновлений
- Включить **Dependabot или Renovate** для:
  - npm/pnpm dependencies (еженедельно)
- CI должен **ломаться**, если найден критичный CVE в runtime-зависимостях (см. Security Gates).

---

## 2) Runtime / Платформа

### 2.1 Языки и рантайм
- **TypeScript** во всех приложениях (api/web/worker).
- **Node.js LTS**.
  - В начале 2026 есть несколько LTS-линий; ориентируемся на **Latest LTS** или **Active LTS** (для новых проектов предпочтительно Active LTS).

Ссылки:
- Node.js releases: https://nodejs.org/en/about/previous-releases

### 2.2 Пакетный менеджер и монорепо
- **pnpm 10.x** (workspace/monorepo friendly).
- Monorepo структура:
  - `apps/api` — NestJS (modular monolith)
  - `apps/worker` — bullmq workers (render + batch)
  - `apps/web` — Next.js (student/teacher UI)
  - `packages/shared` — общие типы/утилиты (минимально)

Ссылки:
- pnpm releases: https://github.com/pnpm/pnpm/releases
- pnpm security defaults (пример релиза 10.26): https://pnpm.io/blog/releases/10.26

---

## 3) Backend (apps/api) — NestJS modular monolith

### 3.1 Framework & core libs
- `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`
- `@nestjs/config` — env config
- `class-validator`, `class-transformer` — DTO validation
- `@nestjs/swagger` — OpenAPI (желательно для AI-агента и быстрой интеграции)

### 3.2 Database
- **PostgreSQL 16**
- **Prisma ORM 7.x**
  - `prisma`, `@prisma/client`

Ссылки:
- Prisma ORM 7: https://www.prisma.io/blog/announcing-prisma-orm-7-0-0
- Prisma system requirements: https://www.prisma.io/docs/orm/reference/system-requirements

### 3.3 AuthN/AuthZ
- `@nestjs/passport`, `passport`
- `passport-local` (логин/пароль)
- `argon2` (хэш паролей)
- `@nestjs/jwt`, `passport-jwt` (JWT access/refresh)
- RBAC через Nest Guards + декораторы ролей

### 3.4 Jobs / очередь задач
- **Redis 7**
- **BullMQ**
  - `bullmq`, `ioredis`

### 3.5 Files / S3
- AWS SDK v3:
  - `@aws-sdk/client-s3`
  - `@aws-sdk/s3-request-presigner`
- Единый модуль Files/Assets (переиспользуется всеми BC: attachments, photos, pdf)

### 3.6 Логи/обсервабилити
- `pino` + `nestjs-pino` 
- Structured logs с `request_id`, `user_id`, `entity_id`

### 3.7 Безопасность API
- `helmet` (HTTP security headers)
- `cors` — строгие origins
- rate limiting:
  - `@nestjs/throttler` (минимум)
- Валидация входных данных во всех write-endpoints (DTO + runtime guards)

---

## 4) Worker (apps/worker) — Rendering & batch recompute

### 4.1 Назначение
- Отдельный процесс(ы), читающие очереди BullMQ:
  - `render_jobs`: Rich LaTeX → PDF
  - `batch_jobs`: пересчёты (publish/unpublish, graph changes)

### 4.2 Библиотеки
- `bullmq`, `ioredis`
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- Prisma client для записи статусов `render_jobs`, `domain_event_log`

### 4.3 Tectonic
- `tectonic` binary внутри контейнера worker
- Требования безопасности:
  - контейнер **не root**
  - ограничение ресурсов (CPU/mem)
  - по возможности отключить внешний egress
  - временная директория per-job, очистка после выполнения
  - запрет произвольных shell-скриптов из LaTeX окружения (sandbox)

---

## 5) Frontend (apps/web) — Next.js + React

### 5.1 Core
- **Next.js** (latest stable)
- **React** (latest stable)
- TypeScript

### 5.2 Data fetching / state
- `@tanstack/react-query` — запросы, кеш, polling (render status, review queue, progress)

### 5.3 Graph editor (teacher)
- `reactflow`

### 5.4 Editors
- **CodeMirror 6**
  - `@uiw/react-codemirror` (или аналог)
  - `@codemirror/lang-...` (latex/markdown), `@codemirror/view`, `@codemirror/state`

### 5.5 LiteTeX (условия/варианты)
- `katex`
- (по необходимости) `remark-math`, `rehype-katex`

### 5.6 PDF без viewer UI (theory/solutions)
- **pdfjs-dist (PDF.js)**
- Собственный компонент viewer:
  - canvas rendering
  - lazy-load страниц
  - без iframe/toolbar

---

## 6) DevOps / Docker / окружения

### 6.1 Docker (dev)
Контейнеры:
- `db` — Postgres 16
- `redis` — Redis 7
- `minio` — S3 compatible
- `api` — NestJS
- `web` — Next.js
- `worker` — BullMQ + Tectonic

### 6.2 Конфигурация
- `.env` в dev (не коммитить)
- `.env.example` (только шаблон)
- секреты в prod: переменные окружения / secret manager

### 6.3 CI/CD (минимум)
- Линт/типизация:
  - `eslint`
  - `typescript --noEmit`
- Тесты (MVP):
  - unit: `vitest` или `jest` (по выбору команды)
- Миграции Prisma:
  - `prisma migrate deploy` в CI/prod
- Build:
  - `api` (Nest)
  - `web` (Next)
  - `worker`

---

## 7) Security Gates (обязательные проверки)

### 7.1 Dependency scanning
- В CI:
  - `pnpm audit --prod` (или эквивалентный)
  - (рекомендуется) OSV Scanner (если используете GitHub Actions)
- Запрет мержа PR при:
  - Critical/High CVE в runtime-зависимостях
  - использовании уязвимых версий `react-server-dom-*`

### 7.2 Supply chain hygiene
- `pnpm-lock.yaml` обязателен
- запрет “скрытых” обновлений без PR
- ограничить выполнение install-scripts (по возможности, особенно для CI)
- минимизировать git-dependencies и пост-инсталлы (по возможности)

### 7.3 Runtime hardening
- API:
  - строгая валидация входа (DTO)
  - rate limit на попытки логина
  - limit на размер upload
- Worker:
  - resource limits (CPU/mem)
  - non-root
  - isolated tmp dirs

### 7.4 Notes about CVE-2025-55182 and related RSC issues
- CVE-2025-55182: критичный pre-auth RCE в React Server Components (RSC) — обновлять React/Next/RSC пакеты.
- Рядом были другие уязвимости в RSC (DoS / source exposure) — дополнительный аргумент держать `latest stable`.

Ссылки (официальные/референсные):
- React advisory: https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components
- NVD: https://nvd.nist.gov/vuln/detail/CVE-2025-55182
- Next.js advisory (downstream): https://nextjs.org/blog/CVE-2025-66478
- Next.js security advisory (GitHub): https://github.com/vercel/next.js/security/advisories/GHSA-9qr9-h5gf-34mp
- Next.js security update (Dec 11, 2025): https://nextjs.org/blog/security-update-2025-12-11
- React RSC additional fixes (DoS/source exposure): https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components

---

## 8) Утилиты и соглашения (для AI-агента)

### 8.1 Команды (стандарт)
- Install: `pnpm i`
- Dev: `pnpm -r dev`
- Build: `pnpm -r build`
- Lint: `pnpm -r lint`
- Typecheck: `pnpm -r typecheck`
- Audit: `pnpm audit --prod`

### 8.2 Правила PR
- Любое изменение зависимостей — отдельный PR (или отдельный коммит) с объяснением причины.
- Security fixes — highest priority.
- Запрещено:
  - коммитить `.env`
  - хранить секреты в репо
  - добавлять зависимости “просто так” без использования

---