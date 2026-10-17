import { beforeEach, expect, it } from 'vitest';
import type { StudentWorkDetail } from '@continuum/shared';
import { clearAnswerDrafts, draftMatchesServer, readAnswerDraft, removeAnswerDraft } from './answer-draft';

const work = { id: 'work', versionNumber: 1, revision: 1, status: 'in_progress', answers: {}, items: [{ id: 'task' }] } as StudentWorkDetail;
const answers = { task: { type: 'short_number' as const, value: '7' } };
beforeEach(() => localStorage.clear());
function storedDraft() {
  localStorage.setItem('continuum:answer-draft:student:work:1', JSON.stringify({ owner: 'student', recipient: work.id, version: 1, revision: 1, expires: Date.now() + 86_400_000, answers, base: {} }));
}
it('reads an existing draft only for its owner and removes it on discard or account change', () => {
  expect(readAnswerDraft('student', work)).toBeNull();
  storedDraft();
  expect(readAnswerDraft('student', work)?.answers).toEqual(answers);
  expect(readAnswerDraft('other', work)).toBeNull();
  removeAnswerDraft('student', work);
  expect(readAnswerDraft('student', work)).toBeNull();
  storedDraft();
  clearAnswerDrafts('other');
  expect(readAnswerDraft('student', work)).toBeNull();
});
it('rejects expired, completed, changed-version and conflicting drafts without overwriting the server', () => {
  storedDraft();
  const draft = readAnswerDraft('student', work)!;
  expect(draftMatchesServer(draft, work)).toBe(true);
  expect(draftMatchesServer(draft, { ...work, answers: { task: { type: 'short_number', value: '9' } } })).toBe(false);
  expect(readAnswerDraft('student', { ...work, versionNumber: 2 })).toBeNull();
  expect(readAnswerDraft('student', { ...work, status: 'completed' })).toBeNull();
  storedDraft();
  const name = Object.keys(localStorage)[0];
  localStorage.setItem(name, JSON.stringify({ ...draft, expires: 0 }));
  expect(readAnswerDraft('student', work)).toBeNull();
  expect(localStorage.length).toBe(0);
});
