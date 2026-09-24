# Design QA — student catalog

## Артефакты

- Source visual truth: `/Users/Alex/.codex/generated_images/01a09e59-7aa7-7e42-87dc-52a30369c188/exec-f6ff193c-481c-4211-9b1e-8e5b0f1f2caf.png`.
- Implementation screenshot path: `http://localhost:3001/student` — финальный capture в Codex in-app Browser.
- Viewport: `1488 × 1058` CSS px, `devicePixelRatio = 1`.
- Source pixels: `1488 × 1058`; implementation capture: `1488 × 1058`; density normalization не требовалась.
- State: авторизованный ученик, выбран `10–11 классы`, четыре раздела по восемь занятий.

## Full-view comparison

Финальная реализация повторяет структуру исходника: header `64px`, grade tabs `71px`, desktop gutter `48px`, title box `y=176`, первая строка секций `y≈285`, list border `y=324`, row height `37px`, колонки `x=48` и `x≈771`. Белый фон, Inter, тонкие серые разделители и зелёный `#0B6B4F` совпадают с выбранным визуальным языком.

## Focused region comparison

- Header: wordmark, divider, «Физика», profile icon/name/chevron выровнены как в source; имя остаётся динамическим.
- Grade navigation: четыре вкладки, зелёная активная вкладка и нижняя линия повторяют source.
- Lesson grid: отдельные колонки `PDF`, `Интерактив`, `Задачи`, нумерация и двухколоночная раскладка повторяют source.
- Mobile `390 × 844`: одна колонка, scrollable tabs и компактная строка форматов без горизонтального overflow.
- Visible image assets отсутствуют; user/chevron icons взяты из установленной icon library, CSS/текстовые подмены не использованы.

## Findings

Actionable P0/P1/P2 differences в финальном capture не осталось.

Допустимые data/runtime differences:

- Имя пользователя берётся из текущей сессии, а не жёстко задано как «Александр».
- Next.js dev-tools badge присутствует только в dev runtime и не входит в production build.

## Comparison history

1. Первый pass: P1 — старый editorial shell не совпадал с выбранной шапкой, tabs и геометрией; P1 — catalog группировал возрастные группы вертикально вместо одной активной вкладки.
2. Fix: добавлены общий `ContinuumHeader`, grade tabs, точные desktop размеры и двухколоночные lesson lists.
3. Второй pass: P2 — на mobile три формата занимали отдельные строки и чрезмерно растягивали список.
4. Fix: форматы объединены в одну responsive группу; desktop позиции сохранены.
5. Финальный pass: desktop и mobile открыты в Codex in-app Browser, основные tabs/profile interactions проверены, console errors отсутствуют.

## Implementation checklist

- [x] Source и implementation открыты и сверены в одинаковом desktop viewport.
- [x] Typography, spacing, colors, icons и copy проверены.
- [x] Grade tabs и profile menu интерактивны.
- [x] Desktop и mobile layout проверены.
- [x] Web typecheck, tests и boundary lint пройдены.

## Проверка формулировок и полировка

- Проверены каталог ученика, страница занятия, материалы учителя, ученики и доступы, вход, защита маршрутов, административная страница, страница «не найдено» и страницы ошибок.
- Активные UI-тексты русские; исключения — общепринятые собственные имена `PDF` и `Excalidraw`, а также вводимые пользователем логины и имена файлов.
- Пустые состояния сокращены до одной полезной фразы; для сетевых ошибок добавлено действие «Повторить».
- На `390 × 844` проверены catalog, no-access empty state и teacher access screen: horizontal overflow отсутствует, touch controls не менее `44px`, длинные заголовки переносятся.
- В чистой вкладке браузера после перезапуска локального сервера ошибки и предупреждения консоли отсутствуют.

final result: passed — student catalog baseline.

## Экран учителя: материалы и PDF задач (2026-09-24)

- Source: выбранный пользователем первый макет экрана материалов, дополненный слотом «Задачи PDF».
- В браузере проверены desktop `1488 × 1058` и mobile `390 × 844`: вкладки классов, плотный список разделов, выбранное занятие и инспектор. Горизонтального переполнения на мобильной ширине не видно.
- Кнопки переименования и загрузки доступны, скрытые файловые поля имеют русские названия. После замены PDF задач интерфейс показал «Версия 2 · черновик»; публикация сняла отметку черновика. Консоль: 0 ошибок; предупреждения касаются preload CSS в Next.js dev runtime.
- Локальный API smoke подтвердил обе PDF-загрузки и получение файлов учеником. Тестовые разделы и S3-объекты после проверки удалены.

final result: passed — desktop/mobile layout и browser upload/publish flow.
