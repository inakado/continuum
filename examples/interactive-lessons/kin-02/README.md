# КИН-02 «Скорость»

Локальный прототип: `http://localhost:3001/prototype/student/speed` (development).

Общий модуль прототипа и ZIP: [speed-definition.tsx](../../../apps/web/features/student-library/speed/speed-definition.tsx). Текст перенесён из авторского `KIN-02 Скорость/theory/working-theory.tex` без редакторских изменений. Три исходные иллюстрации заменены демонстрациями, дополнительное движение туда-обратно расположено после всего текста. Новые вопросы не добавлены.

Сборка из корня репозитория:

```sh
node scripts/interactive-lessons/build-package.mjs apps/web/features/student-library/speed/speed-definition.tsx output/interactive-lessons
```

Результат: `output/interactive-lessons/kin-02.zip`, диагностические HTML и манифест. Архив импортируется через материалы занятия как обычный пакет v1; исходники и библиотеки уже внутри, сервер ничего не собирает. Публикация остаётся отдельным действием автора.

Принципы и контракт: [INTERACTIVE-LESSONS](../../../documents/INTERACTIVE-LESSONS.md), [INTERACTIVE-PACKAGE](../../../documents/INTERACTIVE-PACKAGE.md). Предметные замечания к неизменённому авторскому тексту и фактические проверки сохранены в execution plan КИН-02.
