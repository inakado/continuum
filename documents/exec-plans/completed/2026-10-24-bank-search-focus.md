# Фокус и очистка поиска в банке

Статус: завершено локально. Без commit/push/deploy.

## Причина и решение

Systematic Debugging: проблема воспроизведена во встроенном браузере. У внешнего label был radius 2px, у вложенного search input вычисленный radius 12px, appearance auto и собственный outline 2px; WebKit рисовал нативный крестик. Получалась внутренняя округлая рамка, не включающая лупу.

Референсы: [Carbon Search](https://www.carbondesignsystem.com/building-blocks/core/components/search/guidelines) — лупа слева, очистка после ввода; [Carbon specifications](https://www.carbondesignsystem.com/building-blocks/core/components/search/specifications) — focus относится к полю; [GOV.UK focus states](https://design-system.service.gov.uk/get-started/focus-states/) — заметный фокус обязателен. Адаптация к текущей белой угловатой теме, без копирования цветов/размеров внешней системы.

В BankFilters внешний div получает единый зелёный контур через focus-within, внутренний input — appearance none/radius 0 без собственного outline. Нативные decoration/cancel скрыты, сохранена семантика type=search. Очистка — настоящий button с aria-label, иконкой X, hover и клавиатурным фокусом. Место резервируется, пустая кнопка скрыта/disabled; ширина ввода не скачет. После очистки фокус возвращается в input, меняется только search через прежний onChange/replaceState. Другие роли и поиски не менялись.

## Проверки и границы

- Web 189/189; component regression проверяет очистку, возврат фокуса, disabled и сохранение темы/ЕГЭ/источника. Web typecheck, boundaries, scoped ESLint BankFilters и production build Webpack прошли.
- Браузер 1280×900 и 390×844: computed input appearance none, radius 0 и outline none; у оболочки radius 2, зелёная граница и 1px shadow. Переполнения нет. Tab достигает очистки, Enter очищает и возвращает фокус; после этого кнопка скрыта и нет search в URL.
- Результат визуально проверен на desktop/mobile; Safari/Firefox отдельно не запускались. Настоящий type=search оставлен; WebKit cancel заменён только в teacher-bank. API/поисковые правила/миграции не менялись.
- Ponystack-contract: один ref для возврата фокуса, прежний callback и CSS; нет дублирующего состояния, общей UI-инфраструктуры или зависимостей. Lean already. Ship.

## Откат

Ограничен BankFilters, teacher-bank CSS и относящимися тестами/документацией; остальные локальные изменения сохраняются.
