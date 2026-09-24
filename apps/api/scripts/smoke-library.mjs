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

const pdfObjects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>',
  '<< /Length 0 >>\nstream\n\nendstream',
];
let pdfSource = '%PDF-1.4\n';
const offsets = [0];
for (const [index, object] of pdfObjects.entries()) {
  offsets.push(Buffer.byteLength(pdfSource));
  pdfSource += `${index + 1} 0 obj\n${object}\nendobj\n`;
}
const xrefOffset = Buffer.byteLength(pdfSource);
pdfSource += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
for (const offset of offsets.slice(1)) {
  pdfSource += `${String(offset).padStart(10, '0')} 00000 n \n`;
}
pdfSource += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
const pdf = Buffer.from(pdfSource);
const uploadPdf = async (type, filename) => {
  const query = new URLSearchParams({
    type,
    filename,
    sizeBytes: String(pdf.length),
  });
  const upload = await fetch(`${apiUrl}/teacher/library/lessons/${lesson.id}/artifacts/upload?${query}`, {
    method: 'PUT',
    headers: { cookie: teacherCookie, origin, 'content-type': 'application/pdf' },
    body: pdf,
  });
  const text = await upload.text();
  if (!upload.ok) {
    throw new Error(`${type} upload failed: ${upload.status} ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
};

const handout = await uploadPdf('pdf', 'smoke-handout.pdf');
const tasks = await uploadPdf('tasks_pdf', 'smoke-tasks.pdf');
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
assert.deepEqual(new Set(detail.artifacts.map((artifact) => artifact.id)), new Set([handout.id, tasks.id]));

for (const artifact of detail.artifacts) {
  const view = await request(`/student/library/artifacts/${artifact.id}/view`, {
    cookie: studentCookie,
  });
  const file = await fetch(view.url);
  assert.equal(file.status, 200, `${artifact.type} view failed`);
  assert.equal(Buffer.compare(Buffer.from(await file.arrayBuffer()), pdf), 0);
}

console.log('Library smoke passed: catalog, both PDF uploads, publish, grant and student views.');
