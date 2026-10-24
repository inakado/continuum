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

## Ручной deploy

До cutover новой схемы команда не запускается. После явного подтверждения:

```bash
ssh continuum-vps
sudo -iu deploy
cd /srv/continuum
git fetch --all --prune
git checkout main
git merge --ff-only origin/main
MIGRATIONS_APPROVED=yes APP_DOMAIN=vl-physics.ru ./deploy/scripts/deploy-on-vps.sh
```

Скрипт:

1. проверяет пользователя, Git, Node, pnpm и env;
2. устанавливает frozen dependencies;
3. поднимает PostgreSQL;
4. собирает API, затем shared contracts и web (`pnpm build:web`);
5. применяет Prisma migrations только при `MIGRATIONS_APPROVED=yes`;
6. перезапускает API и `continuum-web`;
7. проверяет локальные и публичные health/login endpoints;
8. при заданных auth-smoke credentials проверяет Better Auth и защищённый `GET /me`.

## Cutover новой версии

Cutover новой library baseline выполнен 2026-09-23 на commit `09315f6`:

- старые учебные данные и сессии удалены;
- существующие auth identities и профили сохранены;
- object storage проверен и очищен;
- worker, Redis и TeX Live удалены из runtime;
- production auth smoke и публичные health/login checks прошли.

Следующие deploy выполняются как обычные совместимые миграции через `deploy-on-vps.sh`. Новый destructive reset не является частью штатного deploy.

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

После появления Library API smoke расширяется проверкой доступа к опубликованному занятию и запрета direct-link для ученика без доступа.
