# generated/api-routes

Статус: сгенерированный каталог HTTP routes из Nest controllers. Не редактировать вручную.

## Source of truth

- `apps/api/src/**/*controller.ts`
- Regenerate: `pnpm docs:generate`
- Drift check: `pnpm docs:check:generated`

## Routes

| Method | Path | Handler | Source |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | `login` | `apps/api/src/auth/auth.controller.ts:151` |
| `POST` | `/auth/logout` | `logout` | `apps/api/src/auth/auth.controller.ts:192` |
| `GET` | `/auth/me` | `me` | `apps/api/src/auth/auth.controller.ts:202` |
| `POST` | `/auth/refresh` | `refresh` | `apps/api/src/auth/auth.controller.ts:158` |
| `GET` | `/courses` | `list` | `apps/api/src/content/student-courses.controller.ts:19` |
| `GET` | `/courses/:id` | `get` | `apps/api/src/content/student-courses.controller.ts:24` |
| `POST` | `/debug/enqueue-ping` | `enqueuePing` | `apps/api/src/debug.controller.ts:10` |
| `GET` | `/debug/student-only` | `studentOnly` | `apps/api/src/debug.controller.ts:33` |
| `GET` | `/debug/teacher-only` | `teacherOnly` | `apps/api/src/debug.controller.ts:26` |
| `GET` | `/health` | `health` | `apps/api/src/health.controller.ts:6` |
| `POST` | `/internal/latex/jobs/:jobId/apply` | `applyCompileJob` | `apps/api/src/content/internal-latex.controller.ts:43` |
| `GET` | `/ready` | `ready` | `apps/api/src/ready.controller.ts:9` |
| `GET` | `/sections/:id` | `get` | `apps/api/src/content/student-sections.controller.ts:15` |
| `GET` | `/sections/:id/graph` | `getGraph` | `apps/api/src/learning/student-section-graph.controller.ts:15` |
| `GET` | `/student/dashboard` | `getOverview` | `apps/api/src/learning/student-dashboard.controller.ts:31` |
| `GET` | `/student/notifications` | `list` | `apps/api/src/learning/student-notifications.controller.ts:15` |
| `POST` | `/student/notifications/:notificationId/read` | `markRead` | `apps/api/src/learning/student-notifications.controller.ts:20` |
| `POST` | `/student/tasks/:taskId/attempts` | `submit` | `apps/api/src/learning/student-attempts.controller.ts:17` |
| `POST` | `/student/tasks/:taskId/photo/board/presign-upload` | `presignBoardUpload` | `apps/api/src/learning/student-photo-tasks.controller.ts:56` |
| `POST` | `/student/tasks/:taskId/photo/board/submit` | `submitBoard` | `apps/api/src/learning/student-photo-tasks.controller.ts:67` |
| `POST` | `/student/tasks/:taskId/photo/presign-upload` | `presignUpload` | `apps/api/src/learning/student-photo-tasks.controller.ts:34` |
| `GET` | `/student/tasks/:taskId/photo/presign-view` | `presignView` | `apps/api/src/learning/student-photo-tasks.controller.ts:83` |
| `GET` | `/student/tasks/:taskId/photo/submissions` | `listSubmissions` | `apps/api/src/learning/student-photo-tasks.controller.ts:78` |
| `POST` | `/student/tasks/:taskId/photo/submit` | `submit` | `apps/api/src/learning/student-photo-tasks.controller.ts:45` |
| `GET` | `/student/tasks/:taskId/solution/rendered-content` | `getTaskSolutionRenderedContent` | `apps/api/src/learning/student-task-solutions.controller.ts:25` |
| `GET` | `/student/tasks/:taskId/statement-image/presign-view` | `presignView` | `apps/api/src/learning/student-task-statement-image.controller.ts:24` |
| `GET` | `/teacher/courses` | `list` | `apps/api/src/content/teacher-courses.controller.ts:57` |
| `POST` | `/teacher/courses` | `create` | `apps/api/src/content/teacher-courses.controller.ts:67` |
| `DELETE` | `/teacher/courses/:courseId/cover-image` | `deleteCoverImage` | `apps/api/src/content/teacher-courses.controller.ts:206` |
| `POST` | `/teacher/courses/:courseId/cover-image/apply` | `applyCoverImage` | `apps/api/src/content/teacher-courses.controller.ts:173` |
| `POST` | `/teacher/courses/:courseId/cover-image/presign-upload` | `presignCoverImageUpload` | `apps/api/src/content/teacher-courses.controller.ts:144` |
| `GET` | `/teacher/courses/:courseId/cover-image/presign-view` | `presignCoverImageView` | `apps/api/src/content/teacher-courses.controller.ts:219` |
| `DELETE` | `/teacher/courses/:id` | `remove` | `apps/api/src/content/teacher-courses.controller.ts:129` |
| `GET` | `/teacher/courses/:id` | `get` | `apps/api/src/content/teacher-courses.controller.ts:62` |
| `PATCH` | `/teacher/courses/:id` | `update` | `apps/api/src/content/teacher-courses.controller.ts:82` |
| `POST` | `/teacher/courses/:id/publish` | `publish` | `apps/api/src/content/teacher-courses.controller.ts:97` |
| `POST` | `/teacher/courses/:id/unpublish` | `unpublish` | `apps/api/src/content/teacher-courses.controller.ts:113` |
| `POST` | `/teacher/debug/latex/compile-and-upload` | `compileAndUpload` | `apps/api/src/debug-latex.controller.ts:36` |
| `GET` | `/teacher/debug/storage/get` | `get` | `apps/api/src/debug-storage.controller.ts:57` |
| `GET` | `/teacher/debug/storage/presign` | `presign` | `apps/api/src/debug-storage.controller.ts:82` |
| `POST` | `/teacher/debug/storage/put` | `put` | `apps/api/src/debug-storage.controller.ts:35` |
| `GET` | `/teacher/events` | `list` | `apps/api/src/events/teacher-events.controller.ts:14` |
| `GET` | `/teacher/latex/jobs/:jobId` | `getCompileJob` | `apps/api/src/content/teacher-latex.controller.ts:169` |
| `POST` | `/teacher/latex/jobs/:jobId/apply` | `applyCompileJob` | `apps/api/src/content/teacher-latex.controller.ts:221` |
| `GET` | `/teacher/me` | `getMe` | `apps/api/src/students/teacher-me.controller.ts:25` |
| `PATCH` | `/teacher/me` | `updateProfile` | `apps/api/src/students/teacher-me.controller.ts:30` |
| `POST` | `/teacher/me/change-password` | `changePassword` | `apps/api/src/students/teacher-me.controller.ts:64` |
| `GET` | `/teacher/notifications` | `list` | `apps/api/src/learning/teacher-notifications.controller.ts:15` |
| `GET` | `/teacher/photo-submissions` | `list` | `apps/api/src/learning/teacher-photo-review-inbox.controller.ts:23` |
| `GET` | `/teacher/photo-submissions/:submissionId` | `detail` | `apps/api/src/learning/teacher-photo-review-inbox.controller.ts:32` |
| `POST` | `/teacher/sections` | `create` | `apps/api/src/content/teacher-sections.controller.ts:67` |
| `DELETE` | `/teacher/sections/:id` | `remove` | `apps/api/src/content/teacher-sections.controller.ts:152` |
| `GET` | `/teacher/sections/:id` | `get` | `apps/api/src/content/teacher-sections.controller.ts:57` |
| `PATCH` | `/teacher/sections/:id` | `update` | `apps/api/src/content/teacher-sections.controller.ts:87` |
| `GET` | `/teacher/sections/:id/graph` | `getGraph` | `apps/api/src/content/teacher-section-graph.controller.ts:25` |
| `PUT` | `/teacher/sections/:id/graph` | `updateGraph` | `apps/api/src/content/teacher-section-graph.controller.ts:30` |
| `GET` | `/teacher/sections/:id/meta` | `getMeta` | `apps/api/src/content/teacher-sections.controller.ts:62` |
| `POST` | `/teacher/sections/:id/publish` | `publish` | `apps/api/src/content/teacher-sections.controller.ts:112` |
| `POST` | `/teacher/sections/:id/unpublish` | `unpublish` | `apps/api/src/content/teacher-sections.controller.ts:132` |
| `DELETE` | `/teacher/sections/:sectionId/cover-image` | `deleteCoverImage` | `apps/api/src/content/teacher-sections.controller.ts:233` |
| `POST` | `/teacher/sections/:sectionId/cover-image/apply` | `applyCoverImage` | `apps/api/src/content/teacher-sections.controller.ts:200` |
| `POST` | `/teacher/sections/:sectionId/cover-image/presign-upload` | `presignCoverImageUpload` | `apps/api/src/content/teacher-sections.controller.ts:171` |
| `GET` | `/teacher/sections/:sectionId/cover-image/presign-view` | `presignCoverImageView` | `apps/api/src/content/teacher-sections.controller.ts:246` |
| `GET` | `/teacher/students` | `list` | `apps/api/src/students/teacher-students.controller.ts:39` |
| `POST` | `/teacher/students` | `create` | `apps/api/src/students/teacher-students.controller.ts:53` |
| `DELETE` | `/teacher/students/:id` | `remove` | `apps/api/src/students/teacher-students.controller.ts:172` |
| `GET` | `/teacher/students/:id` | `detail` | `apps/api/src/students/teacher-students.controller.ts:44` |
| `PATCH` | `/teacher/students/:id` | `updateProfile` | `apps/api/src/students/teacher-students.controller.ts:143` |
| `POST` | `/teacher/students/:id/reset-password` | `reset` | `apps/api/src/students/teacher-students.controller.ts:96` |
| `PATCH` | `/teacher/students/:id/transfer` | `transfer` | `apps/api/src/students/teacher-students.controller.ts:114` |
| `GET` | `/teacher/students/:studentId/photo-submissions` | `listQueue` | `apps/api/src/learning/teacher-photo-submissions.controller.ts:33` |
| `POST` | `/teacher/students/:studentId/sections/:sectionId/override-open` | `overrideOpen` | `apps/api/src/learning/teacher-section-override-open.controller.ts:16` |
| `POST` | `/teacher/students/:studentId/tasks/:taskId/credit` | `credit` | `apps/api/src/learning/teacher-task-credit.controller.ts:16` |
| `GET` | `/teacher/students/:studentId/tasks/:taskId/photo-submissions` | `list` | `apps/api/src/learning/teacher-photo-submissions.controller.ts:43` |
| `POST` | `/teacher/students/:studentId/tasks/:taskId/photo-submissions/:submissionId/accept` | `accept` | `apps/api/src/learning/teacher-photo-submissions.controller.ts:87` |
| `POST` | `/teacher/students/:studentId/tasks/:taskId/photo-submissions/:submissionId/feedback-board/presign-upload` | `presignFeedbackBoardUpload` | `apps/api/src/learning/teacher-photo-submissions.controller.ts:63` |
| `POST` | `/teacher/students/:studentId/tasks/:taskId/photo-submissions/:submissionId/reject` | `reject` | `apps/api/src/learning/teacher-photo-submissions.controller.ts:99` |
| `GET` | `/teacher/students/:studentId/tasks/:taskId/photo-submissions/presign-view` | `presignView` | `apps/api/src/learning/teacher-photo-submissions.controller.ts:52` |
| `POST` | `/teacher/students/:studentId/tasks/:taskId/unblock` | `unblock` | `apps/api/src/learning/teacher-task-unblock.controller.ts:16` |
| `GET` | `/teacher/students/:studentId/units/:unitId` | `get` | `apps/api/src/learning/teacher-student-unit-preview.controller.ts:15` |
| `POST` | `/teacher/students/:studentId/units/:unitId/override-open` | `overrideOpen` | `apps/api/src/learning/teacher-unit-override-open.controller.ts:16` |
| `POST` | `/teacher/tasks` | `create` | `apps/api/src/content/teacher-tasks.controller.ts:65` |
| `DELETE` | `/teacher/tasks/:id` | `remove` | `apps/api/src/content/teacher-tasks.controller.ts:179` |
| `GET` | `/teacher/tasks/:id` | `get` | `apps/api/src/content/teacher-tasks.controller.ts:60` |
| `PATCH` | `/teacher/tasks/:id` | `update` | `apps/api/src/content/teacher-tasks.controller.ts:86` |
| `POST` | `/teacher/tasks/:id/publish` | `publish` | `apps/api/src/content/teacher-tasks.controller.ts:145` |
| `POST` | `/teacher/tasks/:id/unpublish` | `unpublish` | `apps/api/src/content/teacher-tasks.controller.ts:162` |
| `POST` | `/teacher/tasks/:taskId/solution/latex/compile` | `enqueueTaskSolutionCompile` | `apps/api/src/content/teacher-latex.controller.ts:104` |
| `GET` | `/teacher/tasks/:taskId/solution/rendered-content` | `getTaskSolutionRenderedContent` | `apps/api/src/content/teacher-latex.controller.ts:134` |
| `DELETE` | `/teacher/tasks/:taskId/statement-image` | `deleteStatementImage` | `apps/api/src/content/teacher-tasks.controller.ts:265` |
| `POST` | `/teacher/tasks/:taskId/statement-image/apply` | `applyStatementImage` | `apps/api/src/content/teacher-tasks.controller.ts:224` |
| `POST` | `/teacher/tasks/:taskId/statement-image/presign-upload` | `presignStatementImageUpload` | `apps/api/src/content/teacher-tasks.controller.ts:194` |
| `GET` | `/teacher/tasks/:taskId/statement-image/presign-view` | `presignStatementImageView` | `apps/api/src/content/teacher-tasks.controller.ts:279` |
| `GET` | `/teacher/teachers` | `list` | `apps/api/src/students/teacher-teachers.controller.ts:22` |
| `POST` | `/teacher/teachers` | `create` | `apps/api/src/students/teacher-teachers.controller.ts:27` |
| `DELETE` | `/teacher/teachers/:id` | `delete` | `apps/api/src/students/teacher-teachers.controller.ts:56` |
| `POST` | `/teacher/units` | `create` | `apps/api/src/content/teacher-units.controller.ts:110` |
| `DELETE` | `/teacher/units/:id` | `remove` | `apps/api/src/content/teacher-units.controller.ts:212` |
| `GET` | `/teacher/units/:id` | `get` | `apps/api/src/content/teacher-units.controller.ts:45` |
| `PATCH` | `/teacher/units/:id` | `update` | `apps/api/src/content/teacher-units.controller.ts:130` |
| `POST` | `/teacher/units/:id/latex/compile` | `enqueueCompile` | `apps/api/src/content/teacher-latex.controller.ts:75` |
| `GET` | `/teacher/units/:id/pdf-presign` | `getPdfPresignedUrl` | `apps/api/src/content/teacher-units.controller.ts:50` |
| `POST` | `/teacher/units/:id/publish` | `publish` | `apps/api/src/content/teacher-units.controller.ts:178` |
| `GET` | `/teacher/units/:id/rendered-content` | `getRenderedContent` | `apps/api/src/content/teacher-units.controller.ts:79` |
| `POST` | `/teacher/units/:id/unpublish` | `unpublish` | `apps/api/src/content/teacher-units.controller.ts:195` |
| `GET` | `/units/:id` | `get` | `apps/api/src/content/student-units.controller.ts:14` |
| `GET` | `/units/:id` | `get` | `apps/api/src/learning/student-units.controller.ts:25` |
| `GET` | `/units/:id/pdf-presign` | `getPdfPresignedUrl` | `apps/api/src/learning/student-units.controller.ts:30` |
| `GET` | `/units/:id/rendered-content` | `getRenderedContent` | `apps/api/src/learning/student-units.controller.ts:60` |

## Route collisions

Эти пары требуют ручной проверки: Nest обработает только один из конкурирующих handlers для одинакового HTTP method + path.

- `GET /units/:id`: `apps/api/src/content/student-units.controller.ts:14#get`, `apps/api/src/learning/student-units.controller.ts:25#get`
