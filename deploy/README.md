# Production deploy

Production deploy выполняется только по явной команде владельца проекта. Source of truth — `docker-compose.prod.yml` и `deploy/scripts/deploy-on-vps.sh`.

## Runtime

- Next.js web запускается systemd unit `continuum-web`.
- NestJS API и PostgreSQL запускаются через Docker Compose.
- Object storage — внешний S3-compatible provider.
- Worker, Redis и TeX Live в новой версии отсутствуют.

## Требования VPS

- пользователь `deploy`, не `root`;
- репозиторий в `/srv/continuum` или `APP_DIR`;
- чистый Git working tree;
- Node.js 24;
- pnpm 10.11.1;
- Docker Compose;
- `deploy/env/api.env` и `deploy/env/postgres.env`;
- permission на `sudo -n systemctl restart continuum-web`.

## Новая установка и перенос на другой VPS

Домен, SSH target и каталог не зашиты в код. На компьютере оператора скопировать `deploy/env/target.env.example` в игнорируемый `deploy/env/target.env` и задать `APP_DOMAIN`, `SSH_TARGET`, `APP_DIR`. Можно указать другой файл через `DEPLOY_CONFIG` или переопределить значения одноимёнными env. `APP_DOMAIN` — lowercase hostname без схемы, порта и пути; `SSH_TARGET` должен входить непосредственно пользователем `deploy`. В GitHub repository variable `APP_DOMAIN` задать тот же hostname для CI и кнопки Deploy; `APP_DIR` необязателен, default `/srv/continuum`.

Порядок первичной установки:

1. Сверить SSH host key с консолью провайдера; создать отдельный operator SSH key. Передать на новый VPS `bootstrap-vps.sh` и только публичную часть operator key.
2. Выполнить bootstrap от root с `APP_DIR` и `DEPLOY_PUBLIC_KEY_FILE`. Скрипт ставит Docker из официального apt repository, Node 24/pnpm, Nginx/Certbot, создаёт `deploy`, ограниченное systemctl sudo, firewall 22/80/443, ротацию Docker logs и дополнительный swap 2 ГБ. Он не клонирует код и не запускает приложение.
3. Проверить отдельную SSH-сессию `deploy`. На VPS создать отдельную пару для read-only GitHub deploy key; публичную часть добавить в Settings → Deploy keys нужного репозитория. Проверить GitHub host key по официальным fingerprints. Приватный ключ VPS не копировать на Mac/GitHub. Склонировать проверяемый репозиторий в `APP_DIR` от `deploy`.
4. Создать закрытые env-файлы из примеров, права `600`; секреты не печатать и не передавать literal CLI-аргументами. PostgreSQL должен иметь одинаковые credentials в обоих env. Bucket заранее создать private у выбранного S3 provider и проверить SDK/подписанные ссылки.
5. После клонирования повторить bootstrap с `APP_DOMAIN`: установятся systemd launcher и Nginx. Если сертификата ещё нет, используется HTTP-only ACME config, затем Certbot и HTTPS template. Нужны рабочие DNS и порты 80/443. Сертификат получается без контактного email; работает `certbot.timer`, deploy hook проверяет конфигурацию и перезагружает Nginx после обновления сертификата. Проверка: `certbot renew --dry-run --run-deploy-hooks --cert-name "$APP_DOMAIN"`.
6. Только после проверенного `deploy` SSH разрешён `HARDEN_SSH=yes`: отключаются password/keyboard-interactive SSH; root сохраняет только key-login для аварийного администрирования. Доступ Docker group фактически даёт root-возможности.
7. Провести CI выбранного main revision и выполнить первый выпуск с `INITIAL_DEPLOY=yes MIGRATIONS_APPROVED=yes`. Этот режим допускается только без прежнего runtime/metadata и при **пустой целевой БД**. Непустая неизвестная БД блокирует запуск; никакого reset нет. `BACKUP_CONFIRMED` для действительно пустой установки не выдумывается. `PREPARE_ONLY=yes` позволяет сначала подготовить runtime без миграций/активации.
8. Создать начальных преподавателей через `apps/api/scripts/bootstrap-teachers.mjs`: JSON-массив `{login,password}` передаётся stdin в `docker compose -f docker-compose.prod.yml exec -T api node apps/api/scripts/bootstrap-teachers.mjs`. Скрипт использует IdentityProvisioningService, создаёт teacher/credential/TeacherProfile; display name изначально равен login. Он отказывается от посторонних пользователей и не меняет пароль при повторе. `seed-users.mjs` для production не использовать: он создаёт демонстрационного ученика.

При переезде создаётся новый target.env и новые серверные credentials; контейнерная архитектура и source delivery остаются прежними. `continuum-web.service` устанавливается bootstrap с выбранным `APP_DIR`. Web build и release manifest обязаны совпадать по `https://APP_DOMAIN/api`; одной смены runtime env недостаточно. Подготовленный web привязан к origin: на новом VPS он собирается заново; несоответствующий cached runtime не активируется.

