# generated/db-schema

Статус: сгенерированный срез текущей Prisma schema. Не редактировать вручную.

## Source of truth

- `apps/api/prisma/schema.prisma`
- Regenerate: `pnpm docs:generate`
- Drift check: `pnpm docs:check:generated`

## Enums

- `Role`: `teacher` | `student`
- `ContentStatus`: `draft` | `published`
- `EventCategory`: `admin` | `learning` | `system`
- `TaskAnswerType`: `numeric` | `single_choice` | `multi_choice` | `photo`
- `StudentTaskStatus`: `not_started` | `in_progress` | `correct` | `pending_review` | `accepted` | `rejected` | `blocked` | `credited_without_progress` | `teacher_credited`
- `StudentUnitStatus`: `locked` | `available` | `in_progress` | `completed`
- `AttemptKind`: `numeric` | `single_choice` | `multi_choice` | `photo`
- `AttemptResult`: `correct` | `incorrect` | `pending_review` | `accepted` | `rejected`
- `PhotoTaskSubmissionStatus`: `submitted` | `accepted` | `rejected`
- `NotificationType`: `photo_reviewed` | `unit_override_opened` | `required_task_skipped` | `task_locked`

## Models

### User

- Таблица: `users`
- Model attributes: `@@index([role])`, `@@map("users")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `role` | `Role` |  |
| `login` | `String` | `@unique` |
| `passwordHash` | `String` | `@map("password_hash")` |
| `isActive` | `Boolean` | `@default(true) @map("is_active")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `domainEventLogs` | `DomainEventLog[]` | `@relation("DomainEventActor")` |
| `teacherProfile` | `TeacherProfile?` |  |
| `studentProfile` | `StudentProfile?` | `@relation("StudentProfileUser")` |
| `leadStudents` | `StudentProfile[]` | `@relation("StudentProfileLeadTeacher")` |
| `studentUnitStates` | `StudentUnitState[]` |  |
| `studentTaskStates` | `StudentTaskState[]` |  |
| `attempts` | `Attempt[]` |  |
| `notifications` | `Notification[]` |  |
| `sectionUnlockOverridesAsStudent` | `SectionUnlockOverride[]` | `@relation("SectionUnlockOverrideStudent")` |
| `sectionUnlockOverridesAsTeacher` | `SectionUnlockOverride[]` | `@relation("SectionUnlockOverrideTeacher")` |
| `unitUnlockOverridesAsStudent` | `UnitUnlockOverride[]` | `@relation("UnitUnlockOverrideStudent")` |
| `unitUnlockOverridesAsTeacher` | `UnitUnlockOverride[]` | `@relation("UnitUnlockOverrideTeacher")` |
| `photoTaskSubmissionsAsStudent` | `PhotoTaskSubmission[]` | `@relation("PhotoTaskSubmissionStudent")` |
| `photoTaskSubmissionsReviewed` | `PhotoTaskSubmission[]` | `@relation("PhotoTaskSubmissionReviewer")` |
| `authSessions` | `AuthSession[]` |  |

### AuthSession

- Таблица: `auth_sessions`
- Model attributes: `@@index([userId])`, `@@index([expiresAt])`, `@@index([revokedAt])`, `@@map("auth_sessions")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `userId` | `String` | `@map("user_id") @db.Uuid` |
| `expiresAt` | `DateTime` | `@map("expires_at")` |
| `revokedAt` | `DateTime?` | `@map("revoked_at")` |
| `revokeReason` | `String?` | `@map("revoke_reason")` |
| `lastUsedAt` | `DateTime?` | `@map("last_used_at")` |
| `userAgent` | `String?` | `@map("user_agent")` |
| `ipCreated` | `String?` | `@map("ip_created")` |
| `ipLastUsed` | `String?` | `@map("ip_last_used")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `user` | `User` | `@relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `refreshTokens` | `AuthRefreshToken[]` |  |

### AuthRefreshToken

- Таблица: `auth_refresh_tokens`
- Model attributes: `@@index([sessionId])`, `@@index([expiresAt])`, `@@index([revokedAt])`, `@@map("auth_refresh_tokens")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `sessionId` | `String` | `@map("session_id") @db.Uuid` |
| `tokenHash` | `String` | `@unique @map("token_hash")` |
| `expiresAt` | `DateTime` | `@map("expires_at")` |
| `usedAt` | `DateTime?` | `@map("used_at")` |
| `revokedAt` | `DateTime?` | `@map("revoked_at")` |
| `replacedByTokenId` | `String?` | `@map("replaced_by_token_id") @db.Uuid` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `session` | `AuthSession` | `@relation(fields: [sessionId], references: [id], onDelete: Cascade)` |
| `replacedByToken` | `AuthRefreshToken?` | `@relation("AuthRefreshTokenReplacement", fields: [replacedByTokenId], references: [id], onDelete: SetNull)` |
| `replacesToken` | `AuthRefreshToken[]` | `@relation("AuthRefreshTokenReplacement")` |

