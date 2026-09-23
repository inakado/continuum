import assert from 'node:assert/strict';

const apiUrl = process.env.API_URL || 'http://localhost:3000';
const origin = process.env.AUTH_SMOKE_ORIGIN || 'http://localhost:3001';
const teacherLogin = process.env.TEACHER_LOGIN || 'teacher1';
const teacherPassword = process.env.TEACHER_PASSWORD || 'Pass123!';
const studentLogin = process.env.STUDENT_LOGIN || 'student1';
const studentPassword = process.env.STUDENT_PASSWORD || 'Pass123!';

const request = async (path, { cookie, method = 'GET', body } = {}) => {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : null),
      ...(body ? { 'content-type': 'application/json' } : null),
      ...(method === 'GET' ? null : { origin }),
    },
    ...(body ? { body: JSON.stringify(body) } : null),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path}: ${response.status}; ${text.slice(0, 300)}`);
  }
  return data;
};

const signIn = async (username, password) => {
  const response = await fetch(`${apiUrl}/auth/sign-in/username`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error(`Sign-in ${username}: ${response.status}`);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';', 1)[0])
    .join('; ');
  if (!cookie) throw new Error(`Sign-in ${username}: session cookie is missing`);
  return cookie;
};

const teacherCookie = await signIn(teacherLogin, teacherPassword);
const studentCookie = await signIn(studentLogin, studentPassword);
const studentIdentity = await request('/me', { cookie: studentCookie });

const beforeGrant = await request('/student/library', { cookie: studentCookie });
assert.deepEqual(beforeGrant.gradeBands, []);

const suffix = new Date().toISOString();
const section = await request('/teacher/library/sections', {
  cookie: teacherCookie,
  method: 'POST',
  body: { gradeBand: 'grade_10_11', title: `Smoke section ${suffix}` },
});
await request(`/teacher/library/sections/${section.id}/publish`, {
  cookie: teacherCookie,
  method: 'PATCH',
});

const lesson = await request('/teacher/library/lessons', {
  cookie: teacherCookie,
  method: 'POST',
  body: { sectionId: section.id, title: `Smoke lesson ${suffix}` },
});
await request(`/teacher/library/lessons/${lesson.id}/publish`, {
  cookie: teacherCookie,
  method: 'PATCH',
});

await request('/teacher/library/access-grants', {
  cookie: teacherCookie,
  method: 'PUT',
  body: {
    studentId: studentIdentity.user.id,
    gradeBand: 'grade_10_11',
    enabled: true,
  },
});

const catalog = await request('/student/library', { cookie: studentCookie });
const visibleLesson = catalog.gradeBands
  .flatMap((gradeBand) => gradeBand.sections)
  .flatMap((catalogSection) => catalogSection.lessons)
  .find((catalogLesson) => catalogLesson.id === lesson.id);
assert.equal(visibleLesson?.title, lesson.title);

const detail = await request(`/student/library/lessons/${lesson.id}`, {
  cookie: studentCookie,
});
assert.equal(detail.id, lesson.id);
assert.equal(detail.section.id, section.id);

console.log('Library smoke passed: create, publish, grant and student read.');
