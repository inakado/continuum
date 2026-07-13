# generated/api-routes

Статус: сгенерированный каталог HTTP routes из Nest controllers. Не редактировать вручную.

## Source of truth

- `apps/api/src/**/*controller.ts`
- Regenerate: `pnpm docs:generate`
- Drift check: `pnpm docs:check:generated`

## Routes

| Method | Path | Handler | Source |
| --- | --- | --- | --- |
| `GET` | `/admin/teachers` | `list` | `apps/api/src/students/teacher-teachers.controller.ts:21` |
| `POST` | `/admin/teachers` | `create` | `apps/api/src/students/teacher-teachers.controller.ts:26` |
| `DELETE` | `/admin/teachers/:id` | `delete` | `apps/api/src/students/teacher-teachers.controller.ts:55` |
| `GET` | `/courses` | `list` | `apps/api/src/content/student-courses.controller.ts:18` |
| `GET` | `/courses/:id` | `get` | `apps/api/src/content/student-courses.controller.ts:23` |
| `POST` | `/debug/enqueue-ping` | `enqueuePing` | `apps/api/src/debug.controller.ts:9` |
| `GET` | `/debug/student-only` | `studentOnly` | `apps/api/src/debug.controller.ts:32` |
| `GET` | `/debug/teacher-only` | `teacherOnly` | `apps/api/src/debug.controller.ts:25` |
| `GET` | `/health` | `health` | `apps/api/src/health.controller.ts:8` |
| `POST` | `/internal/latex/jobs/:jobId/apply` | `applyCompileJob` | `apps/api/src/content/internal-latex.controller.ts:46` |
| `GET` | `/ready` | `ready` | `apps/api/src/ready.controller.ts:11` |
| `GET` | `/sections/:id` | `get` | `apps/api/src/content/student-sections.controller.ts:14` |
| `GET` | `/sections/:id/graph` | `getGraph` | `apps/api/src/learning/student-section-graph.controller.ts:14` |
| `GET` | `/student/dashboard` | `getOverview` | `apps/api/src/learning/student-dashboard.controller.ts:30` |
| `GET` | `/student/me` | `getMe` | `apps/api/src/students/student-me.controller.ts:14` |
| `GET` | `/student/notifications` | `list` | `apps/api/src/learning/student-notifications.controller.ts:14` |
| `POST` | `/student/notifications/:notificationId/read` | `markRead` | `apps/api/src/learning/student-notifications.controller.ts:19` |
| `POST` | `/student/tasks/:taskId/attempts` | `submit` | `apps/api/src/learning/student-attempts.controller.ts:16` |
| `POST` | `/student/tasks/:taskId/photo/board/presign-upload` | `presignBoardUpload` | `apps/api/src/learning/student-photo-tasks.controller.ts:55` |
| `POST` | `/student/tasks/:taskId/photo/board/submit` | `submitBoard` | `apps/api/src/learning/student-photo-tasks.controller.ts:66` |
| `POST` | `/student/tasks/:taskId/photo/presign-upload` | `presignUpload` | `apps/api/src/learning/student-photo-tasks.controller.ts:33` |
| `GET` | `/student/tasks/:taskId/photo/presign-view` | `presignView` | `apps/api/src/learning/student-photo-tasks.controller.ts:82` |
| `GET` | `/student/tasks/:taskId/photo/submissions` | `listSubmissions` | `apps/api/src/learning/student-photo-tasks.controller.ts:77` |
| `POST` | `/student/tasks/:taskId/photo/submit` | `submit` | `apps/api/src/learning/student-photo-tasks.controller.ts:44` |
| `GET` | `/student/tasks/:taskId/solution/rendered-content` | `getTaskSolutionRenderedContent` | `apps/api/src/learning/student-task-solutions.controller.ts:24` |
| `GET` | `/student/tasks/:taskId/statement-image/presign-view` | `presignView` | `apps/api/src/learning/student-task-statement-image.controller.ts:23` |
| `GET` | `/teacher/courses` | `list` | `apps/api/src/content/teacher-courses.controller.ts:56` |
| `POST` | `/teacher/courses` | `create` | `apps/api/src/content/teacher-courses.controller.ts:66` |
| `DELETE` | `/teacher/courses/:courseId/cover-image` | `deleteCoverImage` | `apps/api/src/content/teacher-courses.controller.ts:205` |
| `POST` | `/teacher/courses/:courseId/cover-image/apply` | `applyCoverImage` | `apps/api/src/content/teacher-courses.controller.ts:172` |
| `POST` | `/teacher/courses/:courseId/cover-image/presign-upload` | `presignCoverImageUpload` | `apps/api/src/content/teacher-courses.controller.ts:143` |
| `GET` | `/teacher/courses/:courseId/cover-image/presign-view` | `presignCoverImageView` | `apps/api/src/content/teacher-courses.controller.ts:218` |
| `DELETE` | `/teacher/courses/:id` | `remove` | `apps/api/src/content/teacher-courses.controller.ts:128` |
| `GET` | `/teacher/courses/:id` | `get` | `apps/api/src/content/teacher-courses.controller.ts:61` |
| `PATCH` | `/teacher/courses/:id` | `update` | `apps/api/src/content/teacher-courses.controller.ts:81` |
| `POST` | `/teacher/courses/:id/publish` | `publish` | `apps/api/src/content/teacher-courses.controller.ts:96` |
| `POST` | `/teacher/courses/:id/unpublish` | `unpublish` | `apps/api/src/content/teacher-courses.controller.ts:112` |
| `POST` | `/teacher/debug/latex/compile-and-upload` | `compileAndUpload` | `apps/api/src/debug-latex.controller.ts:35` |
| `GET` | `/teacher/debug/storage/get` | `get` | `apps/api/src/debug-storage.controller.ts:56` |
| `GET` | `/teacher/debug/storage/presign` | `presign` | `apps/api/src/debug-storage.controller.ts:81` |
| `POST` | `/teacher/debug/storage/put` | `put` | `apps/api/src/debug-storage.controller.ts:34` |
| `GET` | `/teacher/events` | `list` | `apps/api/src/events/teacher-events.controller.ts:13` |
| `GET` | `/teacher/latex/jobs/:jobId` | `getCompileJob` | `apps/api/src/content/teacher-latex.controller.ts:168` |
| `POST` | `/teacher/latex/jobs/:jobId/apply` | `applyCompileJob` | `apps/api/src/content/teacher-latex.controller.ts:220` |
| `GET` | `/teacher/me` | `getMe` | `apps/api/src/students/teacher-me.controller.ts:24` |
| `PATCH` | `/teacher/me` | `updateProfile` | `apps/api/src/students/teacher-me.controller.ts:29` |
| `POST` | `/teacher/me/change-password` | `changePassword` | `apps/api/src/students/teacher-me.controller.ts:63` |
| `GET` | `/teacher/notifications` | `list` | `apps/api/src/learning/teacher-notifications.controller.ts:14` |
| `GET` | `/teacher/photo-submissions` | `list` | `apps/api/src/learning/teacher-photo-review-inbox.controller.ts:22` |
| `GET` | `/teacher/photo-submissions/:submissionId` | `detail` | `apps/api/src/learning/teacher-photo-review-inbox.controller.ts:31` |
| `POST` | `/teacher/sections` | `create` | `apps/api/src/content/teacher-sections.controller.ts:66` |
| `DELETE` | `/teacher/sections/:id` | `remove` | `apps/api/src/content/teacher-sections.controller.ts:151` |
| `GET` | `/teacher/sections/:id` | `get` | `apps/api/src/content/teacher-sections.controller.ts:56` |
| `PATCH` | `/teacher/sections/:id` | `update` | `apps/api/src/content/teacher-sections.controller.ts:86` |
| `GET` | `/teacher/sections/:id/graph` | `getGraph` | `apps/api/src/content/teacher-section-graph.controller.ts:24` |
| `PUT` | `/teacher/sections/:id/graph` | `updateGraph` | `apps/api/src/content/teacher-section-graph.controller.ts:29` |
| `GET` | `/teacher/sections/:id/meta` | `getMeta` | `apps/api/src/content/teacher-sections.controller.ts:61` |
| `POST` | `/teacher/sections/:id/publish` | `publish` | `apps/api/src/content/teacher-sections.controller.ts:111` |
| `POST` | `/teacher/sections/:id/unpublish` | `unpublish` | `apps/api/src/content/teacher-sections.controller.ts:131` |
| `DELETE` | `/teacher/sections/:sectionId/cover-image` | `deleteCoverImage` | `apps/api/src/content/teacher-sections.controller.ts:232` |
| `POST` | `/teacher/sections/:sectionId/cover-image/apply` | `applyCoverImage` | `apps/api/src/content/teacher-sections.controller.ts:199` |
| `POST` | `/teacher/sections/:sectionId/cover-image/presign-upload` | `presignCoverImageUpload` | `apps/api/src/content/teacher-sections.controller.ts:170` |
| `GET` | `/teacher/sections/:sectionId/cover-image/presign-view` | `presignCoverImageView` | `apps/api/src/content/teacher-sections.controller.ts:245` |
| `GET` | `/teacher/students` | `list` | `apps/api/src/students/teacher-students.controller.ts:38` |
| `POST` | `/teacher/students` | `create` | `apps/api/src/students/teacher-students.controller.ts:52` |
| `DELETE` | `/teacher/students/:id` | `remove` | `apps/api/src/students/teacher-students.controller.ts:171` |
| `GET` | `/teacher/students/:id` | `detail` | `apps/api/src/students/teacher-students.controller.ts:43` |
| `PATCH` | `/teacher/students/:id` | `updateProfile` | `apps/api/src/students/teacher-students.controller.ts:142` |
| `POST` | `/teacher/students/:id/reset-password` | `reset` | `apps/api/src/students/teacher-students.controller.ts:95` |
| `PATCH` | `/teacher/students/:id/transfer` | `transfer` | `apps/api/src/students/teacher-students.controller.ts:113` |
| `GET` | `/teacher/students/:studentId/photo-submissions` | `listQueue` | `apps/api/src/learning/teacher-photo-submissions.controller.ts:32` |
| `POST` | `/teacher/students/:studentId/sections/:sectionId/override-open` | `overrideOpen` | `apps/api/src/learning/teacher-section-override-open.controller.ts:15` |
| `POST` | `/teacher/students/:studentId/tasks/:taskId/credit` | `credit` | `apps/api/src/learning/teacher-task-credit.controller.ts:15` |
| `GET` | `/teacher/students/:studentId/tasks/:taskId/photo-submissions` | `list` | `apps/api/src/learning/teacher-photo-submissions.controller.ts:42` |
| `POST` | `/teacher/students/:studentId/tasks/:taskId/photo-submissions/:submissionId/accept` | `accept` | `apps/api/src/learning/teacher-photo-submissions.controller.ts:86` |
| `POST` | `/teacher/students/:studentId/tasks/:taskId/photo-submissions/:submissionId/feedback-board/presign-upload` | `presignFeedbackBoardUpload` | `apps/api/src/learning/teacher-photo-submissions.controller.ts:62` |
| `POST` | `/teacher/students/:studentId/tasks/:taskId/photo-submissions/:submissionId/reject` | `reject` | `apps/api/src/learning/teacher-photo-submissions.controller.ts:98` |
| `GET` | `/teacher/students/:studentId/tasks/:taskId/photo-submissions/presign-view` | `presignView` | `apps/api/src/learning/teacher-photo-submissions.controller.ts:51` |
| `POST` | `/teacher/students/:studentId/tasks/:taskId/unblock` | `unblock` | `apps/api/src/learning/teacher-task-unblock.controller.ts:15` |
| `GET` | `/teacher/students/:studentId/units/:unitId` | `get` | `apps/api/src/learning/teacher-student-unit-preview.controller.ts:14` |
| `POST` | `/teacher/students/:studentId/units/:unitId/override-open` | `overrideOpen` | `apps/api/src/learning/teacher-unit-override-open.controller.ts:15` |
| `POST` | `/teacher/tasks` | `create` | `apps/api/src/content/teacher-tasks.controller.ts:64` |
| `DELETE` | `/teacher/tasks/:id` | `remove` | `apps/api/src/content/teacher-tasks.controller.ts:178` |
| `GET` | `/teacher/tasks/:id` | `get` | `apps/api/src/content/teacher-tasks.controller.ts:59` |
| `PATCH` | `/teacher/tasks/:id` | `update` | `apps/api/src/content/teacher-tasks.controller.ts:85` |
| `POST` | `/teacher/tasks/:id/publish` | `publish` | `apps/api/src/content/teacher-tasks.controller.ts:144` |
| `POST` | `/teacher/tasks/:id/unpublish` | `unpublish` | `apps/api/src/content/teacher-tasks.controller.ts:161` |
| `POST` | `/teacher/tasks/:taskId/solution/latex/compile` | `enqueueTaskSolutionCompile` | `apps/api/src/content/teacher-latex.controller.ts:103` |
| `GET` | `/teacher/tasks/:taskId/solution/rendered-content` | `getTaskSolutionRenderedContent` | `apps/api/src/content/teacher-latex.controller.ts:133` |
| `DELETE` | `/teacher/tasks/:taskId/statement-image` | `deleteStatementImage` | `apps/api/src/content/teacher-tasks.controller.ts:264` |
| `POST` | `/teacher/tasks/:taskId/statement-image/apply` | `applyStatementImage` | `apps/api/src/content/teacher-tasks.controller.ts:223` |
| `POST` | `/teacher/tasks/:taskId/statement-image/presign-upload` | `presignStatementImageUpload` | `apps/api/src/content/teacher-tasks.controller.ts:193` |
| `GET` | `/teacher/tasks/:taskId/statement-image/presign-view` | `presignStatementImageView` | `apps/api/src/content/teacher-tasks.controller.ts:278` |
| `GET` | `/teacher/teachers` | `list` | `apps/api/src/students/teacher-directory.controller.ts:16` |
| `POST` | `/teacher/units` | `create` | `apps/api/src/content/teacher-units.controller.ts:109` |
| `DELETE` | `/teacher/units/:id` | `remove` | `apps/api/src/content/teacher-units.controller.ts:211` |
| `GET` | `/teacher/units/:id` | `get` | `apps/api/src/content/teacher-units.controller.ts:44` |
| `PATCH` | `/teacher/units/:id` | `update` | `apps/api/src/content/teacher-units.controller.ts:129` |
| `POST` | `/teacher/units/:id/latex/compile` | `enqueueCompile` | `apps/api/src/content/teacher-latex.controller.ts:74` |
| `GET` | `/teacher/units/:id/pdf-presign` | `getPdfPresignedUrl` | `apps/api/src/content/teacher-units.controller.ts:49` |
| `POST` | `/teacher/units/:id/publish` | `publish` | `apps/api/src/content/teacher-units.controller.ts:177` |
| `GET` | `/teacher/units/:id/rendered-content` | `getRenderedContent` | `apps/api/src/content/teacher-units.controller.ts:78` |
| `POST` | `/teacher/units/:id/unpublish` | `unpublish` | `apps/api/src/content/teacher-units.controller.ts:194` |
| `GET` | `/units/:id` | `get` | `apps/api/src/content/student-units.controller.ts:13` |
| `GET` | `/units/:id` | `get` | `apps/api/src/learning/student-units.controller.ts:24` |
| `GET` | `/units/:id/pdf-presign` | `getPdfPresignedUrl` | `apps/api/src/learning/student-units.controller.ts:29` |
| `GET` | `/units/:id/rendered-content` | `getRenderedContent` | `apps/api/src/learning/student-units.controller.ts:59` |

## Route collisions

Эти пары требуют ручной проверки: Nest обработает только один из конкурирующих handlers для одинакового HTTP method + path.

- `GET /units/:id`: `apps/api/src/content/student-units.controller.ts:13#get`, `apps/api/src/learning/student-units.controller.ts:24#get`