### StudentProfile

- Таблица: `student_profile`
- Model attributes: `@@index([leadTeacherId])`, `@@map("student_profile")`

| Field | Type | Attributes |
| --- | --- | --- |
| `userId` | `String` | `@id @map("user_id") @db.Uuid` |
| `leadTeacherId` | `String` | `@map("lead_teacher_id") @db.Uuid` |
| `displayName` | `String?` | `@map("display_name")` |
| `firstName` | `String?` | `@map("first_name")` |
| `lastName` | `String?` | `@map("last_name")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `user` | `User` | `@relation("StudentProfileUser", fields: [userId], references: [id], onDelete: Cascade)` |
| `leadTeacher` | `User` | `@relation("StudentProfileLeadTeacher", fields: [leadTeacherId], references: [id], onDelete: Restrict)` |

### TeacherProfile

- Таблица: `teacher_profile`
- Model attributes: `@@map("teacher_profile")`

| Field | Type | Attributes |
| --- | --- | --- |
| `userId` | `String` | `@id @map("user_id") @db.Uuid` |
| `firstName` | `String` | `@map("first_name")` |
| `lastName` | `String` | `@map("last_name")` |
| `middleName` | `String?` | `@map("middle_name")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `user` | `User` | `@relation(fields: [userId], references: [id], onDelete: Cascade)` |

### Course

- Таблица: `courses`
- Model attributes: `@@index([status])`, `@@map("courses")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `title` | `String` |  |
| `description` | `String?` |  |
| `coverImageAssetKey` | `String?` | `@map("cover_image_asset_key")` |
| `status` | `ContentStatus` | `@default(draft)` |
| `lockDurationMinutes` | `Int` | `@default(30) @map("lock_duration_minutes")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `sections` | `Section[]` |  |

### Section

- Таблица: `sections`
- Model attributes: `@@index([courseId, status])`, `@@index([courseId, sortOrder])`, `@@map("sections")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `courseId` | `String` | `@map("course_id") @db.Uuid` |
| `title` | `String` |  |
| `description` | `String?` |  |
| `coverImageAssetKey` | `String?` | `@map("cover_image_asset_key")` |
| `status` | `ContentStatus` | `@default(draft)` |
| `sortOrder` | `Int` | `@default(0) @map("sort_order")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `course` | `Course` | `@relation(fields: [courseId], references: [id], onDelete: Restrict)` |
| `units` | `Unit[]` |  |
| `unlockOverrides` | `SectionUnlockOverride[]` |  |
| `graphEdges` | `UnitGraphEdge[]` |  |
| `graphLayouts` | `UnitGraphLayout[]` |  |

### Unit

