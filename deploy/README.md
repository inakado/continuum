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

Шаблон `deploy/nginx/continuum.conf` разрешает gzip `application/json` только для GET `/api/teacher/assessment-bank`, `/api/teacher/assessment-works`, `/api/teacher/assessment-assignments`, `/api/teacher/assessment-statistics` и `/api/student/assessment-works`, включая вложенные пути. Порог `gzip_min_length 1024` применяется при известном `Content-Length`; маленькие ответы без него Nginx может сжимать. `Vary: Accept-Encoding` включён, `Cache-Control: no-store` и авторизация не изменяются.

Auth, ученики/сброс паролей, подключение агента/ключи и все не-GET ответы исключены по умолчанию. PNG/PDF/ZIP не входят в `gzip_types`. Это не публичный кеш и не дополнительный middleware API. При добавлении нового секретного GET внутрь разрешённого namespace отдельно проверить эту политику.

Локальная проверка реального production template с синтетическим upstream, без production-данных:

```bash
node --test deploy/scripts/test-nginx-gzip.mjs
```

Требуются Docker, OpenSSL и уже доступный локально образ `nginx:alpine` (можно задать `NGINX_TEST_IMAGE`). Тест не скачивает образы, создаёт временный сертификат и контейнер с портом только на `127.0.0.1`, затем удаляет их. Проверяет JSON gzip/identity, прежний upstream URI/query, `no-store`, исключения, малый ответ и недоступность `/api/internal/`.

`deploy-on-vps.sh` не устанавливает Nginx-конфиг автоматически. При разрешённом выпуске перенести map и location-директивы в установленный domain-specific конфиг, сохранив домен/сертификаты; сделать backup, `sudo nginx -t` и только затем reload. После выпуска проверить авторизованный GET отчёта с `Accept-Encoding: gzip` и `identity`: одинаковое распакованное тело, меньший размер, прежние права/`no-store`. Для rollback вернуть backup и повторить `nginx -t` перед reload.

## CI и проверенный состав исходников

CI определяет fingerprint отслеживаемого кода, включая зависимости, Dockerfile, workflow и deploy-скрипты. Только явный список инертных Markdown-документов исключён; неизвестный путь требует полного quality-прохода.

- `quality`: docs/lint/boundaries/build/typecheck/tests. После успеха публикуется только маленькая отметка `checked-<fingerprint>`, без Docker/web-архивов.
- На main тяжёлые проверки повторно используются только из успешного CI того же repository/workflow/fingerprint с успешными quality **и** security. Ошибка GitHub API блокирует выпуск.
- `security` всегда выполняется заново: полный `pnpm audit --audit-level=high` и Trivy HIGH/CRITICAL без исключений.
- Отметка CI живёт **1 день**; после истечения нужен новый CI. На VPS тесты не дублируются.

## Ручной deploy исходников

На компьютере оператора нужны Node.js 24, авторизованный `gh` и существующий SSH alias `continuum-vps` с проверенным host key:

```bash
node deploy/scripts/release.mjs
# либо полный SHA из main с успешным CI:
node deploy/scripts/release.mjs <40-character-main-sha>
```

Клиент проверяет свежий успешный CI точного main revision и отметку проверенного fingerprint, затем вызывает SSH. На VPS выполняются только `git fetch` изменений и сборка с существующим кешем. Полный проект, зависимости и Docker-архив через компьютер оператора не передаются.

API собирается Docker BuildKit. Web собирается из `git archive HEAD` в отдельном временном каталоге; `pnpm install --prefer-offline --frozen-lockfile --prod=false` использует pnpm store, сохраняется один Next cache. Работающий `.next` не перезаписывается. Ресурсы `public` копируются с раскрытием symlink; перед переключением проверяются MathJax и отсутствие внешних/нерабочих ссылок. Из сборки сохраняются standalone web и image с неизменяемым тегом fingerprint; временные исходники и `node_modules` удаляются. Runtime переключается только после успешной сборки и проверки истории миграций. При ошибке активации возвращается прежний API/web без reset БД.

CI собирает API для тестового quality-контекста; VPS — production runtime. Это осознанный компромисс вместо передачи полного Docker-архива. Main не повторяет уже выполненный полный quality CI.

Для первого перехода нужен launcher `deploy/systemd/continuum-web.service`, установленный администратором после staging-проверки. Он поддерживает возврат к прежнему Next runtime, пока нет предыдущей standalone-сборки. `PREPARE_ONLY=yes` готовит runtime без переключения сервисов.

Кнопка `Deploy Production` вызывает тот же клиент. Для неё отдельно требуются production environment secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`; host key проверяется строго. Локальная команда использует уже имеющийся SSH.

## Данные и резервное копирование

Обычный deploy **не создаёт** dump, копию bucket или архив web. Он сохраняет PostgreSQL volume и S3, меняет только исполняемые сборки. Новые миграции требуют `MIGRATIONS_APPROVED=yes BACKUP_CONFIRMED=yes`; при неизменной схеме подтверждения не нужны. Неполная/изменённая история миграций блокирует переключение.

По решению владельца основной механизм резервирования — Beget, отдельно от релизов. Автокопии VPS доступны в панели; их периодичность, актуальность и восстановимость проверяются там. Наличие файловой копии не является результатом проверочного восстановления live PostgreSQL; S3 — отдельное хранилище. Деплой не меняет настройки Beget/S3 и не удаляет существующую проверенную recovery-копию 28.10.2026.

## Хранение и откат

После успешного переключения остаются текущая и одна предыдущая web-сборка/API image. Очистка затрагивает только release-каталог и неиспользуемые образы Continuum; volumes, S3, другие проекты и backup данных исключены. Build cache сокращается до 4 ГБ; входящих Docker/web-архивов нет; Next cache хранится в одном каталоге.

Текущий/предыдущий runtime записываются в `deploy/runtime/current.json` и `previous.json`; `deploy/current` указывает на web. Во время неудачной активации скрипт возвращает прежний runtime автоматически. Схема БД не откатывается автоматически: совместимость миграций проверяют до разрешения выпуска. Старый dump нельзя накатывать поверх новых ответов учеников как часть обычного rollback.

## Cutover новой версии

Cutover новой library baseline выполнен 2026-09-23 на commit `09315f6`:

- старые учебные данные и сессии удалены;
- существующие auth identities и профили сохранены;
- object storage проверен и очищен;
- worker, Redis и TeX Live удалены из runtime;
- production auth smoke и публичные health/login checks прошли.

Следующие deploy используют проверенные исходники и кеш VPS и совместимые миграции через `deploy-on-vps.sh`. Новый destructive reset не является частью штатного deploy.

Минимальный rollback:

1. вернуть предыдущий Git revision;
2. вернуть соответствующий `docker-compose.prod.yml`;
3. поднять прежний API runtime;
4. перезапустить `continuum-web`;
5. проверить `/api/health` и `/login`.

После destructive reset откат данных невозможен; rollback сохраняет только предыдущий код/runtime.

## Проверка после deploy

```bash
curl -fsS https://vl-physics.ru/api/health
curl -fsS https://vl-physics.ru/api/ready
curl -fsS https://vl-physics.ru/login >/dev/null
docker compose -f docker-compose.prod.yml ps
```

Library API уже работает: при приёмке выпуска проверять доступ к опубликованному занятию и запрет direct-link для ученика без доступа. Перед ученическим пилотом дополнительно проверить реальную загрузку и повторное открытие фото с телефона; health/login не подтверждают сохранность ответов и файлов.
