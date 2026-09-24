# generated/api-routes

Статус: сгенерированный каталог HTTP routes из Nest controllers. Не редактировать вручную.

## Source of truth

- `apps/api/src/**/*controller.ts`
- Regenerate: `pnpm docs:generate`
- Drift check: `pnpm docs:check:generated`

## Routes

| Method | Path | Handler | Source |
| --- | --- | --- | --- |
| `GET` | `/health` | `health` | `apps/api/src/health.controller.ts:8` |
| `GET` | `/me` | `getMe` | `apps/api/src/auth/auth-me.controller.ts:6` |
| `GET` | `/ready` | `ready` | `apps/api/src/ready.controller.ts:11` |
| `GET` | `/student/library` | `getLibrary` | `apps/api/src/library/student-library.controller.ts:16` |
| `GET` | `/student/library/artifacts/:id/view` | `getArtifactView` | `apps/api/src/library/student-library.controller.ts:29` |
| `GET` | `/student/library/lessons/:id` | `getLesson` | `apps/api/src/library/student-library.controller.ts:21` |
| `GET` | `/teacher/library` | `getLibrary` | `apps/api/src/library/teacher-library.controller.ts:35` |
| `PUT` | `/teacher/library/access-grants` | `setAccessGrant` | `apps/api/src/library/teacher-library.controller.ts:120` |
| `GET` | `/teacher/library/artifacts/:id/view` | `getArtifactView` | `apps/api/src/library/teacher-library.controller.ts:104` |
| `POST` | `/teacher/library/lessons` | `createLesson` | `apps/api/src/library/teacher-library.controller.ts:73` |
| `GET` | `/teacher/library/lessons/:id` | `getLesson` | `apps/api/src/library/teacher-library.controller.ts:40` |
| `PATCH` | `/teacher/library/lessons/:id` | `updateLesson` | `apps/api/src/library/teacher-library.controller.ts:81` |
| `PUT` | `/teacher/library/lessons/:id/artifacts/upload` | `uploadArtifact` | `apps/api/src/library/teacher-library.controller.ts:90` |
| `PATCH` | `/teacher/library/lessons/:id/publish` | `publishLesson` | `apps/api/src/library/teacher-library.controller.ts:112` |
| `POST` | `/teacher/library/sections` | `createSection` | `apps/api/src/library/teacher-library.controller.ts:48` |
| `PATCH` | `/teacher/library/sections/:id` | `updateSection` | `apps/api/src/library/teacher-library.controller.ts:56` |
| `PATCH` | `/teacher/library/sections/:id/publish` | `publishSection` | `apps/api/src/library/teacher-library.controller.ts:65` |
| `GET` | `/teacher/students` | `getStudents` | `apps/api/src/identity-access/teacher-students.controller.ts:27` |
| `POST` | `/teacher/students` | `createStudent` | `apps/api/src/identity-access/teacher-students.controller.ts:32` |
| `PATCH` | `/teacher/students/:id/active` | `setStudentActive` | `apps/api/src/identity-access/teacher-students.controller.ts:40` |