- Таблица: `units`
- Model attributes: `@@index([sectionId, status])`, `@@index([sectionId, sortOrder])`, `@@map("units")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `sectionId` | `String` | `@map("section_id") @db.Uuid` |
| `title` | `String` |  |
| `description` | `String?` | `@map("description")` |
| `status` | `ContentStatus` | `@default(draft)` |
| `sortOrder` | `Int` | `@default(0) @map("sort_order")` |
| `minOptionalCountedTasksToComplete` | `Int` | `@default(0) @map("min_optional_counted_tasks_to_complete")` |
| `theoryRichLatex` | `String?` | `@map("theory_rich_latex")` |
| `theoryPdfAssetKey` | `String?` | `@map("theory_pdf_asset_key")` |
| `theoryHtmlAssetKey` | `String?` | `@map("theory_html_asset_key")` |
| `theoryHtmlAssetsJson` | `Json?` | `@map("theory_html_assets_json")` |
| `methodRichLatex` | `String?` | `@map("method_rich_latex")` |
| `methodPdfAssetKey` | `String?` | `@map("method_pdf_asset_key")` |
| `methodHtmlAssetKey` | `String?` | `@map("method_html_asset_key")` |
| `methodHtmlAssetsJson` | `Json?` | `@map("method_html_assets_json")` |
| `videosJson` | `Json?` | `@map("videos_json")` |
| `attachmentsJson` | `Json?` | `@map("attachments_json")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `section` | `Section` | `@relation(fields: [sectionId], references: [id], onDelete: Restrict)` |
| `tasks` | `Task[]` |  |
| `studentUnitStates` | `StudentUnitState[]` |  |
| `unlockOverrides` | `UnitUnlockOverride[]` |  |
| `photoTaskSubmissions` | `PhotoTaskSubmission[]` |  |
| `graphPrereqEdges` | `UnitGraphEdge[]` | `@relation("GraphPrereqUnit")` |
| `graphNextEdges` | `UnitGraphEdge[]` | `@relation("GraphUnit")` |
| `graphLayouts` | `UnitGraphLayout[]` | `@relation("GraphLayoutUnit")` |

### UnitGraphEdge

- Таблица: `unit_graph_edges`
- Model attributes: `@@unique([sectionId, prereqUnitId, unitId])`, `@@index([sectionId, unitId])`, `@@index([sectionId, prereqUnitId])`, `@@map("unit_graph_edges")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `sectionId` | `String` | `@map("section_id") @db.Uuid` |
| `prereqUnitId` | `String` | `@map("prereq_unit_id") @db.Uuid` |
| `unitId` | `String` | `@map("unit_id") @db.Uuid` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `section` | `Section` | `@relation(fields: [sectionId], references: [id], onDelete: Restrict)` |
| `prereqUnit` | `Unit` | `@relation("GraphPrereqUnit", fields: [prereqUnitId], references: [id], onDelete: Restrict)` |
| `unit` | `Unit` | `@relation("GraphUnit", fields: [unitId], references: [id], onDelete: Restrict)` |

### UnitGraphLayout

- Таблица: `unit_graph_layout`
- Model attributes: `@@unique([sectionId, unitId])`, `@@index([sectionId])`, `@@map("unit_graph_layout")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `sectionId` | `String` | `@map("section_id") @db.Uuid` |
| `unitId` | `String` | `@map("unit_id") @db.Uuid` |
| `x` | `Float` |  |
| `y` | `Float` |  |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `section` | `Section` | `@relation(fields: [sectionId], references: [id], onDelete: Restrict)` |
| `unit` | `Unit` | `@relation("GraphLayoutUnit", fields: [unitId], references: [id], onDelete: Restrict)` |

### Task

