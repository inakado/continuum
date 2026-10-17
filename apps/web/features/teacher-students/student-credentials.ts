import type { StudentCredential } from "@continuum/shared";

const csvCell = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
export function credentialsCsv(credentials: StudentCredential[], classTitle: string) {
  return "\uFEFF" + [
    ["Класс", "ФИО", "Логин", "Начальный пароль"],
    ...credentials.map((item) => [classTitle, item.name, item.login, item.password]),
  ].map((row) => row.map(csvCell).join(";")).join("\r\n");
}
export function downloadCredentials(credentials: StudentCredential[], classTitle: string) {
  const url = URL.createObjectURL(new Blob([credentialsCsv(credentials, classTitle)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `Доступы-${classTitle.replace(/[^\p{L}\p{N}-]/gu, "_")}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
