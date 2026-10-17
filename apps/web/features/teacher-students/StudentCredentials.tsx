"use client";

import type { StudentCredential } from "@continuum/shared";
import { Download, Printer } from "lucide-react";
import { downloadCredentials } from "./student-credentials";
import styles from "./school-classes.module.css";

export default function StudentCredentials({ credentials, classTitle, onDone }: { credentials: StudentCredential[]; classTitle: string; onDone: () => void }) {
  return <section>
    <div className={styles.sectionHeading}><div><h2>Доступы готовы</h2><p>{classTitle} · Учётных записей: {credentials.length}</p></div>
      <div className={styles.actions}>
        <button className={styles.primary} onClick={() => downloadCredentials(credentials, classTitle)}><Download size={17} aria-hidden="true" />Скачать таблицу CSV</button>
        <button className={styles.secondary} onClick={() => window.print()}><Printer size={17} aria-hidden="true" />Карточки для печати</button>
      </div>
    </div>
    <p className={styles.notice}>Сохраните доступы перед закрытием. Повторно посмотреть пароли нельзя — только сбросить. Общую таблицу не отправляйте ученикам.</p>
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Ученик</th><th>Логин</th><th>Начальный пароль</th></tr></thead>
      <tbody>{credentials.map((item) => <tr key={item.id}><td>{item.name}</td><td><code>{item.login}</code></td><td><code>{item.password}</code></td></tr>)}</tbody>
    </table></div>
    <div className={styles.footer}><span>Карточки можно сохранить в PDF через окно печати.</span><button className={styles.secondary} onClick={onDone}>К списку учеников</button></div>
    <div className={styles.printArea}>
      {credentials.map((item) => <article className={styles.printCard} key={item.id}>
        <h2 className={styles.printName}>{item.name}</h2>
        <p>Адрес: {typeof window !== "undefined" ? window.location.origin : ""}/login</p>
        <p>Логин: <code>{item.login}</code></p><p>Пароль: <code>{item.password}</code></p>
      </article>)}
    </div>
  </section>;
}