- Таблица: `tasks`
- Model attributes: `@@index([unitId, status])`, `@@index([unitId, sortOrder])`, `@@map("tasks")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `unitId` | `String` | `@map("unit_id") @db.Uuid` |
| `title` | `String?` |  |
| `isRequired` | `Boolean` | `@default(false) @map("is_required")` |
| `status` | `ContentStatus` | `@default(draft)` |
| `sortOrder` | `Int` | `@default(0) @map("sort_order")` |
| `activeRevisionId` | `String?` | `@map("active_revision_id") @db.Uuid` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `unit` | `Unit` | `@relation(fields: [unitId], references: [id], onDelete: Restrict)` |
| `activeRevision` | `TaskRevision?` | `@relation("ActiveTaskRevision", fields: [activeRevisionId], references: [id], onDelete: Restrict)` |
| `revisions` | `TaskRevision[]` | `@relation("TaskRevisions")` |
| `studentTaskStates` | `StudentTaskState[]` |  |
| `attempts` | `Attempt[]` |  |
| `photoTaskSubmissions` | `PhotoTaskSubmission[]` |  |

### TaskRevision

- Таблица: `task_revisions`
- Model attributes: `@@unique([taskId, revisionNo])`, `@@index([taskId, createdAt])`, `@@map("task_revisions")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `taskId` | `String` | `@map("task_id") @db.Uuid` |
| `revisionNo` | `Int` | `@map("revision_no")` |
| `answerType` | `TaskAnswerType` | `@map("answer_type")` |
| `statementLite` | `String` | `@map("statement_lite")` |
| `methodGuidance` | `String?` | `@map("method_guidance")` |
| `statementImageAssetKey` | `String?` | `@map("statement_image_asset_key")` |
| `solutionLite` | `String?` | `@map("solution_lite")` |
| `solutionRichLatex` | `String?` | `@map("solution_rich_latex")` |
| `solutionPdfAssetKey` | `String?` | `@map("solution_pdf_asset_key")` |
| `solutionHtmlAssetKey` | `String?` | `@map("solution_html_asset_key")` |
| `solutionHtmlAssetsJson` | `Json?` | `@map("solution_html_assets_json")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `task` | `Task` | `@relation("TaskRevisions", fields: [taskId], references: [id], onDelete: Cascade)` |
| `activeForTasks` | `Task[]` | `@relation("ActiveTaskRevision")` |
| `numericParts` | `TaskRevisionNumericPart[]` |  |
| `choices` | `TaskRevisionChoice[]` |  |
| `correctChoices` | `TaskRevisionCorrectChoice[]` |  |
| `studentTaskStatesActive` | `StudentTaskState[]` | `@relation("StudentTaskStateActiveRevision")` |
| `studentTaskStatesCredited` | `StudentTaskState[]` | `@relation("StudentTaskStateCreditedRevision")` |
| `attempts` | `Attempt[]` |  |
| `photoTaskSubmissions` | `PhotoTaskSubmission[]` |  |

### TaskRevisionNumericPart

- Таблица: `task_revision_numeric_parts`
- Model attributes: `@@unique([taskRevisionId, partKey])`, `@@index([taskRevisionId])`, `@@map("task_revision_numeric_parts")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `taskRevisionId` | `String` | `@map("task_revision_id") @db.Uuid` |
| `partKey` | `String` | `@map("part_key")` |
| `labelLite` | `String?` | `@map("label_lite")` |
| `correctValue` | `String` | `@map("correct_value")` |
| `taskRevision` | `TaskRevision` | `@relation(fields: [taskRevisionId], references: [id], onDelete: Cascade)` |

### TaskRevisionChoice

- Таблица: `task_revision_choices`
- Model attributes: `@@unique([taskRevisionId, choiceKey])`, `@@index([taskRevisionId])`, `@@map("task_revision_choices")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `taskRevisionId` | `String` | `@map("task_revision_id") @db.Uuid` |
| `choiceKey` | `String` | `@map("choice_key")` |
| `contentLite` | `String` | `@map("content_lite")` |
| `taskRevision` | `TaskRevision` | `@relation(fields: [taskRevisionId], references: [id], onDelete: Cascade)` |

### TaskRevisionCorrectChoice

- Таблица: `task_revision_correct_choices`
- Model attributes: `@@unique([taskRevisionId, choiceKey])`, `@@index([taskRevisionId])`, `@@map("task_revision_correct_choices")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `taskRevisionId` | `String` | `@map("task_revision_id") @db.Uuid` |
| `choiceKey` | `String` | `@map("choice_key")` |
| `taskRevision` | `TaskRevision` | `@relation(fields: [taskRevisionId], references: [id], onDelete: Cascade)` |

### StudentUnitState

- Таблица: `student_unit_state`
- Model attributes: `@@id([studentId, unitId])`, `@@index([unitId, status])`, `@@index([studentId, status])`, `@@map("student_unit_state")`

| Field | Type | Attributes |
| --- | --- | --- |
| `studentId` | `String` | `@map("student_id") @db.Uuid` |
| `unitId` | `String` | `@map("unit_id") @db.Uuid` |
| `status` | `StudentUnitStatus` |  |
| `overrideOpened` | `Boolean` | `@default(false) @map("override_opened")` |
| `countedTasks` | `Int` | `@default(0) @map("counted_tasks")` |
| `solvedTasks` | `Int` | `@default(0) @map("solved_tasks")` |
| `totalTasks` | `Int` | `@default(0) @map("total_tasks")` |
| `completionPercent` | `Int` | `@default(0) @map("completion_percent")` |
| `solvedPercent` | `Int` | `@default(0) @map("solved_percent")` |
| `becameAvailableAt` | `DateTime?` | `@map("became_available_at")` |
| `startedAt` | `DateTime?` | `@map("started_at")` |
| `completedAt` | `DateTime?` | `@map("completed_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `student` | `User` | `@relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `unit` | `Unit` | `@relation(fields: [unitId], references: [id], onDelete: Cascade)` |

