const letters = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ';
export const matchingPositionLabel = (index: number) => letters[index] ?? String(index + 1);

export function matchingPositionText(content: string, index: number) {
  const labels = [matchingPositionLabel(index), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[index]].filter(Boolean).join('|');
  return content.replace(new RegExp(`^\\s*(?:${labels})[).]\\s+`, 'u'), '');
}
