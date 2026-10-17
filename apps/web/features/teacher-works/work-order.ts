export function moveWorkItem<T extends { id: string }>(items: T[], id: string, position: number): T[] {
  const from = items.findIndex((item) => item.id === id);
  if (from < 0 || position < 0 || position >= items.length || from === position) return items;
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(position, 0, item);
  return result;
}
export const workDropPosition = (from: number, target: number, after: boolean) => target + Number(after) - Number(from < target);