### StudentTaskState

- Таблица: `student_task_state`
- Model attributes: `@@id([studentId, taskId])`, `@@index([studentId, status])`, `@@index([taskId, status])`, `@@index([lockedUntil])`, `@@map("student_task_state")`

| Field | Type | Attributes |
| --- | --- | --- |
| `studentId` | `String` | `@map("student_id") @db.Uuid` |
| `taskId` | `String` | `@map("task_id") @db.Uuid` |
| `status` | `StudentTaskStatus` |  |
| `activeRevisionId` | `String` | `@map("active_revision_id") @db.Uuid` |
| `wrongAttempts` | `Int` | `@default(0) @map("wrong_attempts")` |
| `lockedUntil` | `DateTime?` | `@map("locked_until")` |
| `requiredSkipped` | `Boolean` | `@default(false) @map("required_skipped")` |
| `creditedRevisionId` | `String?` | `@map("credited_revision_id") @db.Uuid` |
| `creditedAt` | `DateTime?` | `@map("credited_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `student` | `User` | `@relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `task` | `Task` | `@relation(fields: [taskId], references: [id], onDelete: Cascade)` |
| `activeRevision` | `TaskRevision` | `@relation("StudentTaskStateActiveRevision", fields: [activeRevisionId], references: [id], onDelete: Restrict)` |
| `creditedRevision` | `TaskRevision?` | `@relation("StudentTaskStateCreditedRevision", fields: [creditedRevisionId], references: [id], onDelete: SetNull)` |

### UnitUnlockOverride

- Таблица: `unit_unlock_overrides`
- Model attributes: `@@unique([studentId, unitId])`, `@@index([unitId])`, `@@map("unit_unlock_overrides")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `studentId` | `String` | `@map("student_id") @db.Uuid` |
| `unitId` | `String` | `@map("unit_id") @db.Uuid` |
| `openedByTeacherId` | `String` | `@map("opened_by_teacher_id") @db.Uuid` |
| `reason` | `String?` |  |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `student` | `User` | `@relation("UnitUnlockOverrideStudent", fields: [studentId], references: [id], onDelete: Cascade)` |
| `unit` | `Unit` | `@relation(fields: [unitId], references: [id], onDelete: Cascade)` |
| `openedByTeacher` | `User` | `@relation("UnitUnlockOverrideTeacher", fields: [openedByTeacherId], references: [id], onDelete: Restrict)` |

### SectionUnlockOverride

- Таблица: `section_unlock_overrides`
- Model attributes: `@@unique([studentId, sectionId])`, `@@index([sectionId])`, `@@map("section_unlock_overrides")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `studentId` | `String` | `@map("student_id") @db.Uuid` |
| `sectionId` | `String` | `@map("section_id") @db.Uuid` |
| `openedByTeacherId` | `String` | `@map("opened_by_teacher_id") @db.Uuid` |
| `reason` | `String?` |  |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `student` | `User` | `@relation("SectionUnlockOverrideStudent", fields: [studentId], references: [id], onDelete: Cascade)` |
| `section` | `Section` | `@relation(fields: [sectionId], references: [id], onDelete: Cascade)` |
| `openedByTeacher` | `User` | `@relation("SectionUnlockOverrideTeacher", fields: [openedByTeacherId], references: [id], onDelete: Restrict)` |

### Attempt

