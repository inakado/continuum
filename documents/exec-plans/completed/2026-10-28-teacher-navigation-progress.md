# Навигация учителя и различимость прогресса

Статус: Completed (локальная реализация, без deploy).

## Цель и границы

Сохранить доступ к навигации при прокрутке teacher-экранов и облегчить поиск учеников по состоянию тестовой части в отчёте назначения. Student UI, API, оценивание и сохранённые ответы не меняются.

## Порядок

1. Сверить действующие экраны и первичные референсы.
2. Объединить повторяющиеся верхнюю панель и навигацию учителя в закреплённый компонент.
3. Открыть фильтр тестовых статусов со счётчиками и различить состояния строк.
4. Проверить keyboard, прокрутку, меню, мобильную и desktop раскладки; обновить SoR.

## Решения и источники

- [Carbon UI shell](https://www.carbondesignsystem.com/building-blocks/core/components/ui-shell-header/guidelines): постоянная навигация продукта. Реализация Continuum — нативный CSS sticky без scroll handlers, скрывания, изменения высоты и искусственной плавности прокрутки.
- [MDN position](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position): sticky сохраняет место в потоке и закрепляется в пределах родителя. Панель должна находиться внутри полного page-контейнера.
- [Atlassian Lozenge](https://atlassian.design/components/lozenge): neutral/information/success для состояния; в Continuum подпись и значок дополняют цвет. Завершение теста не означает правильность.
- [Shopify IndexFilters migration](https://shopify.dev/docs/apps/build/app-home/migrate-from-polaris-react/index-filters): небольшой набор состояний можно показывать открыто; сохраняются стабильные значения фильтров. Используем существующий URL status и независимый фильтр фото.

## Риски и rollback

Закрепление не должно перекрывать фокус, меню и диалоги; на телефоне высота ограничена, навигация прокручивается горизонтально. Rollback — возврат прежних teacher навигаций и select статуса; данные не затрагиваются.

## Критерии и проверки

Все teacher-разделы используют одинаковую панель. При прокрутке нет скачков контента и потери навигации; активный раздел доступен на телефоне. Фильтры сохраняют URL, Back/Forward, независимые фото и пагинацию. Boundaries, web typecheck, релевантные component tests и browser QA на desktop/mobile.

## Реализация и результат

- Пять повторов header/navigation заменены `TeacherChrome`, прежние стили навигации удалены. Работы/назначения/статистика сохраняют существующий leave guard.
- Teacher-only `body:has(.chrome) { overflow-x: clip }` устраняет ложного scroll-предка. Первый browser прогон воспроизвёл проблему `hidden`: шапка и table headings уходили выше экрана; после исправления header top 0, navigation top 64, table headings top 128 при прокрутке desktop.
- Меню профиля первоначально повторно ломало sticky: Radix modal scroll lock возвращал `body` overflow hidden, якорь/меню уходили за экран. Общий профиль теперь non-modal для обеих ролей; меню — навигационный список, не диалог. Keyboard, outside dismissal и logout guard сохраняются. Добавлена регрессия отсутствия body scroll lock в существующий keyboard test.
- Активная teacher-ссылка видима после входа и resize, изменяется только горизонтальный scroll навигации. Scroll handlers и новые зависимости не добавлены.
- В отчёте select тестовых статусов заменён четырьмя открытыми кнопками; та же URL-модель, независимые фото, scoped counts и пагинация. В строках — иконка, подпись и существующая нейтральная/синяя/зелёная палитра. Ответы и баллы не меняются.

## Проверки и пределы

- Полный web: 73 файла / 278 тестов прошли после замены навигаций и фильтра.
- После окончательных правок: 25 релевантных тестов header/report/editor прошли, включая keyboard, Escape, закрытие снаружи, logout guard, отсутствие body lock, class/search/photo/status counts, URL и Back/Forward.
- `pnpm lint:boundaries`, web typecheck, `pnpm docs:check`, `git diff --check` прошли.
- UI проверен во внутреннем браузере Codex: 1280×800, 768×900, 375×812, 375×568. Нет горизонтального overflow; на телефоне header top 0, nav top 58; меню профиля внутри экрана (top 59, bottom 165). Проверены Tab/Space, Escape и фильтрация до трёх учеников; desktop headings закреплены под панелью.
- Это реальные `WorksShell`, `ContinuumHeader`, `TeacherChrome`, `AssignmentReportView` и CSS/шрифты в временном Vite-стенде с синтетическими учениками, изолированными auth и Next adapters. Не production smoke и не проверка сети/прав. Стенд и кеш удаляются после QA, остаются только финальные PNG вне репозитория.
- SoR: FRONTEND, ASSESSMENTS и root DESIGN. Нет API/DB-изменений в этой правке. Push/deploy не выполнялись.
