import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapTeachers, parseTeachers } from './bootstrap-teachers.mjs';

test('teacher input rejects duplicates and weak passwords without exposing them', () => {
  const row = { login: 'teacher', password: 'valid-long-password-123' };
  assert.equal(parseTeachers(JSON.stringify([row]))[0].firstName, 'teacher');
  for (const rows of [[], [row, row], [{ ...row, login: 'bad login' }], [{ ...row, password: 'short' }]]) assert.throws(() => parseTeachers(JSON.stringify(rows)));
});

test('bootstrap never resets existing teachers and refuses unrelated users', async () => {
  const rows = parseTeachers('[{"login":"teacher","password":"valid-long-password-123"}]');
  let creates = 0;
  const identity = { verifyPassword: async () => true, createTeacher: async () => { creates++; } };
  const db = { user: { count: async () => 0, findUnique: async () => ({ id:'one', role:'teacher', teacherProfile:{} }) } };
  await bootstrapTeachers(db, identity, rows);
  assert.equal(creates, 0);
  identity.verifyPassword = async () => false;
  await assert.rejects(() => bootstrapTeachers(db, identity, rows), /does not match/);
  db.user.count = async () => 1;
  await assert.rejects(() => bootstrapTeachers(db, identity, rows), /other users/);
  db.user.count = async () => 0;
  db.user.findUnique = async () => null;
  await bootstrapTeachers(db, identity, rows);
  assert.equal(creates, 1);
});
