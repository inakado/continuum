import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { IdentityProvisioningService } from '../../src/auth/identity-provisioning.service';
import { createBetterAuth } from '../../src/auth/better-auth.factory';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ObjectStorageService } from '../../src/infra/storage/object-storage.service';
import { resolveObjectStorageConfig } from '../../src/infra/storage/object-storage.config';
import { StoredAssessmentTaskSchema, StoredAssessmentImportSchema } from '../../src/assessment-bank/assessment-bank.mapper';
import { ZipFile } from 'yazl';

const db = new PrismaService();
const identities = new IdentityProvisioningService(db);
const storage = new ObjectStorageService(resolveObjectStorageConfig());
const origin = 'http://localhost:3001';
const root = '/teacher/assessment-assignments';
const studentRoot = '/student/assessment-works';
const teachers: string[] = [], students: { id: string; cookie: string }[] = [], classes: string[] = [];
const runLabel = randomUUID().slice(0, 8);
const classTitle = (title: string) => `${title} · ${runLabel}`;
let cookie = '', other = '';
let refs: { taskId: string; version: number }[] = [];
async function login(username: string) {
  const response = await createBetterAuth(db).api.signInUsername({ body: { username, password: 'Local-assign-123' }, asResponse: true, headers: new Headers({ origin }) });
  return response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
}
async function student(teacherId: string, classId?: string) {
  const username = `assign-s-${randomUUID()}`;
  const result = await identities.createStudent({ login: username, password: 'Local-assign-123', leadTeacherId: teacherId, firstName: 'Иван', lastName: 'Проверка' });
  if (classId) await db.studentProfile.update({ where: { userId: result.user.id }, data: { classId } });
  const record = { id: result.user.id, cookie: await login(username) };
  students.push(record);
  return record;
}
async function api(path: string, method = 'GET', body?: object | Buffer, session = cookie, requestOrigin = origin) {
  const response = await fetch(`http://localhost:3000${path}`, { method, headers: { cookie: session, origin: requestOrigin, ...(body ? { 'Content-Type': Buffer.isBuffer(body) ? 'application/zip' : 'application/json' } : {}) }, body: body ? Buffer.isBuffer(body) ? body : JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
}
async function work() {
  const id = randomUUID();
  await api('/teacher/assessment-works', 'POST', { id, title: 'Назначение', gradeBand: 'grade_10_11' });
  await api(`/teacher/assessment-works/${id}`, 'PATCH', { title: 'Назначение', gradeBand: 'grade_10_11', instructions: 'Выполните задания.', items: refs, expectedRevision: 1, requestId: randomUUID() });
  return id;
}
beforeAll(async () => {
  await db.$connect();
  for (let i = 0; i < 2; i++) {
    const username = `assign-t-${randomUUID()}`;
    const result = await identities.createTeacher({ login: username, password: 'Local-assign-123', firstName: 'Тест', lastName: 'Назначения', middleName: null });
    teachers.push(result.user.id);
    if (i) other = await login(username); else cookie = await login(username);
  }
  for (const title of ['11А', '11Б']) classes.push((await db.schoolClass.create({ data: { teacherId: teachers[0], title: classTitle(title), grade: 11, academicYear: 2026 } })).id);
  await student(teachers[0], classes[0]); await student(teachers[0], classes[1]); await student(teachers[1]);
  const bytes = await readFile(resolve(__dirname, '../../../../output/assessment-package-pilot-v1.zip'));
  const preview = await api('/teacher/assessment-bank/imports/preview', 'POST', bytes);
  const imported = await api(`/teacher/assessment-bank/imports/${preview.data.id}/confirm`, 'POST');
  refs = imported.data.taskIds.map((taskId: string) => ({ taskId, version: 1 }));
}, 30000);
afterAll(async () => {
  const scope = { version: { work: { teacherId: { in: teachers } } } };
  await db.assessmentRecipient.deleteMany({ where: scope });
  await db.assessmentAssignment.deleteMany({ where: scope });
  await db.assessmentAssignmentRequest.deleteMany({ where: { work: { teacherId: { in: teachers } } } });
  await db.assessmentWorkVersion.deleteMany({ where: { work: { teacherId: { in: teachers } } } });
  await db.assessmentWork.deleteMany({ where: { teacherId: { in: teachers } } });
  const imports = await db.assessmentBankImport.findMany({ where: { teacherId: { in: teachers } } });
  const versions = await db.assessmentTaskVersion.findMany({ where: { task: { teacherId: { in: teachers } } } });
  const keys = new Set([...imports.flatMap((row) => StoredAssessmentImportSchema.parse(row.data)), ...versions.map((row) => StoredAssessmentTaskSchema.parse(row.data))].flatMap((entry) => entry.images.map((image) => image.key)));
  await Promise.all([...keys].map((key) => storage.deleteObject(key)));
  await db.assessmentBankImport.deleteMany({ where: { teacherId: { in: teachers } } });
  await db.assessmentBankTask.deleteMany({ where: { teacherId: { in: teachers } } });
  await db.studentProfile.deleteMany({ where: { leadTeacherId: { in: teachers } } });
  await db.schoolClass.deleteMany({ where: { teacherId: { in: teachers } } });
  await db.user.deleteMany({ where: { id: { in: [...teachers, ...students.map((item) => item.id)] } } });
  await db.$disconnect();
}, 30000);

it('pins explicit EGE scoring, preserves legacy results and matches preview to the student score', async () => {
  const matching = await db.assessmentBankTask.findFirstOrThrow({ where: { teacherId: teachers[0], stableId: 'shkolkovo-14139' } });
  const oldId = randomUUID(), worksRoot = '/teacher/assessment-works';
  const create = async (workId: string, items: { taskId: string; version: number }[]) => {
    await api(worksRoot, 'POST', { id: workId, title: 'Правила проверки', gradeBand: 'grade_10_11' });
    return (await api(`${worksRoot}/${workId}`, 'PATCH', { title: 'Правила проверки', instructions: '', gradeBand: 'grade_10_11', items, expectedRevision: 1, requestId: randomUUID() })).data;
  };
  const assign = async (workId: string, classIds: string[]) => {
    const prepared = (await api(`${root}/works/${workId}/prepare`)).data;
    return (await api(`${root}/works/${workId}`, 'POST', { requestId: randomUUID(), selection: prepared.selection, classes: prepared.classes.filter((group: { id: string }) => classIds.includes(group.id)).map((group: { id: string; rosterHash: string }) => ({ id: group.id, rosterHash: group.rosterHash })) })).data;
  };
  const solve = async (versionId: string, learner: typeof students[number], answers: { taskId: string; answer: object }[]) => {
    const row = await db.assessmentRecipient.findFirstOrThrow({ where: { versionId, studentId: learner.id } });
    const path = `${studentRoot}/${row.id}`;
    await api(`${path}/start`, 'POST', undefined, learner.cookie);
    let revision = 1;
    for (const item of answers) {
      const saved = await api(`${path}/answers/${item.taskId}`, 'PATCH', { requestId: randomUUID(), expectedRevision: revision, answer: item.answer }, learner.cookie);
      expect(saved.status).toBe(200); revision = saved.data.revision;
    }
    const finished = await api(`${path}/finish`, 'POST', { expectedRevision: revision }, learner.cookie);
    expect(finished.status).toBe(200);
    return { path, state: finished.data, row: await db.assessmentRecipient.findUniqueOrThrow({ where: { id: row.id } }) };
  };
  await create(oldId, [{ taskId: matching.id, version: 1 }]);
  const oldAssigned = await assign(oldId, classes);
  const partialMatch = { taskId: matching.id, answer: { type: 'matching', matches: { radius: '2', force: '1' } } };
  const old = await solve(oldAssigned.versionId, students[0], [partialMatch]);
  expect(old.state.result).toEqual({ correctCount: 0, incorrectCount: 1, partialCount: 0, points: 0, maxPoints: 2 });
  const snapshot = await db.assessmentWorkVersion.findUniqueOrThrow({ where: { id: oldAssigned.versionId } });
  const zip = new ZipFile();
  for (const file of ['manifest.json', ...['shkolkovo-14139', 'shkolkovo-17846'].flatMap((id) => [`tasks/${id}/task.json`, `tasks/${id}/statement.md`])]) zip.addBuffer(await readFile(resolve(__dirname, '../../../../examples/assessment-package/ege-v1', file)), file);
  const bytes = (async () => { const chunks: Buffer[] = []; for await (const chunk of zip.outputStream) chunks.push(Buffer.from(chunk)); return Buffer.concat(chunks); })();
  zip.end();
  const preview = await api('/teacher/assessment-bank/imports/preview', 'POST', await bytes);
  expect(preview.data.issues).toEqual([]);
  const imported = await api(`/teacher/assessment-bank/imports/${preview.data.id}/confirm`, 'POST');
  expect(imported.status).toBe(201);
  expect(await db.assessmentWorkVersion.findUniqueOrThrow({ where: { id: snapshot.id } })).toEqual(snapshot);
  expect(await db.assessmentRecipient.findUniqueOrThrow({ where: { id: old.row.id } })).toEqual(old.row);
  expect((await api(`${old.path}/finish`, 'POST', { expectedRevision: 1 }, students[0].cookie)).data).toEqual(old.state);
  expect((await solve(oldAssigned.versionId, students[1], [partialMatch])).state.result.points).toBe(0);
  const newId = randomUUID();
  const detail = await create(newId, imported.data.taskIds.map((taskId: string) => ({ taskId, version: 2 })));
  const multiple = detail.items.find((item: { task: { type: string } }) => item.task.type === 'multiple_choice');
  const partialAnswers = [partialMatch, { taskId: multiple.id, answer: { type: 'multiple_choice', optionIds: ['1', '2'] } }];
  for (const item of partialAnswers) expect((await api(`${worksRoot}/${newId}/check-answer`, 'POST', { ...item, source: { kind: 'draft', expectedRevision: 2 } })).data).toEqual({ correct: false, points: 1, maxPoints: 2 });
  expect(await db.assessmentRecipient.count({ where: { version: { workId: newId } } })).toBe(0);
  const assigned = await assign(newId, [classes[0]]);
  const result = await solve(assigned.versionId, students[0], partialAnswers);
  expect(result.state.result).toEqual({ correctCount: 0, incorrectCount: 0, partialCount: 2, points: 2, maxPoints: 4 });
  const reloaded = (await api(result.path, 'GET', undefined, students[0].cookie)).data;
  expect(reloaded.result).toEqual(result.state.result);
  expect(JSON.stringify(reloaded.items)).not.toContain('grading');
  expect((await api(studentRoot, 'GET', undefined, students[0].cookie)).data.find((item: { id: string }) => item.id === result.row.id).result).toEqual(result.state.result);
  expect((await api(`${root}/${assigned.versionId}`)).data.recipients[0].result).toEqual({ ...result.state.result, percentage: 50 });
  const exported = await fetch('http://localhost:3000/teacher/assessment-bank/export', { headers: { cookie, origin } });
  const roundtrip = await api('/teacher/assessment-bank/imports/preview', 'POST', Buffer.from(await exported.arrayBuffer()));
  expect(roundtrip.data.items.every((item: { status: string }) => item.status === 'unchanged')).toBe(true);
});

it('releases all five canonical answer types only to the completed recipient, without private grading or solutions', async () => {
  const options=[{id:'one',content:'Первый'},{id:'two',content:'Второй'},{id:'three',content:'Третий'}];
  const definitions=[
    {id:'feedback-number',type:'short_number',grading:{answer:'-12',absoluteTolerance:0.5}},
    {id:'feedback-text',type:'short_text',grading:{acceptedAnswers:['ускорение','проекция ускорения'],caseSensitive:false}},
    {id:'feedback-single',type:'single_choice',options,grading:{correctOptionId:'two'}},
    {id:'feedback-multiple',type:'multiple_choice',options,maxPoints:2,grading:{policy:'ege_physics_multiple_choice_v1',correctOptionIds:['one','two']}},
    {id:'feedback-matching',type:'matching',rows:[{id:'a',content:'Скорость'},{id:'b',content:'Ускорение'}],options,maxPoints:2,grading:{policy:'ege_physics_matching_v1',matches:{a:'one',b:'two'}}},
    {id:'feedback-extended',type:'extended'},
  ];
  const archive=new ZipFile();
  archive.addBuffer(Buffer.from(JSON.stringify({format:'continuum-assessment-package',version:1,title:'Все типы',tasks:definitions.map(task=>task.id)})),'manifest.json');
  for(const task of definitions){
    archive.addBuffer(Buffer.from(JSON.stringify({title:task.id,gradeBand:'grade_10_11',topicPath:['Механика'],maxPoints:1,source:{provider:'Локальная проверка',kind:'original',exam:'ege',examYear:2026,examTaskNumber:1},...task})),`tasks/${task.id}/task.json`);
    archive.addBuffer(Buffer.from('Условие задачи'),`tasks/${task.id}/statement.md`);
    archive.addBuffer(Buffer.from('PRIVATE_SOLUTION_SENTINEL'),`tasks/${task.id}/solution.md`);
  }
  const bytes=(async()=>{const chunks:Buffer[]=[];for await(const part of archive.outputStream)chunks.push(Buffer.from(part));return Buffer.concat(chunks);})();archive.end();
  const preview=await api('/teacher/assessment-bank/imports/preview','POST',await bytes);expect(preview.data.issues).toEqual([]);
  const imported=await api(`/teacher/assessment-bank/imports/${preview.data.id}/confirm`,'POST');expect(imported.status).toBe(201);
  const workId=randomUUID();await api('/teacher/assessment-works','POST',{id:workId,title:'Все типы',gradeBand:'grade_10_11'});
  await api(`/teacher/assessment-works/${workId}`,'PATCH',{title:'Все типы',gradeBand:'grade_10_11',instructions:'',items:imported.data.taskIds.map((taskId:string)=>({taskId,version:1})),expectedRevision:1,requestId:randomUUID()});
  const prepare=(await api(`${root}/works/${workId}/prepare`)).data;
  const assigned=(await api(`${root}/works/${workId}`,'POST',{requestId:randomUUID(),selection:prepare.selection,classes:prepare.classes.filter((item:{id:string})=>classes.includes(item.id)).map((item:{id:string;rosterHash:string})=>({id:item.id,rosterHash:item.rosterHash}))})).data;
  const recipients=await db.assessmentRecipient.findMany({where:{versionId:assigned.versionId}});
  const own=recipients.find(row=>row.studentId===students[0].id)!;const path=`${studentRoot}/${own.id}`;
  expect((await api(path,'GET',undefined,students[0].cookie)).data).not.toHaveProperty('answerKeys');
  expect((await api(`${path}/start`,'POST',undefined,students[0].cookie)).data).not.toHaveProperty('answerKeys');
  expect((await api(`${path}/finish`,'POST',{expectedRevision:99},students[0].cookie)).status).toBe(409);
  const finished=await api(`${path}/finish`,'POST',{expectedRevision:1},students[0].cookie);expect(finished.status).toBe(200);
  const detail=(await api(path,'GET',undefined,students[0].cookie)).data;
  expect(Object.values(detail.answerKeys)).toEqual(expect.arrayContaining([
    {type:'short_number',value:'-12'},{type:'short_text',value:'ускорение'},{type:'single_choice',optionId:'two'},
    {type:'multiple_choice',optionIds:['one','two']},{type:'matching',matches:{a:'one',b:'two'}},
  ]));
  expect(Object.keys(detail.answerKeys)).toHaveLength(5);expect(finished.data.answerKeys).toEqual(detail.answerKeys);
  expect((await api(`${path}/finish`,'POST',{expectedRevision:1},students[0].cookie)).data.answerKeys).toEqual(detail.answerKeys);
  expect(JSON.stringify(detail)).not.toMatch(/PRIVATE_SOLUTION_SENTINEL|acceptedAnswers|absoluteTolerance|caseSensitive|grading/);
  const peer=recipients.find(row=>row.studentId===students[1].id)!;
  expect((await api(`${studentRoot}/${peer.id}`,'GET',undefined,students[1].cookie)).data).not.toHaveProperty('answerKeys');
  expect((await api(path,'GET',undefined,students[1].cookie)).status).toBe(404);
  for(const row of (await api(studentRoot,'GET',undefined,students[0].cookie)).data)expect(row).not.toHaveProperty('answerKeys');
});

it('concurrent retries assign one immutable version and preserve the original request outcome', async () => {
  const id = await work();
  const prepared = (await api(`${root}/works/${id}/prepare`)).data;
  const selected = prepared.classes.filter((item: { id: string }) => classes.includes(item.id));
  const input = { requestId: randomUUID(), selection: prepared.selection, classes: selected.map((item: { id: string; rosterHash: string }) => ({ id: item.id, rosterHash: item.rosterHash })) };
  const results = await Promise.all(Array.from({ length: 4 }, () => api(`${root}/works/${id}`, 'POST', input)));
  expect(results.map((item) => item.status), JSON.stringify(results)).toEqual([201, 201, 201, 201]);
  results.forEach((item) => expect(item.data).toEqual(results[0].data));
  expect(await db.assessmentWorkVersion.count({ where: { workId: id } })).toBe(1);
  expect(await db.assessmentAssignmentRequest.count({ where: { workId: id } })).toBe(1);
  expect(await db.assessmentRecipient.count({ where: { versionId: results[0].data.versionId } })).toBe(results[0].data.addedCount);
  expect((await api(`${root}/works/${id}`, 'POST', { ...input, classes: [input.classes[0]] })).status).toBe(409);
  expect((await api(`${root}/works/${id}`, 'POST', input)).data).toEqual(results[0].data);
});

it('concurrently assigns separate classes and rejects a request key reused for another work', async () => {
  const id = await work();
  const prepared = (await api(`${root}/works/${id}/prepare`)).data;
  const selected = prepared.classes.filter((item: { id: string }) => classes.includes(item.id));
  const results = await Promise.all(selected.map((item: { id: string; rosterHash: string }) => api(`${root}/works/${id}`, 'POST', {
    requestId: randomUUID(), selection: prepared.selection, classes: [{ id: item.id, rosterHash: item.rosterHash }],
  })));
  expect(results.map((item) => item.status), JSON.stringify(results)).toEqual(selected.map(() => 201));
  expect(new Set(results.map((item) => item.data.versionId)).size).toBe(1);
  expect(await db.assessmentWorkVersion.count({ where: { workId: id } })).toBe(1);

  const ids = [await work(), await work()];
  const requestId = randomUUID();
  const choices = await Promise.all(ids.map((workId) => api(`${root}/works/${workId}/prepare`)));
  const conflicting = await Promise.all(ids.map((workId, index) => api(`${root}/works/${workId}`, 'POST', {
    requestId, selection: choices[index].data.selection, classes: [{ id: selected[0].id, rosterHash: choices[index].data.classes.find((item: { id: string }) => item.id === selected[0].id).rosterHash }],
  })));
  expect(conflicting.map((item) => item.status).sort(), JSON.stringify(conflicting)).toEqual([201, 409]);
  expect(await db.assessmentWorkVersion.count({ where: { workId: { in: ids } } })).toBe(1);
  expect(await db.assessmentAssignmentRequest.count({ where: { id: requestId } })).toBe(1);
});

it('assigns an immutable draft to two rosters once, validates ownership and isolates student content', async () => {
  const id = await work();
  const prepared = await api(`${root}/works/${id}/prepare`);
  expect(prepared.status).toBe(200);
  const selectedClasses = prepared.data.classes.filter((item: { id: string }) => classes.includes(item.id));
  const input = { requestId: randomUUID(), selection: prepared.data.selection, classes: selectedClasses.map((item: { id: string; rosterHash: string }) => ({ id: item.id, rosterHash: item.rosterHash })) };
  expect((await api(`${root}/works/${id}`, 'POST', input, students[0].cookie)).status).toBe(403);
  expect((await api(`${root}/works/${id}`, 'POST', input, other)).status).toBe(404);
  expect((await api(`${root}/works/${id}`, 'POST', input, cookie, 'https://foreign.example')).status).toBe(403);
  const assigned = await api(`${root}/works/${id}`, 'POST', input);
  expect(assigned.status).toBe(201);
  expect(assigned.data.addedCount).toBe(2);
  expect((await api(`${root}/works/${id}`, 'POST', input)).data).toEqual(assigned.data);
  expect((await api(`${root}/${assigned.data.versionId}`, 'GET', undefined, other)).status).toBe(404);
  const report = await api(`${root}/${assigned.data.versionId}`);
  expect(report.data.recipients.map((item: { status: string }) => item.status)).toEqual(['not_started', 'not_started']);
  expect(report.data.recipients.every((item: { result: object | null }) => item.result === null)).toBe(true);
  const own = report.data.recipients.find((item: { login: string }) => item.login === selectedClasses.find((item: { id: string }) => item.id === classes[0]).students[0].login);
  const detail = await api(`${studentRoot}/${own.id}`, 'GET', undefined, students[0].cookie);
  expect(detail.status).toBe(200);
  expect(detail.data).not.toHaveProperty('answerKeys');
  for (const item of detail.data.items) {
    expect(item).not.toHaveProperty('grading'); expect(item).not.toHaveProperty('source'); expect(item).not.toHaveProperty('solution'); expect(item).not.toHaveProperty('task');
  }
  expect((await api(`${studentRoot}/${own.id}`, 'GET', undefined, students[2].cookie)).status).toBe(404);
  const imageItem = detail.data.items.find((item: { images: object }) => Object.keys(item.images).length > 0);
  const imageUrl = Object.values(imageItem.images)[0];
  expect((await fetch(`http://localhost:3000${imageUrl}`, { headers: { cookie: students[0].cookie, origin } })).status).toBe(200);
  expect((await fetch(`http://localhost:3000${imageUrl}`, { headers: { cookie: students[2].cookie, origin } })).status).toBe(404);
});

it('edits shared student names without changing credentials, sessions or assigned snapshots', async () => {
  const id = students[0].id, path = `/teacher/students/${id}/names`;
  const profile = await db.studentProfile.findUniqueOrThrow({ where: { userId: id } });
  const user = await db.user.findUniqueOrThrow({ where: { id } });
  const account = await db.account.findMany({ where: { userId: id } });
  const grants = await db.accessGrant.findMany({ where: { studentId: id } });
  const recipients = await db.assessmentRecipient.findMany({ where: { studentId: id } });
  expect(recipients.length).toBeGreaterThan(0);
  const expected = { firstName: profile.firstName, lastName: profile.lastName, middleName: profile.middleName };
  const input = { firstName: 'Пётр', lastName: 'Исправленный', middleName: 'Иванович', expected };
  expect((await api(path, 'PATCH', input, '')).status).toBe(401);
  expect((await api(path, 'PATCH', input, students[0].cookie)).status).toBe(403);
  expect((await api(path, 'PATCH', input, cookie, 'https://foreign.example')).status).toBe(403);
  expect((await api(path, 'PATCH', { ...input, login: 'change-login' })).status).toBe(400);
  expect((await api(path, 'PATCH', { ...input, firstName: '  ' })).status).toBe(400);
  expect((await api(`/teacher/students/${teachers[0]}/names`, 'PATCH', input)).status).toBe(403);
  expect((await api(`/teacher/students/${randomUUID()}/names`, 'PATCH', input)).status).toBe(403);
  expect((await api(path, 'PATCH', input, other)).status).toBe(200);
  expect((await api(path, 'PATCH', input, other)).status).toBe(200);
  expect((await api(path, 'PATCH', { ...input, firstName: 'Другой' })).status).toBe(409);
  expect(await db.user.findUniqueOrThrow({ where: { id } })).toEqual({ ...user, name: 'Пётр Исправленный', updatedAt: expect.any(Date) });
  expect(await db.studentProfile.findUniqueOrThrow({ where: { userId: id } })).toEqual({ ...profile, firstName: input.firstName, lastName: input.lastName, middleName: input.middleName, updatedAt: expect.any(Date) });
  expect(await db.account.findMany({ where: { userId: id } })).toEqual(account);
  expect(await db.accessGrant.findMany({ where: { studentId: id } })).toEqual(grants);
  expect(await db.assessmentRecipient.findMany({ where: { studentId: id } })).toEqual(recipients);
  expect((await api('/me', 'GET', undefined, students[0].cookie)).status).toBe(200);
  const current = { firstName: input.firstName, lastName: input.lastName, middleName: input.middleName };
  const competing = await Promise.all(['Алексей', 'Борис'].map((firstName) => api(path, 'PATCH', { ...current, firstName, expected: current })));
  expect(competing.map((item) => item.status).sort()).toEqual([200, 409]);
  const after = await db.studentProfile.findUniqueOrThrow({ where: { userId: id } });
  expect((await api(path, 'PATCH', { ...expected, expected: { firstName: after.firstName, lastName: after.lastName, middleName: after.middleName } })).status).toBe(200);
});

it('resumes saved answers, checks revisions and seals results against concurrent saves and repeat finish', async () => {
  const id = await work();
  const prepared = (await api(`${root}/works/${id}/prepare`)).data;
  const assigned = (await api(`${root}/works/${id}`, 'POST', { requestId: randomUUID(), selection: prepared.selection, classes: [{ id: classes[0], rosterHash: prepared.classes.find((item: { id: string }) => item.id === classes[0]).rosterHash }] })).data;
  const recipient = (await api(`${root}/${assigned.versionId}`)).data.recipients[0];
  const path = `${studentRoot}/${recipient.id}`;
  expect((await api(`${path}/start`, 'POST', undefined, students[0].cookie)).data.status).toBe('in_progress');
  const body = { requestId: randomUUID(), expectedRevision: 1, answer: { type: 'short_number', value: '123,5' } };
  const target = refs[0].taskId;
  const saved = await api(`${path}/answers/${target}`, 'PATCH', body, students[0].cookie);
  expect(saved.data).toMatchObject({ revision: 2, answeredCount: 1, result: null });
  expect(saved.data).not.toHaveProperty('answerKeys');
  expect((await api(`${path}/answers/${target}`, 'PATCH', body, students[0].cookie)).data.revision).toBe(2);
  expect((await api(path, 'GET', undefined, students[0].cookie)).data.answers[target]).toEqual(body.answer);
  expect((await api(`${path}/answers/${target}`, 'PATCH', { ...body, requestId: randomUUID() }, students[0].cookie)).status).toBe(409);
  const requests = await Promise.all([
    api(`${path}/finish`, 'POST', { expectedRevision: 2 }, students[0].cookie),
    api(`${path}/answers/${target}`, 'PATCH', { ...body, requestId: randomUUID(), expectedRevision: 2 }, students[0].cookie),
  ]);
  expect(requests.map((item) => item.status).sort()).toEqual([200, 409]);
  const current = (await api(path, 'GET', undefined, students[0].cookie)).data;
  const finished = await api(`${path}/finish`, 'POST', { expectedRevision: current.revision }, students[0].cookie);
  expect(finished.data.status).toBe('completed');
  expect(finished.data.answerKeys).toEqual((await api(path, 'GET', undefined, students[0].cookie)).data.answerKeys);
  expect(finished.data.answerKeys[target]).toMatchObject({ type: 'short_number' });
  expect((await api(path, 'GET', undefined, students[2].cookie)).status).toBe(404);
  expect(finished.data.result).toEqual({ correctCount: 0, incorrectCount: refs.length, partialCount: 0, points: 0, maxPoints: prepared.work.maxPoints });
  expect((await api(`${path}/finish`, 'POST', { expectedRevision: current.revision }, students[0].cookie)).data).toEqual(finished.data);
  expect((await api(`${path}/answers/${target}`, 'PATCH', { ...body, expectedRevision: finished.data.revision, requestId: randomUUID() }, students[0].cookie)).status).toBe(409);
  expect((await api(`${root}/${assigned.versionId}`)).data.recipients[0].result.points).toBe(0);
});

it('rejects a stale draft even when frozen, assigns the chosen old version and does not include newcomers on replay', async () => {
  const id = await work();
  const update = { title: 'Один ответ', gradeBand: 'grade_10_11', instructions: '', items: [refs[0]], expectedRevision: 2, requestId: randomUUID() };
  expect((await api(`/teacher/assessment-works/${id}`, 'PATCH', update)).status).toBe(200);
  const frozen = (await api(`/teacher/assessment-works/${id}/versions`, 'POST', { expectedRevision: 3 })).data;
  const classId = (await db.schoolClass.create({ data: { teacherId: teachers[0], title: classTitle('10В'), grade: 10, academicYear: 2026 } })).id;
  classes.push(classId);
  const learner = await student(teachers[0], classId);
  const inactive = await student(teachers[0], classId);
  await db.user.update({ where: { id: inactive.id }, data: { isActive: false } });
  const stale = (await api(`${root}/works/${id}/prepare`)).data;
  const selected = stale.classes.find((item: { id: string }) => item.id === classId);
  const input = { requestId: randomUUID(), selection: stale.selection, classes: [{ id: classId, rosterHash: selected.rosterHash }] };
  expect((await api(`/teacher/assessment-works/${id}`, 'PATCH', { ...update, title: 'Новая редакция', expectedRevision: 3, requestId: randomUUID() })).status).toBe(200);
  expect((await api(`${root}/works/${id}`, 'POST', input)).status).toBe(409);
  const old = (await api(`${root}/works/${id}/prepare?version=${frozen.number}`)).data;
  const exact = { ...input, requestId: randomUUID(), selection: old.selection };
  const assigned = await api(`${root}/works/${id}`, 'POST', exact);
  expect(assigned.status, JSON.stringify(assigned.data)).toBe(201);
  expect(assigned.data.addedCount).toBe(1);
  await student(teachers[0], classId);
  expect((await api(`${root}/works/${id}`, 'POST', exact)).data).toEqual(assigned.data);
  const reportPath = `${root}/${assigned.data.versionId}`;
  const report = (await api(reportPath)).data;
  expect(report).toMatchObject({ title: 'Один ответ', studentCount: 1, taskCount: 1 });
  const path = `${studentRoot}/${report.recipients[0].id}`;
  await api(`${path}/start`, 'POST', undefined, learner.cookie);
  const invalid = await api(`${path}/answers/${refs[0].taskId}`, 'PATCH', { requestId: randomUUID(), expectedRevision: 1, answer: { type: 'short_text', value: '4.83' } }, learner.cookie);
  expect(invalid.status).toBe(400);
  const saved = await api(`${path}/answers/${refs[0].taskId}`, 'PATCH', { requestId: randomUUID(), expectedRevision: 1, answer: { type: 'short_number', value: '4,83' } }, learner.cookie);
  expect(saved.data).toMatchObject({ revision: 2, answeredCount: 1, status: 'in_progress', result: null });
  expect((await api(reportPath)).data.recipients[0]).toMatchObject({ status: 'in_progress', answeredCount: 1, result: null });
  expect((await api(studentRoot, 'GET', undefined, learner.cookie)).data).toEqual([expect.objectContaining({ title: 'Один ответ', taskCount: 1, result: null })]);
  expect((await api(`${path}/finish`, 'POST', { expectedRevision: 2 }, learner.cookie)).data.result).toEqual({ correctCount: 1, incorrectCount: 0, partialCount: 0, points: 1, maxPoints: 1 });
  expect((await api(reportPath)).data.recipients[0].result).toMatchObject({ points: 1, maxPoints: 1, percentage: 100 });
  expect((await api(root)).data.find((item: { versionId: string }) => item.versionId === assigned.data.versionId)).toMatchObject({ studentCount: 1, completedCount: 1 });
  const removedLearner = await api(`/teacher/students/${learner.id}`, 'DELETE');
  expect(removedLearner.status).toBe(200);
  expect((await api(reportPath)).data.recipients[0]).toMatchObject({ deleted: true, status: 'completed', result: { points: 1, maxPoints: 1, percentage: 100 } });
  expect((await api('/teacher/students/bulk-restore', 'POST', { items: [removedLearner.data] })).status).toBe(201);
  expect((await api(reportPath)).data.recipients[0]).toMatchObject({ deleted: false, status: 'completed', result: { points: 1, maxPoints: 1, percentage: 100 } });
  expect((await api(`/teacher/classes/${classId}`, 'DELETE', { deleteStudents: false })).status).toBe(200);
  expect((await api(reportPath)).data.classes[0]).toMatchObject({ classId: null, title: classTitle('10В') });
});

it('keeps recipients fixed, detects roster changes and preserves history through transfer and account/class deletion', async () => {
  const id = await work();
  const first = (await api(`${root}/works/${id}/prepare`)).data;
  const classA = first.classes.find((item: { id: string }) => item.id === classes[0]);
  const input = { requestId: randomUUID(), selection: first.selection, classes: [{ id: classA.id, rosterHash: classA.rosterHash }] };
  const newcomer = await student(teachers[0], classes[0]);
  expect((await api(`${root}/works/${id}`, 'POST', input)).status).toBe(409);
  const refreshed = (await api(`${root}/works/${id}/prepare`)).data;
  const assignedResponse = await api(`${root}/works/${id}`, 'POST', { ...input, requestId: randomUUID(), classes: [{ id: classA.id, rosterHash: refreshed.classes.find((item: { id: string }) => item.id === classes[0]).rosterHash }] });
  expect(assignedResponse.status, JSON.stringify(assignedResponse.data)).toBe(201);
  const assigned = assignedResponse.data;
  expect(assigned.addedCount).toBe(2);
  const late = await student(teachers[0], classes[0]);
  expect((await api(`${root}/${assigned.versionId}`)).data.studentCount).toBe(2);
  await db.studentProfile.update({ where: { userId: newcomer.id }, data: { classId: classes[1] } });
  const next = (await api(`${root}/works/${id}/prepare?version=${assigned.versionNumber}`)).data;
  const selected = next.classes.find((item: { id: string }) => item.id === classes[0]);
  const added = await api(`${root}/works/${id}`, 'POST', { requestId: randomUUID(), selection: next.selection, classes: [{ id: selected.id, rosterHash: selected.rosterHash }] });
  expect(added.data.addedCount).toBe(1);
  const report = (await api(`${root}/${assigned.versionId}`)).data;
  expect(report.recipients.find((item: { login: string }) => item.login === next.classes.find((item: { id: string }) => item.id === classes[1]).students.find((item: { id: string }) => item.id === newcomer.id).login).assignmentId).toBe(report.classes[0].id);
  expect(report.studentCount).toBe(3);
  expect((await api(`/teacher/students/${late.id}`, 'DELETE')).status).toBe(200);
  expect((await api(`${root}/${assigned.versionId}`)).data.recipients.some((item: { deleted: boolean }) => item.deleted)).toBe(true);
  expect((await api(`/teacher/classes/${classes[0]}`, 'DELETE', { deleteStudents: false })).status).toBe(200);
  expect((await api(`${root}/${assigned.versionId}`)).data.classes[0]).toMatchObject({ classId: null, title: classTitle('11А') });
});

it('keeps archived assignments available to students and forbids deleting any assigned version', async () => {
  const id = await work(), workPath = `/teacher/assessment-works/${id}`;
  const prepared = (await api(`${root}/works/${id}/prepare`)).data;
  const selected = prepared.classes.find((item: { id: string }) => item.id === classes[1]);
  const assigned = await api(`${root}/works/${id}`, 'POST', { requestId: randomUUID(), selection: prepared.selection, classes: [{ id: selected.id, rosterHash: selected.rosterHash }] });
  expect(assigned.status).toBe(201);
  const snapshot = await db.assessmentWorkVersion.findUniqueOrThrow({ where: { id: assigned.data.versionId } });
  const recipient = await db.assessmentRecipient.findFirstOrThrow({ where: { versionId: assigned.data.versionId, studentId: students[1].id } });
  const studentPath = `${studentRoot}/${recipient.id}`;
  expect((await api(`${studentPath}/start`, 'POST', undefined, students[1].cookie)).status).toBe(200);
  const started = (await api(studentPath, 'GET', undefined, students[1].cookie)).data;
  expect((await api(`${workPath}/archive`, 'PATCH', { isArchived: true, expectedLifecycleRevision: 1 })).status).toBe(200);
  expect((await api('/teacher/assessment-works')).data.find((row: { id: string }) => row.id === id)).toMatchObject({ isArchived: true, canDelete: false });
  expect((await api(studentPath, 'GET', undefined, students[1].cookie)).data).toEqual(started);
  const finished = await api(`${studentPath}/finish`, 'POST', { expectedRevision: started.revision }, students[1].cookie);
  expect(finished.data.status).toBe('completed');
  expect((await api(`${root}/${assigned.data.versionId}`)).status).toBe(200);
  expect((await api(workPath, 'DELETE', { expectedRevision: 2, expectedLifecycleRevision: 2 })).status).toBe(409);
  expect(await db.assessmentWorkVersion.findUnique({ where: { id: snapshot.id } })).toEqual(snapshot);
  expect((await api(`${workPath}/archive`, 'PATCH', { isArchived: false, expectedLifecycleRevision: 2 })).status).toBe(200);
  expect((await api(`${workPath}/versions`, 'POST', { expectedRevision: 2 })).data.id).toBe(snapshot.id);
});

it('serializes deletion against a real assignment without removing recipients or creating assignments on tombstones', async () => {
  for (let i = 0; i < 3; i++) {
    const id = await work(), workPath = `/teacher/assessment-works/${id}`;
    const prepared = (await api(`${root}/works/${id}/prepare`)).data;
    const selected = prepared.classes.find((item: { id: string }) => item.id === classes[1]);
    const payload = { requestId: randomUUID(), selection: prepared.selection, classes: [{ id: selected.id, rosterHash: selected.rosterHash }] };
    const remove = () => api(workPath, 'DELETE', { expectedRevision: 2, expectedLifecycleRevision: 1 });
    const assign = () => api(`${root}/works/${id}`, 'POST', payload);
    const pair = await Promise.all(i % 2 ? [assign(), remove()] : [remove(), assign()]);
    const row = await db.assessmentWork.findUniqueOrThrow({ where: { id } });
    if (row.deletedAt) {
      expect(pair.map((result) => result.status).sort()).toEqual([200, 404]);
      expect(await db.assessmentAssignment.count({ where: { version: { workId: id } } })).toBe(0);
      expect(await db.assessmentRecipient.count({ where: { version: { workId: id } } })).toBe(0);
      expect((await assign()).status).toBe(404);
    } else {
      expect(pair.map((result) => result.status).sort()).toEqual([201, 409]);
      expect(await db.assessmentRecipient.count({ where: { version: { workId: id } } })).toBeGreaterThan(0);
      expect((await remove()).status).toBe(409);
    }
  }
});
