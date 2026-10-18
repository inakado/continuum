# generated/api-routes

Статус: сгенерированный каталог HTTP routes из Nest controllers. Не редактировать вручную.

## Source of truth

- `apps/api/src/**/*controller.ts`
- Regenerate: `pnpm docs:generate`
- Drift check: `pnpm docs:check:generated`

## Routes

| Method | Path | Handler | Source |
| --- | --- | --- | --- |
| `GET` | `/assessment-solutions/:id` | `list` | `apps/api/src/assessment-assignments/solutions.controller.ts:17` |
| `DELETE` | `/assessment-solutions/:id/items/:taskId/photos/:photoId` | `remove` | `apps/api/src/assessment-assignments/solutions.controller.ts:39` |
| `GET` | `/assessment-solutions/:id/items/:taskId/photos/:photoId` | `photo` | `apps/api/src/assessment-assignments/solutions.controller.ts:25` |
| `PUT` | `/assessment-solutions/:id/items/:taskId/photos/:photoId` | `upload` | `apps/api/src/assessment-assignments/solutions.controller.ts:31` |
| `GET` | `/assessment-solutions/:id/items/:taskId/review` | `review` | `apps/api/src/assessment-assignments/solutions.controller.ts:20` |
| `GET` | `/health` | `health` | `apps/api/src/health.controller.ts:8` |
| `GET` | `/me` | `getMe` | `apps/api/src/auth/auth-me.controller.ts:6` |
| `GET` | `/ready` | `ready` | `apps/api/src/ready.controller.ts:11` |
| `GET` | `/student/assessment-works` | `list` | `apps/api/src/assessment-assignments/student-attempts.controller.ts:17` |
| `GET` | `/student/assessment-works/:id` | `detail` | `apps/api/src/assessment-assignments/student-attempts.controller.ts:20` |
| `PATCH` | `/student/assessment-works/:id/answers/:taskId` | `save` | `apps/api/src/assessment-assignments/student-attempts.controller.ts:27` |
| `POST` | `/student/assessment-works/:id/finish` | `finish` | `apps/api/src/assessment-assignments/student-attempts.controller.ts:30` |
| `GET` | `/student/assessment-works/:id/items/:taskId/images/:name` | `image` | `apps/api/src/assessment-assignments/student-attempts.controller.ts:34` |
| `POST` | `/student/assessment-works/:id/start` | `start` | `apps/api/src/assessment-assignments/student-attempts.controller.ts:23` |
| `GET` | `/student/library` | `getLibrary` | `apps/api/src/library/student-library.controller.ts:16` |
| `GET` | `/student/library/artifacts/:id/view` | `getArtifactView` | `apps/api/src/library/student-library.controller.ts:29` |
| `GET` | `/student/library/lessons/:id` | `getLesson` | `apps/api/src/library/student-library.controller.ts:21` |
| `GET` | `/teacher/assessment-assignments` | `list` | `apps/api/src/assessment-assignments/teacher-assignments.controller.ts:19` |
| `GET` | `/teacher/assessment-assignments/:id` | `report` | `apps/api/src/assessment-assignments/teacher-assignments.controller.ts:30` |
| `POST` | `/teacher/assessment-assignments/works/:id` | `assign` | `apps/api/src/assessment-assignments/teacher-assignments.controller.ts:25` |
| `GET` | `/teacher/assessment-assignments/works/:id/prepare` | `prepare` | `apps/api/src/assessment-assignments/teacher-assignments.controller.ts:22` |
| `GET` | `/teacher/assessment-bank` | `list` | `apps/api/src/assessment-bank/teacher-assessment-bank.controller.ts:22` |
| `GET` | `/teacher/assessment-bank/export` | `export` | `apps/api/src/assessment-bank/teacher-assessment-bank.controller.ts:64` |
| `DELETE` | `/teacher/assessment-bank/imports/:id` | `discard` | `apps/api/src/assessment-bank/teacher-assessment-bank.controller.ts:60` |
| `POST` | `/teacher/assessment-bank/imports/:id/confirm` | `confirm` | `apps/api/src/assessment-bank/teacher-assessment-bank.controller.ts:56` |
| `GET` | `/teacher/assessment-bank/imports/:id/tasks/:stableId` | `previewTask` | `apps/api/src/assessment-bank/teacher-assessment-bank.controller.ts:45` |
| `GET` | `/teacher/assessment-bank/imports/:id/tasks/:stableId/images/:name` | `previewImage` | `apps/api/src/assessment-bank/teacher-assessment-bank.controller.ts:49` |
| `POST` | `/teacher/assessment-bank/imports/preview` | `preview` | `apps/api/src/assessment-bank/teacher-assessment-bank.controller.ts:37` |
| `GET` | `/teacher/assessment-bank/tasks/:id` | `view` | `apps/api/src/assessment-bank/teacher-assessment-bank.controller.ts:26` |
| `GET` | `/teacher/assessment-bank/tasks/:id/images/:name` | `image` | `apps/api/src/assessment-bank/teacher-assessment-bank.controller.ts:30` |
| `GET` | `/teacher/assessment-works` | `list` | `apps/api/src/assessment-works/teacher-assessment-works.controller.ts:17` |
| `POST` | `/teacher/assessment-works` | `create` | `apps/api/src/assessment-works/teacher-assessment-works.controller.ts:20` |
| `GET` | `/teacher/assessment-works/:id` | `detail` | `apps/api/src/assessment-works/teacher-assessment-works.controller.ts:23` |
| `PATCH` | `/teacher/assessment-works/:id` | `update` | `apps/api/src/assessment-works/teacher-assessment-works.controller.ts:26` |
| `POST` | `/teacher/assessment-works/:id/versions` | `freeze` | `apps/api/src/assessment-works/teacher-assessment-works.controller.ts:29` |
| `GET` | `/teacher/assessment-works/:id/versions/:number` | `version` | `apps/api/src/assessment-works/teacher-assessment-works.controller.ts:32` |
| `GET` | `/teacher/classes` | `getClasses` | `apps/api/src/identity-access/teacher-classes.controller.ts:23` |
| `POST` | `/teacher/classes` | `createClass` | `apps/api/src/identity-access/teacher-classes.controller.ts:26` |
| `DELETE` | `/teacher/classes/:id` | `deleteClass` | `apps/api/src/identity-access/teacher-classes.controller.ts:41` |
| `PATCH` | `/teacher/classes/:id` | `updateClass` | `apps/api/src/identity-access/teacher-classes.controller.ts:30` |
| `POST` | `/teacher/classes/students` | `createStudents` | `apps/api/src/identity-access/teacher-classes.controller.ts:35` |
| `GET` | `/teacher/library` | `getLibrary` | `apps/api/src/library/teacher-library.controller.ts:52` |
| `PUT` | `/teacher/library/access-grants` | `setAccessGrant` | `apps/api/src/library/teacher-library.controller.ts:137` |
| `GET` | `/teacher/library/artifacts/:id/view` | `getArtifactView` | `apps/api/src/library/teacher-library.controller.ts:121` |
| `POST` | `/teacher/library/lessons` | `createLesson` | `apps/api/src/library/teacher-library.controller.ts:90` |
| `DELETE` | `/teacher/library/lessons/:id` | `deleteLesson` | `apps/api/src/library/teacher-library.controller.ts:43` |
| `GET` | `/teacher/library/lessons/:id` | `getLesson` | `apps/api/src/library/teacher-library.controller.ts:57` |
| `PATCH` | `/teacher/library/lessons/:id` | `updateLesson` | `apps/api/src/library/teacher-library.controller.ts:98` |
| `DELETE` | `/teacher/library/lessons/:id/artifacts/:type` | `deletePdf` | `apps/api/src/library/teacher-library.controller.ts:47` |
| `PUT` | `/teacher/library/lessons/:id/artifacts/upload` | `uploadArtifact` | `apps/api/src/library/teacher-library.controller.ts:107` |
| `PATCH` | `/teacher/library/lessons/:id/publish` | `publishLesson` | `apps/api/src/library/teacher-library.controller.ts:129` |
| `POST` | `/teacher/library/sections` | `createSection` | `apps/api/src/library/teacher-library.controller.ts:65` |
| `DELETE` | `/teacher/library/sections/:id` | `deleteSection` | `apps/api/src/library/teacher-library.controller.ts:39` |
| `PATCH` | `/teacher/library/sections/:id` | `updateSection` | `apps/api/src/library/teacher-library.controller.ts:73` |
| `PATCH` | `/teacher/library/sections/:id/publish` | `publishSection` | `apps/api/src/library/teacher-library.controller.ts:82` |
| `GET` | `/teacher/students` | `getStudents` | `apps/api/src/identity-access/teacher-students.controller.ts:31` |
| `POST` | `/teacher/students` | `createStudent` | `apps/api/src/identity-access/teacher-students.controller.ts:36` |
| `DELETE` | `/teacher/students/:id` | `deleteStudent` | `apps/api/src/identity-access/teacher-students.controller.ts:66` |
| `PATCH` | `/teacher/students/:id/active` | `setStudentActive` | `apps/api/src/identity-access/teacher-students.controller.ts:44` |
| `PATCH` | `/teacher/students/:id/class` | `setClass` | `apps/api/src/identity-access/teacher-students.controller.ts:53` |
| `POST` | `/teacher/students/:id/password-reset` | `resetPassword` | `apps/api/src/identity-access/teacher-students.controller.ts:59` |
