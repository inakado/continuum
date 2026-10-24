import type { AssessmentStatistics, ScoreDistribution, StatisticsCell, StatisticsStudent, StatisticsSummary } from '@continuum/shared';
import { answersSchema, type WorkSnapshot } from './assignment-data';
import { gradeAssessmentAnswer } from '../common/assessment-grading';

export type StatisticsRecipient = {
  id: string; assignmentId: string; studentName: string; studentLogin: string; answers: object;
  startedAt: Date | null; completedAt: Date | null; points: number | null;
};
export type StatisticsSolution = { recipientId: string; taskId: string; hasPhotos: boolean; points: number | null };

export function statisticsStudent(snapshot: WorkSnapshot, row: StatisticsRecipient, solutions: Map<string, StatisticsSolution>): StatisticsStudent {
  const answers = answersSchema.parse(row.answers);
  const computed = snapshot.items.map((item) => item.data.task.type === 'extended' ? null : gradeAssessmentAnswer(item.data.task, answers[item.taskId] ?? null));
  // Historical totals remain authoritative: never silently replace a recorded result.
  const consistent = row.completedAt !== null && row.points !== null && computed.reduce<number>((sum, value) => sum + (value ?? 0), 0) === row.points;
  const scores: StatisticsCell[] = snapshot.items.map((item, index) => {
    if (item.data.task.type !== 'extended') {
      if (!row.completedAt) return { state: row.startedAt ? 'in_progress' : 'not_started' };
      return consistent ? { state: 'scored', points: computed[index]! } : { state: 'unavailable' };
    }
    const solution = solutions.get(`${row.id}:${item.taskId}`);
    if (solution?.points != null && solution.points <= item.data.task.maxPoints) return { state: 'scored', points: solution.points };
    return { state: solution?.hasPhotos ? 'awaiting_review' : 'no_photos' };
  });
  function part(extended: boolean) {
    const selected = scores.filter((_, index) => (snapshot.items[index].data.task.type === 'extended') === extended);
    return selected.length && selected.every((cell) => cell.state === 'scored') ? selected.reduce((sum, cell) => sum + (cell.state === 'scored' ? cell.points : 0), 0) : null;
  }
  const automaticPoints = row.completedAt ? row.points : null;
  const extendedPoints = part(true);
  const ready = snapshot.items.every((item, index) => item.data.task.type === 'extended' ? scores[index].state === 'scored' : row.completedAt !== null && row.points !== null);
  return { id: row.id, assignmentId: row.assignmentId, name: row.studentName, login: row.studentLogin, scores,
    automaticPoints, extendedPoints, totalPoints: ready ? (automaticPoints ?? 0) + (extendedPoints ?? 0) : null };
}

export function scoreDistribution(students: StatisticsStudent[], index: number, maxPoints: number): ScoreDistribution {
  const counts = Array<number>(maxPoints + 1).fill(0);
  let scoredCount = 0;
  for (const student of students) {
    const cell = student.scores[index];
    if (cell.state === 'scored') { counts[cell.points]++; scoredCount++; }
  }
  return { scoredCount, pendingCount: students.length - scoredCount,
    buckets: counts.map((count, points) => ({ points, count, percentage: scoredCount ? Math.round(count / scoredCount * 1000) / 10 : null })) };
}

export function statisticsScope(snapshot: WorkSnapshot, students: StatisticsStudent[]): { summary: StatisticsSummary; distributions: ScoreDistribution[] } {
  const max = (extended: boolean) => snapshot.items.filter((item) => (item.data.task.type === 'extended') === extended).reduce((sum, item) => sum + item.data.task.maxPoints, 0);
  function part(key: 'automaticPoints' | 'extendedPoints' | 'totalPoints', maxPoints: number) {
    const values = students.flatMap((student) => student[key] === null ? [] : [student[key]]);
    return { maxPoints, scoredCount: values.length, averagePoints: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100 : null };
  }
  const automaticMax = max(false), extendedMax = max(true);
  return { summary: { studentCount: students.length, finalCount: students.filter((student) => student.totalPoints !== null).length,
    automatic: part('automaticPoints', automaticMax), extended: part('extendedPoints', extendedMax), total: part('totalPoints', automaticMax + extendedMax) },
    distributions: snapshot.items.map((item, index) => scoreDistribution(students, index, item.data.task.maxPoints)) };
}

export function buildStatistics(snapshot: WorkSnapshot, recipients: StatisticsRecipient[], solutions: StatisticsSolution[], classes: AssessmentStatistics['classes']) {
  const byTask = new Map(solutions.map((solution) => [`${solution.recipientId}:${solution.taskId}`, solution]));
  const students = recipients.map((row) => statisticsStudent(snapshot, row, byTask));
  return { students, ...statisticsScope(snapshot, students), classResults: classes.map((group) => ({ assignmentId: group.id, ...statisticsScope(snapshot, students.filter((student) => student.assignmentId === group.id)) })) };
}
