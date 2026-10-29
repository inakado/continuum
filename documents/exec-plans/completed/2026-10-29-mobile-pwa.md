# Установка Континуума на главный экран

Статус: Completed локально. Дата: 29.10.2026. Production не изменён.

## Цель и границы

Установка через браузер iPhone/Android с пользовательским знаком, запуск без браузерных панелей, обычная навигация обеих ролей. Общий root metadata/manifest; доменные API, авторизация и сохранение ответов не меняются. Offline, push, рекламные install-баннеры и новые зависимости вне scope.

## Источники и решения

- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps): manifest и установка допустимы без offline. Service worker ради формальной установки не вводится.
- [Google install criteria](https://web.dev/articles/install-criteria): HTTPS, имя, start URL, standalone, PNG 192/512. Стабильные `id`, `start_url`, `scope` равны `/`: установка с частного экрана не закрепляет чужой ID/параметры.
- Исходный `/` безусловно перенаправлял на login. Для холодного запуска добавлен минимальный `AppEntry` на существующем `useAuthSession`: действующая сессия открывает свой раздел, отсутствие — вход, сетевая ошибка — явный повтор без выхода. RoleGuard и серверные проверки не меняются.
- [WebKit Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/): Home Screen web apps; Apple metadata сохраняет совместимость с предыдущими iOS.
- [Google maskable icons](https://web.dev/articles/maskable-icon): отдельная непрозрачная maskable-иконка, знак внутри центрального круга радиуса 40% ширины. Углы применяет ОС, не изображение.
- `statusBarStyle: default`, белый theme color. `viewport-fit: cover` не включается: ОС сохраняет безопасную область, контент не уходит под вырез/индикатор жеста; масштабирование доступно.
- Поставленный знак найден в Downloads/Telegram Desktop под тем же именем, Desktop-копия уже отсутствует. Знак не перерисовывается; только экспорт размеров и дополнительное поле maskable. Обновляются также обе favicon.ico (public и App Router).
- Login использует динамическую высоту; общий Dialog ограничен текущим viewport. Остальные role-specific layouts не требуют расширения под вырез.
- Responsive QA выявил 15 px в полях входа; на телефоне увеличено до 16 px, чтобы фокус не вызывал масштабирование iOS. Доступный пользовательский zoom не ограничен.

## Порядок и критерии завершения

1. Root metadata, manifest и иконки.
2. Проверить настоящий Next HTML, MIME/доступность manifest и PNG, размеры/непрозрачность/безопасную область.
3. Мобильный/desktop layout во внутреннем браузере, typecheck, boundaries, релевантные тесты и docs checks.
4. Зафиксировать поведение в FRONTEND; закрыть локальный план. Production выпуск — отдельная команда пользователя.

## Риски и откат

Нужен HTTPS production. Иконка существующей установки может кешироваться ОС: удалить старую и установить снова. Desktop browser QA не заменяет установку, закрытие и повторный запуск на реальных iPhone/Android. При первом открытии может понадобиться вход; session cookies и срок сессии не меняются. Откат — вернуть root metadata, manifest, иконки и две CSS-правки, без миграций.

## Проверки

- `pnpm --filter web typecheck`, `pnpm lint:boundaries`, `pnpm docs:check` — прошли.
- Полный web suite: 75 файлов / 292 теста; после финальной CSS-правки auth suite: 3 файла / 17 тестов.
- Настоящий Next 16.4.1 в отдельном временном проекте: импортированы исходные root layout/page/login, TeacherChrome, StudentWorksShell и Dialog; для проверки сессии — только синтетический auth endpoint. Исходные features и UI не копировались. Проверены реальные HTML meta viewport/theme/application-name/mobile-web-app-capable/Apple title/status bar, manifest и icon links.
- Manifest возвращает `200 application/manifest+json`, все PNG/ICO — `200` с подходящим MIME. Размеры PNG 192/512/180, все home-screen иконки RGB без alpha; favicon ICO содержит 16/32/48 и совпадает в app/public. У maskable тёмная часть знака помещается в круг радиуса 177.66 px при допустимых 204.8 px.
- Внутренний браузер: login 390×844 и 1280×800 без горизонтального overflow/лишней высоты, поля mobile 16 px. Настоящие teacher/student shells — без горизонтального overflow на обеих ширинах; teacher header остаётся сверху при прокрутке. Общий Dialog при 390×320 занимает y=12…308, высота 296 px, внутренний overflow auto; Escape закрывает.
- Холодный вход с синтетической teacher-сессией открыл `/teacher`; ошибка API оставила `/` с кнопкой «Повторить» высотой 44.5 px, после восстановления student-сессии повтор открыл `/student`; null-сессия открыла `/login`. Admin дополнительно покрыт unit-тестом.
- Снимок настоящего login: `pwa-login-mobile.png` в папке визуализаций текущего чата. Это responsive screenshot, не имитация физически установленного приложения.
- Contract review: только нативные metadata/manifest, статические иконки и минимальный session-aware launch; нет новых dependencies, SW, storage, install prompts или отдельного PWA shell.
- Временный Next-сервер, его каталог/кеш и браузерная вкладка удалены после проверки; viewport override сброшен. Физическая установка на iPhone/Android остаётся приёмкой после выпуска.

Release CI выявил несовместимость PNG RGB внутри ICO с Linux Turbopack: «The PNG is not in RGBA format». Оба favicon.ico переупакованы в RGBA; RGB-пиксели, непрозрачность и размеры 16/32/48 сохранены, копии app/public совпадают. Home-screen PNG остаются исходными RGB. Production build CI служит проверкой декодирования.
