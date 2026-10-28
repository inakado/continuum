export function solutionTaskProgress(count: number, total: number) {
  const noun = total % 10 === 1 && total % 100 !== 11 ? 'задания' : 'заданий';
  return `${count} из ${total} ${noun}`;
}
