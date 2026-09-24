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
| `GET` | `/teacher/library` | `getLibrary` | `apps/api/src/library/teacher-library.controller.ts:37` |
| `PUT` | `/teacher/library/access-grants` | `setAccessGrant` | `apps/api/src/library/teacher-library.controller.ts:128` |
| `GET` | `/teacher/library/artifacts/:id/view` | `getArtifactView` | `apps/api/src/library/teacher-library.controller.ts:112` |
| `POST` | `/teacher/library/lessons` | `createLesson` | `apps/api/src/library/teacher-library.controller.ts:75` |
| `GET` | `/teacher/library/lessons/:id` | `getLesson` | `apps/api/src/library/teacher-library.controller.ts:42` |
| `PATCH` | `/teacher/library/lessons/:id` | `updateLesson` | `apps/api/src/library/teacher-library.controller.ts:83` |
| `POST` | `/teacher/library/lessons/:id/artifacts` | `completeArtifactUpload` | `apps/api/src/library/teacher-library.controller.ts:102` |
| `POST` | `/teacher/library/lessons/:id/artifacts/upload-url` | `prepareArtifactUpload` | `apps/api/src/library/teacher-library.controller.ts:92` |
| `PATCH` | `/teacher/library/lessons/:id/publish` | `publishLesson` | `apps/api/src/library/teacher-library.controller.ts:120` |
| `POST` | `/teacher/library/sections` | `createSection` | `apps/api/src/library/teacher-library.controller.ts:50` |
| `PATCH` | `/teacher/library/sections/:id` | `updateSection` | `apps/api/src/library/teacher-library.controller.ts:58` |
| `PATCH` | `/teacher/library/sections/:id/publish` | `publishSection` | `apps/api/src/library/teacher-library.controller.ts:67` |
| `GET` | `/teacher/students` | `getStudents` | `apps/api/src/identity-access/teacher-students.controller.ts:27` |
| `POST` | `/teacher/students` | `createStudent` | `apps/api/src/identity-access/teacher-students.controller.ts:32` |
| `PATCH` | `/teacher/students/:id/active` | `setStudentActive` | `apps/api/src/identity-access/teacher-students.controller.ts:40` |