Если первый запуск прервался после миграций, не повторять initial mode поверх непустой БД: диагностировать историю, применить исправленную миграцию тем же image и запустить API, затем использовать обычный forward deploy. Не удалять volume ради повторения команды.

## Обязательные env

В `deploy/env/api.env`:

- `BETTER_AUTH_SECRET` не короче 32 символов;
- `BETTER_AUTH_URL`;
- `WEB_ORIGIN`;
- `CORS_ORIGIN`;
- `DATABASE_URL` или `POSTGRES_*`;
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, credentials и public base URL.

Загрузка файлов идёт через авторизованный API; CORS для S3 не требуется. В Nginx у `location /api/` нужны `client_max_body_size 210m`, `proxy_read_timeout 300s` и `proxy_send_timeout 300s` для ZIP-черновиков до 200 МиБ. Перед деплоем новой версии обновить установленный Nginx-конфиг по `deploy/nginx/continuum.conf`, выполнить `nginx -t` и reload.

### Сжатие JSON

Шаблон `deploy/nginx/continuum.conf` разрешает gzip `application/json` только для GET `/api/teacher/assessment-bank`, `/api/teacher/assessment-works`, `/api/teacher/assessment-assignments`, `/api/teacher/assessment-statistics` и `/api/student/assessment-works`, включая вложенные пути, а также для точного GET `/api/{teacher|student}/library/artifacts/:id/interactive`. Документ лекции содержит manifest/HTML без пользовательских session tokens и ответов ученика; другие library routes не разрешены. Порог `gzip_min_length 1024` применяется при известном `Content-Length`; маленькие ответы без него Nginx может сжимать. `Vary: Accept-Encoding` включён, `Cache-Control: no-store` и авторизация не изменяются.

Auth, ученики/сброс паролей, подключение агента/ключи и все не-GET ответы исключены по умолчанию. PNG/PDF/ZIP не входят в `gzip_types`. Это не публичный кеш и не дополнительный middleware API. При добавлении нового секретного GET внутрь разрешённого namespace отдельно проверить эту политику.

Локальная проверка реального production template с синтетическим upstream, без production-данных:

```bash
node --test deploy/scripts/test-nginx-gzip.mjs
```

Требуются Docker, OpenSSL и уже доступный локально образ `nginx:alpine` (можно задать `NGINX_TEST_IMAGE`). Тест не скачивает образы, создаёт временный сертификат и контейнер с портом только на `127.0.0.1`, затем удаляет их. Проверяет JSON gzip/identity, прежний upstream URI/query, `no-store`, исключения, малый ответ и недоступность `/api/internal/`.

`deploy-on-vps.sh` не устанавливает Nginx-конфиг автоматически. При разрешённом выпуске перенести map и location-директивы в установленный domain-specific конфиг, сохранив домен/сертификаты; сделать backup, `sudo nginx -t` и только затем reload. После выпуска проверить авторизованный GET отчёта с `Accept-Encoding: gzip` и `identity`: одинаковое распакованное тело, меньший размер, прежние права/`no-store`. При ошибке конфигурации исправить её и повторить `nginx -t` перед reload.

## CI и проверенный состав исходников

CI определяет fingerprint отслеживаемого кода, включая зависимости, Dockerfile, workflow и deploy-скрипты. Только явный список инертных Markdown-документов исключён; неизвестный путь требует полного quality-прохода.

- `quality`: docs/lint/boundaries/build/typecheck/tests. После успеха публикуется только маленькая отметка `checked-<fingerprint>`, без Docker/web-архивов.
- На main тяжёлые проверки повторно используются только из успешного CI того же repository/workflow/fingerprint с успешными quality **и** security. Ошибка GitHub API блокирует выпуск.
- `security` всегда выполняется заново: полный `pnpm audit --audit-level=high` и Trivy HIGH/CRITICAL без исключений.
- Отметка CI живёт **1 день**; после истечения нужен новый CI. На VPS тесты не дублируются.

## Ручной deploy исходников

На компьютере оператора нужны Node.js 24, авторизованный `gh` и заполненный `deploy/env/target.env` с SSH target и проверенным host key:

```bash
node deploy/scripts/release.mjs
# либо полный SHA из main с успешным CI:
node deploy/scripts/release.mjs <40-character-main-sha>
```

Клиент проверяет свежий успешный CI точного main revision и отметку проверенного fingerprint, затем вызывает SSH. На VPS выполняются только `git fetch` изменений и сборка с существующим кешем. Полный проект, зависимости и Docker-архив через компьютер оператора не передаются.

API собирается Docker BuildKit. Web собирается из `git archive HEAD` в отдельном временном каталоге; `pnpm install --prefer-offline --frozen-lockfile --prod=false` использует pnpm store, сохраняется один Next cache. Работающий `.next` не перезаписывается. Ресурсы `public` копируются с раскрытием symlink; перед переключением проверяются MathJax и отсутствие внешних/нерабочих ссылок. Из сборки сохраняются standalone web и image с неизменяемым тегом fingerprint; временные исходники и `node_modules` удаляются. Runtime переключается только после успешной сборки и проверки истории миграций. При ошибке активации скрипт завершается с ошибкой и сохраняет достигнутое состояние API/web и БД. Восстановление выполняется выпуском исправленной сборки.