- Таблица: `attempts`
- Model attributes: `@@unique([studentId, taskRevisionId, attemptNo])`, `@@index([studentId, createdAt])`, `@@index([taskId, createdAt])`, `@@index([taskRevisionId, createdAt])`, `@@map("attempts")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `studentId` | `String` | `@map("student_id") @db.Uuid` |
| `taskId` | `String` | `@map("task_id") @db.Uuid` |
| `taskRevisionId` | `String` | `@map("task_revision_id") @db.Uuid` |
| `attemptNo` | `Int` | `@map("attempt_no")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `kind` | `AttemptKind` |  |
| `numericAnswers` | `Json?` | `@map("numeric_answers")` |
| `selectedChoiceKey` | `String?` | `@map("selected_choice_key")` |
| `selectedChoiceKeys` | `Json?` | `@map("selected_choice_keys")` |
| `result` | `AttemptResult` |  |
| `student` | `User` | `@relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `task` | `Task` | `@relation(fields: [taskId], references: [id], onDelete: Cascade)` |
| `taskRevision` | `TaskRevision` | `@relation(fields: [taskRevisionId], references: [id], onDelete: Cascade)` |
| `photoTaskSubmission` | `PhotoTaskSubmission?` |  |

### PhotoTaskSubmission

- Таблица: `photo_task_submissions`
- Model attributes: `@@index([studentUserId, status])`, `@@index([taskId, studentUserId])`, `@@index([unitId, studentUserId])`, `@@map("photo_task_submissions")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `studentUserId` | `String` | `@map("student_user_id") @db.Uuid` |
| `taskId` | `String` | `@map("task_id") @db.Uuid` |
| `taskRevisionId` | `String` | `@map("task_revision_id") @db.Uuid` |
| `unitId` | `String` | `@map("unit_id") @db.Uuid` |
| `attemptId` | `String` | `@unique @map("attempt_id") @db.Uuid` |
| `assetKeysJson` | `Json` | `@map("asset_keys_json")` |
| `status` | `PhotoTaskSubmissionStatus` | `@default(submitted)` |
| `rejectedReason` | `String?` | `@map("rejected_reason")` |
| `reviewedByTeacherUserId` | `String?` | `@map("reviewed_by_teacher_user_id") @db.Uuid` |
| `submittedAt` | `DateTime` | `@default(now()) @map("submitted_at")` |
| `reviewedAt` | `DateTime?` | `@map("reviewed_at")` |
| `student` | `User` | `@relation("PhotoTaskSubmissionStudent", fields: [studentUserId], references: [id], onDelete: Cascade)` |
| `task` | `Task` | `@relation(fields: [taskId], references: [id], onDelete: Cascade)` |
| `taskRevision` | `TaskRevision` | `@relation(fields: [taskRevisionId], references: [id], onDelete: Cascade)` |
| `unit` | `Unit` | `@relation(fields: [unitId], references: [id], onDelete: Cascade)` |
| `attempt` | `Attempt` | `@relation(fields: [attemptId], references: [id], onDelete: Cascade)` |
| `reviewedByTeacher` | `User?` | `@relation("PhotoTaskSubmissionReviewer", fields: [reviewedByTeacherUserId], references: [id], onDelete: SetNull)` |

### Notification

- Таблица: `notifications`
- Model attributes: `@@index([recipientUserId, readAt, createdAt])`, `@@map("notifications")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `recipientUserId` | `String` | `@map("recipient_user_id") @db.Uuid` |
| `type` | `NotificationType` |  |
| `payload` | `Json` |  |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `readAt` | `DateTime?` | `@map("read_at")` |
| `recipientUser` | `User` | `@relation(fields: [recipientUserId], references: [id], onDelete: Cascade)` |

### DomainEventLog

- Таблица: `domain_event_log`
- Model attributes: `@@index([occurredAt])`, `@@index([category, occurredAt])`, `@@index([eventType, occurredAt])`, `@@index([actorUserId, occurredAt])`, `@@index([entityType, entityId])`, `@@map("domain_event_log")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `category` | `EventCategory` |  |
| `eventType` | `String` | `@map("event_type")` |
| `actorUserId` | `String?` | `@map("actor_user_id") @db.Uuid` |
| `entityType` | `String` | `@map("entity_type")` |
| `entityId` | `String` | `@map("entity_id") @db.Uuid` |
| `payload` | `Json` |  |
| `occurredAt` | `DateTime` | `@default(now()) @map("occurred_at")` |
| `actorUser` | `User?` | `@relation("DomainEventActor", fields: [actorUserId], references: [id], onDelete: SetNull)` |
