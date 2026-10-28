export const topicLabel = (path: string[]) => path.join(' → ');
export const topicStartsWith = (path: string[], parent: string[]) => parent.every((part, index) => path[index] === part);

export function topicOptions(paths: string[][]) {
  const options = new Map<string, string[]>();
  for (const path of paths) for (let depth = 1; depth <= path.length; depth++) {
    const prefix = path.slice(0, depth);
    options.set(JSON.stringify(prefix), prefix);
  }
  return [...options.values()].sort((a, b) => topicLabel(a).localeCompare(topicLabel(b), 'ru'));
}
export const topicChildren = (options: string[][], parent: string[]) => options.filter((path) => path.length === parent.length + 1 && topicStartsWith(path, parent));