После `PREPARE_ONLY=yes` активация использует сохранённый image без повторной сборки, включая INITIAL_DEPLOY. Docker provenance может менять digest даже при неизменных исходниках; digest уже подготовленного runtime не подменяется. Закрытые `deploy/env/*.env` исключены из Docker build context.

CI собирает API для тестового quality-контекста; VPS — production runtime. Это осознанный компромисс вместо передачи полного Docker-архива. Main не повторяет уже выполненный полный quality CI.

Для первого перехода нужен launcher `deploy/systemd/continuum-web.service`, установленный bootstrap после подготовки сервера. Он запускает выбранный standalone web; legacy launcher нужен только до первого перехода на standalone. `PREPARE_ONLY=yes` готовит runtime без переключения сервисов.

Кнопка `Deploy Production` вызывает тот же клиент. Для неё отдельно требуются production environment secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`; host key проверяется строго. Локальная команда использует уже имеющийся SSH.

## Данные и резервное копирование

Обычный deploy **не создаёт** dump, копию bucket или архив web. Он сохраняет PostgreSQL volume и S3, меняет только исполняемые сборки. Новые миграции требуют `MIGRATIONS_APPROVED=yes BACKUP_CONFIRMED=yes`; при неизменной схеме подтверждения не нужны. Неполная/изменённая история миграций блокирует переключение.

После переноса VPS и S3 могут принадлежать разным провайдерам. Provider snapshots не заменяют согласованный recovery-набор PostgreSQL + S3, а копия на том же VPS не переживёт потерю VPS. Актуальную схему, расписание и проверку восстановления фиксировать в active execution plan; наличие регулярного offsite-backup не подразумевается самим успешным deploy. Историческая копия на Beget не считается доступной резервной копией нового production.

## Хранение и восстановление

После успешного переключения остаются текущая и одна предыдущая web-сборка/API image. Очистка затрагивает только release-каталог и неиспользуемые образы Continuum; volumes, S3, другие проекты и backup данных исключены. Build cache сокращается до 4 ГБ; входящих Docker/web-архивов нет; Next cache хранится в одном каталоге.

Временные каталоги `deploy/releases/.prepare-XXXXXX` и служебные `candidate.json`, `applied.json`, `release.json` очищаются под `deploy.lock` при успешном завершении, ошибке, SIGINT и SIGTERM. Остатки после SIGKILL или отключения питания убираются при следующем запуске под той же блокировкой. Проверки runtime и ресурсов выполняются до переноса временного каталога в постоянный.

`deploy/releases/<fingerprint>/web` содержит исполняемую сборку текущего проекта. `PREPARE_ONLY=yes` сохраняет проверенную сборку для последующего переключения; временные исходники и `node_modules` при этом уже удалены. Текущий и предыдущий runtime, их metadata, `deploy.lock` и используемые кеши сохраняются.

Ручная очистка оставшихся временных каталогов, старых сборок и образов выполняется тем же скриптом, без перезапуска приложения:

```bash
cd /srv/continuum
flock -n deploy/runtime/deploy.lock python3 deploy/scripts/prune-releases.py "$PWD/deploy"
```

Текущий/предыдущий runtime записываются в `deploy/runtime/current.json` и `previous.json` для учёта поставок и ограниченной очистки; `deploy/current` указывает на выбранный web. Восстановление выполняется только вперёд — выпуском исправленной сборки для актуальной схемы и модели данных.

При ошибке сборки работающий runtime ещё не менялся. Если ошибка произошла после начала активации, скрипт возвращает ненулевой статус и fingerprint кандидата, сохраняет достигнутое состояние сервисов и БД, очищает только временные артефакты. API/web могут оказаться переключены частично и временно недоступны. `current.json` до успешной приёмки остаётся последним подтверждённым релизом; фактическое состояние проверяется по Docker image и `deploy/current`.

Для восстановления исправить причину, провести CI нового состава исходников и выпустить исправленную сборку. После миграций подтверждать совместимость именно с актуальной БД. Если миграция завершилась ошибкой, сначала диагностировать Prisma migration history; не обходить проверку checksum. Пользовательские ответы, назначения, файлы и актуальная БД сохраняются; reset или восстановление старого dump не входят в обычную поставку.

## Проверка после deploy

```bash
curl -fsS "https://$APP_DOMAIN/api/health"
curl -fsS "https://$APP_DOMAIN/api/ready"
curl -fsS "https://$APP_DOMAIN/login" >/dev/null
docker compose -f docker-compose.prod.yml ps
```

Library API уже работает: при приёмке выпуска проверять доступ к опубликованному занятию и запрет direct-link для ученика без доступа. `/ready` проверяет PostgreSQL, но не S3: отдельно выполнить реальный upload/readback и signed GET. Перед ученическим пилотом дополнительно проверить реальную загрузку и повторное открытие фото с телефона; health/login не подтверждают сохранность ответов и файлов.
