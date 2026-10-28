# Быстрый CI и доставка готового релиза

## Цель и границы

Убрать повторную сборку на VPS и повторные тяжёлые проверки одного состава кода. Сохранить audit/Trivy, авторизацию, PostgreSQL volume и S3. Не создавать новый реестр, новые доступы или копии данных на каждом deploy. Бэкапы — отдельный процесс Beget, доступность и покрытие которого проверяются в панели.

## Порядок

1. Определять fingerprint всех отслеживаемых исходников, кроме явного списка инертной документации; неизвестные пути требуют полного CI.
2. CI один раз проверяет/собирает API image и standalone web, публикует неизменяемый artifact с manifest и контрольными суммами. Main повторно использует только успешный artifact того же fingerprint из своего repository/workflow. Security-проверки остаются свежими.
3. Deploy получает готовый пакет, проверяет provenance/checksums/fingerprint, загружает image без build/install, переключает web и делает короткий health check. Миграции требуют отдельного разрешения только при наличии новых миграций.
4. Хранить текущую сборку и один откат, ограничить локальный cache; artifacts CI имеют короткий TTL. Не удалять PostgreSQL volumes, S3 или подтверждённые recovery-копии без замены.
5. Проверить классификацию/повторное использование, повреждённый пакет, пропуск security, staging startup и rollback. Фактическую активацию описать в чате без отдельного отчётного релиза.

## Решения и риски

- Доставка через GitHub Actions artifacts и существующий SSH; GHCR/новые credentials не нужны.
- `next output: standalone` проверяется отдельно до переключения systemd.
- Провайдерские автоматические копии VPS уже видны в Beget; последняя доступная 22.10.2026. Они не являются доказательством согласованного восстановления live PostgreSQL и внешнего S3. Существующий проверенный release backup сохраняется.
- Сбой до переключения не меняет runtime. После переключения возврат к прежнему image/web, без восстановления старого dump поверх новых ответов.

## Проверки и прогресс

Реализация завершена и проверена полным CI. Исходный CI повторял полный build в PR, main и на VPS. Первая production-активация и фактические замеры повторного использования выполняются при выпуске; результат фиксируется в чате без отдельного отчётного релиза.

- Реализованы fingerprint с явным docs allowlist, provenance двух gates, artifact TTL 1 день, standalone-пакет, installer без install/build, проверка миграций/checksums и возврат runtime, retention двух сборок и cache 4 ГБ.
- Локально: 4 Node + 6 Python regression tests, shell/JS/Python/YAML syntax, docs:check, web build/typecheck/boundaries; отдельный standalone HTTP startup проверил login, security headers и 4 статических файла. БД и S3 не менялись.
- По решению владельца оставляем штатные backup Beget, дополнительную схему резервирования и обращение в поддержку не создаём. В панели VPS видны копии 19/22.10; S3 закрыт, versioning не включён, настройки доступа не менялись. Это проверка существующей конфигурации, не результат тестового восстановления provider backup.
- Основания: [Next standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [GitHub artifacts/retention](https://docs.github.com/en/actions/tutorials/store-and-share-data), [Beget backup/snapshot](https://beget.com/ru/kb/how-to/other/backup-i-snapshot-v-chyom-raznica).

- Реальный [CI 40621979012](https://github.com/inakado/continuum/actions/runs/40621979012) прошёл за 3 мин 11 с: quality и security успешны, готовый пакет опубликован. CI выявил избыточную область `NEXT_PUBLIC_API_BASE_URL`; production URL ограничен build/package, два существующих upload/panel теста проходят без изменения ожиданий.

## Замена схемы доставки

На первой подготовке передача Docker-архива 457 МБ через Mac заняла около 5 минут; активация не выполнялась. Проверка также выявила различие config/manifest image ID у Docker CI/VPS. По решению владельца доставка полного image заменена Git + cached build на VPS; см. [план замены](2026-10-28-cached-vps-release.md). Замер main CI 43 с против прежних 274 с подтверждён. Этот документ описывает предыдущий вариант, актуальная схема — в deploy runbook.
