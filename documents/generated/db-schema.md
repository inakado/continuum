# generated/db-schema

Статус: сгенерированный срез текущей Prisma schema. Не редактировать вручную.

## Source of truth

- `apps/api/prisma/schema.prisma`
- Regenerate: `pnpm docs:generate`
- Drift check: `pnpm docs:check:generated`

## Enums

- `Role`: `admin` | `teacher` | `student`
- `GradeBand`: `grade_7` | `grade_8` | `grade_9` | `grade_10_11`
- `PublicationStatus`: `draft` | `published`
- `LessonArtifactType`: `pdf` | `interactive` | `tasks_pdf`

## Models

### User

- Таблица: `users`
- Model attributes: `@@index([role])`, `@@map("users")`

| Field | Type | Attributes |
| --- | --- | --- |
| `reviewerKeys` | `ReviewerDeviceKey[]` |  |
| `reviewerGrants` | `AssessmentReviewerGrant[]` |  |
| `assessmentWorks` | `AssessmentWork[]` |  |
| `assessmentRecipients` | `AssessmentRecipient[]` |  |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `role` | `Role` |  |
| `login` | `String` | `@unique` |
| `displayLogin` | `String?` | `@map("display_login")` |
| `email` | `String` | `@unique` |
| `name` | `String` |  |
| `emailVerified` | `Boolean` | `@default(false) @map("email_verified")` |
| `image` | `String?` |  |
| `isActive` | `Boolean` | `@default(true) @map("is_active")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `teacherProfile` | `TeacherProfile?` |  |
| `studentProfile` | `StudentProfile?` | `@relation("StudentProfileUser")` |
| `leadStudents` | `StudentProfile[]` | `@relation("StudentProfileLeadTeacher")` |
| `sessions` | `Session[]` |  |
| `accounts` | `Account[]` |  |
| `accessGrants` | `AccessGrant[]` | `@relation("AccessGrantStudent")` |
| `grantedAccesses` | `AccessGrant[]` | `@relation("AccessGrantTeacher")` |
| `createdSections` | `Section[]` | `@relation("SectionCreator")` |
| `createdLessons` | `Lesson[]` | `@relation("LessonCreator")` |
| `uploadedAssets` | `Asset[]` | `@relation("AssetUploader")` |
| `schoolClasses` | `SchoolClass[]` |  |
| `studentBatches` | `StudentProvisioningBatch[]` |  |
| `passwordResets` | `StudentPasswordReset[]` | `@relation("PasswordResetTeacher")` |
| `bankTasks` | `AssessmentBankTask[]` |  |
| `bankImports` | `AssessmentBankImport[]` |  |

### AssessmentBankTask

- Таблица: `assessment_bank_tasks`
- Model attributes: `@@unique([teacherId, stableId])`, `@@map("assessment_bank_tasks")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `teacherId` | `String` | `@map("teacher_id") @db.Uuid` |
| `stableId` | `String` | `@map("stable_id")` |
| `latestVersionId` | `String?` | `@unique @map("latest_version_id") @db.Uuid` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `teacher` | `User` | `@relation(fields: [teacherId], references: [id], onDelete: Restrict)` |
| `latestVersion` | `AssessmentTaskVersion?` | `@relation("LatestAssessmentVersion", fields: [latestVersionId], references: [id], onDelete: SetNull)` |
| `versions` | `AssessmentTaskVersion[]` | `@relation("AssessmentVersions")` |

### AssessmentTaskVersion

- Таблица: `assessment_task_versions`
- Model attributes: `@@unique([taskId, version])`, `@@index([gradeBand, type])`, `@@map("assessment_task_versions")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `taskId` | `String` | `@map("task_id") @db.Uuid` |
| `version` | `Int` |  |
| `contentHash` | `String` | `@map("content_hash")` |
| `data` | `Json` |  |
| `title` | `String` |  |
| `gradeBand` | `GradeBand` | `@map("grade_band")` |
| `type` | `String` |  |
| `topicPath` | `String[]` | `@map("topic_path")` |
| `searchText` | `String` | `@map("search_text")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `task` | `AssessmentBankTask` | `@relation("AssessmentVersions", fields: [taskId], references: [id], onDelete: Cascade)` |
| `currentFor` | `AssessmentBankTask?` | `@relation("LatestAssessmentVersion")` |

### AssessmentWork

- Таблица: `assessment_works`
- Model attributes: `@@index([teacherId, updatedAt])`, `@@map("assessment_works")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @db.Uuid` |
| `teacherId` | `String` | `@map("teacher_id") @db.Uuid` |
| `title` | `String` |  |
| `instructions` | `String` | `@default("")` |
| `gradeBand` | `GradeBand` | `@map("grade_band")` |
| `items` | `Json` |  |
| `revision` | `Int` | `@default(1)` |
| `taskCount` | `Int` | `@default(0) @map("task_count")` |
| `maxPoints` | `Int` | `@default(0) @map("max_points")` |
| `lastRequestId` | `String?` | `@map("last_request_id") @db.Uuid` |
| `lastInputHash` | `String?` | `@map("last_input_hash")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `teacher` | `User` | `@relation(fields: [teacherId], references: [id], onDelete: Restrict)` |
| `versions` | `AssessmentWorkVersion[]` |  |
| `assignmentRequests` | `AssessmentAssignmentRequest[]` |  |

### AssessmentWorkVersion

- Таблица: `assessment_work_versions`
- Model attributes: `@@unique([workId, number])`, `@@unique([workId, revision])`, `@@map("assessment_work_versions")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `workId` | `String` | `@map("work_id") @db.Uuid` |
| `number` | `Int` |  |
| `revision` | `Int` |  |
| `data` | `Json` |  |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `work` | `AssessmentWork` | `@relation(fields: [workId], references: [id], onDelete: Restrict)` |
| `assignments` | `AssessmentAssignment[]` |  |
| `recipients` | `AssessmentRecipient[]` |  |

### AssessmentAssignment

- Таблица: `assessment_assignments`
- Model attributes: `@@unique([versionId, classId])`, `@@map("assessment_assignments")`

| Field | Type | Attributes |
| --- | --- | --- |
| `reviewerGrants` | `AssessmentReviewerGrant[]` |  |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `versionId` | `String` | `@map("version_id") @db.Uuid` |
| `classId` | `String?` | `@map("class_id") @db.Uuid` |
| `classTitle` | `String` | `@map("class_title")` |
| `academicYear` | `Int` | `@map("academic_year")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `version` | `AssessmentWorkVersion` | `@relation(fields: [versionId], references: [id], onDelete: Restrict)` |
| `schoolClass` | `SchoolClass?` | `@relation(fields: [classId], references: [id], onDelete: SetNull)` |
| `recipients` | `AssessmentRecipient[]` |  |

### AssessmentRecipient

- Таблица: `assessment_recipients`
- Model attributes: `@@unique([versionId, studentId])`, `@@index([studentId, createdAt])`, `@@index([assignmentId])`, `@@map("assessment_recipients")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `assignmentId` | `String` | `@map("assignment_id") @db.Uuid` |
| `versionId` | `String` | `@map("version_id") @db.Uuid` |
| `studentId` | `String?` | `@map("student_id") @db.Uuid` |
| `studentName` | `String` | `@map("student_name")` |
| `studentLogin` | `String` | `@map("student_login")` |
| `answers` | `Json` | `@default("{}")` |
| `revision` | `Int` | `@default(1)` |
| `answeredCount` | `Int` | `@default(0) @map("answered_count")` |
| `startedAt` | `DateTime?` | `@map("started_at")` |
| `completedAt` | `DateTime?` | `@map("completed_at")` |
| `points` | `Int?` |  |
| `correctCount` | `Int?` | `@map("correct_count")` |
| `incorrectCount` | `Int?` | `@map("incorrect_count")` |
| `lastRequestId` | `String?` | `@map("last_request_id") @db.Uuid` |
| `lastInputHash` | `String?` | `@map("last_input_hash")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `assignment` | `AssessmentAssignment` | `@relation(fields: [assignmentId], references: [id], onDelete: Restrict)` |
| `version` | `AssessmentWorkVersion` | `@relation(fields: [versionId], references: [id], onDelete: Restrict)` |
| `student` | `User?` | `@relation(fields: [studentId], references: [id], onDelete: SetNull)` |
| `solutionAnswers` | `AssessmentSolutionAnswer[]` |  |

### AssessmentSolutionAnswer

- Таблица: `assessment_solution_answers`
- Model attributes: `@@unique([recipientId, taskId])`, `@@map("assessment_solution_answers")`

| Field | Type | Attributes |
| --- | --- | --- |
| `review` | `AssessmentReview?` |  |
| `reports` | `AssessmentReviewReport[]` |  |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `recipientId` | `String` | `@map("recipient_id") @db.Uuid` |
| `taskId` | `String` | `@map("task_id") @db.Uuid` |
| `revision` | `Int` | `@default(0)` |
| `lockedAt` | `DateTime?` | `@map("locked_at")` |
| `recipient` | `AssessmentRecipient` | `@relation(fields: [recipientId], references: [id], onDelete: Cascade)` |
| `photos` | `AssessmentSolutionPhoto[]` |  |

### AssessmentSolutionPhoto

- Таблица: `assessment_solution_photos`
- Model attributes: `@@index([answerId, createdAt])`, `@@map("assessment_solution_photos")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @db.Uuid` |
| `answerId` | `String` | `@map("answer_id") @db.Uuid` |
| `objectKey` | `String` | `@unique @map("object_key")` |
| `contentHash` | `String` | `@map("content_hash")` |
| `contentType` | `String` | `@map("content_type")` |
| `sizeBytes` | `Int` | `@map("size_bytes")` |
| `confirmedAt` | `DateTime?` | `@map("confirmed_at")` |
| `removedAt` | `DateTime?` | `@map("removed_at")` |
| `purgedAt` | `DateTime?` | `@map("purged_at")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `answer` | `AssessmentSolutionAnswer` | `@relation(fields: [answerId], references: [id], onDelete: Cascade)` |

### Apikey

- Таблица: `api_keys`
- Model attributes: `@@index([referenceId])`, `@@map("api_keys")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `configId` | `String` | `@default("default")` |
| `name` | `String?` |  |
| `start` | `String?` |  |
| `referenceId` | `String` |  |
| `prefix` | `String?` |  |
| `key` | `String` | `@unique` |
| `refillInterval` | `Int?` |  |
| `refillAmount` | `Int?` |  |
| `lastRefillAt` | `DateTime?` |  |
| `enabled` | `Boolean` | `@default(true)` |
| `rateLimitEnabled` | `Boolean` | `@default(true)` |
| `rateLimitTimeWindow` | `Int` | `@default(60000)` |
| `rateLimitMax` | `Int` | `@default(120)` |
| `requestCount` | `Int` | `@default(0)` |
| `remaining` | `Int?` |  |
| `lastRequest` | `DateTime?` |  |
| `expiresAt` | `DateTime?` |  |
| `createdAt` | `DateTime` | `@default(now())` |
| `updatedAt` | `DateTime` | `@updatedAt` |
| `permissions` | `String?` |  |
| `metadata` | `String?` |  |

### ReviewerDeviceKey

- Таблица: `reviewer_device_keys`
- Model attributes: `@@index([userId])`, `@@map("reviewer_device_keys")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @db.Uuid` |
| `userId` | `String` | `@db.Uuid` |
| `name` | `String` |  |
| `scopes` | `String[]` |  |
| `assignmentIds` | `String[]` | `@default([]) @db.Uuid` |
| `classIds` | `String[]` | `@default([]) @db.Uuid` |
| `studentIds` | `String[]` | `@default([]) @db.Uuid` |
| `createdAt` | `DateTime` | `@default(now())` |
| `expiresAt` | `DateTime` |  |
| `revokedAt` | `DateTime?` |  |
| `user` | `User` | `@relation(fields: [userId], references: [id], onDelete: Cascade)` |

### AssessmentReviewerGrant

- Таблица: `assessment_reviewer_grants`
- Model attributes: `@@unique([assignmentId, reviewerUserId])`, `@@map("assessment_reviewer_grants")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `assignmentId` | `String` | `@db.Uuid` |
| `reviewerUserId` | `String` | `@db.Uuid` |
| `canPublish` | `Boolean` | `@default(false)` |
| `expiresAt` | `DateTime` |  |
| `revokedAt` | `DateTime?` |  |
| `assignment` | `AssessmentAssignment` | `@relation(fields: [assignmentId], references: [id], onDelete: Cascade)` |
| `reviewer` | `User` | `@relation(fields: [reviewerUserId], references: [id], onDelete: Cascade)` |

### AssessmentReview

- Таблица: `assessment_reviews`
- Model attributes: `@@map("assessment_reviews")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `solutionId` | `String` | `@unique @db.Uuid` |
| `revision` | `Int` | `@default(0)` |
| `publishedRevision` | `Int?` |  |
| `solution` | `AssessmentSolutionAnswer` | `@relation(fields: [solutionId], references: [id], onDelete: Cascade)` |
| `versions` | `AssessmentReviewVersion[]` |  |

### AssessmentReviewVersion

- Таблица: `assessment_review_versions`
- Model attributes: `@@unique([reviewId, revision])`, `@@map("assessment_review_versions")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `reviewId` | `String` | `@db.Uuid` |
| `revision` | `Int` |  |
| `sourceRevision` | `Int` |  |
| `points` | `Int?` |  |
| `reportId` | `String?` | `@db.Uuid` |
| `authorUserId` | `String` | `@db.Uuid` |
| `keyId` | `String` | `@db.Uuid` |
| `createdAt` | `DateTime` | `@default(now())` |
| `review` | `AssessmentReview` | `@relation(fields: [reviewId], references: [id], onDelete: Cascade)` |
| `report` | `AssessmentReviewReport?` | `@relation(fields: [reportId], references: [id], onDelete: Restrict)` |

### AssessmentReviewReport

- Таблица: `assessment_review_reports`
- Model attributes: `@@map("assessment_review_reports")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @db.Uuid` |
| `solutionId` | `String` | `@db.Uuid` |
| `sourceRevision` | `Int` |  |
| `uploaderId` | `String` | `@db.Uuid` |
| `objectKey` | `String` | `@unique` |
| `contentHash` | `String?` |  |
| `sizeBytes` | `Int?` |  |
| `confirmedAt` | `DateTime?` |  |
| `createdAt` | `DateTime` | `@default(now())` |
| `solution` | `AssessmentSolutionAnswer` | `@relation(fields: [solutionId], references: [id], onDelete: Cascade)` |
| `reviews` | `AssessmentReviewVersion[]` |  |

### ReviewerWriteReceipt

- Таблица: `reviewer_write_receipts`
- Model attributes: `@@index([assignmentId])`, `@@map("reviewer_write_receipts")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @db.Uuid` |
| `userId` | `String` | `@db.Uuid` |
| `keyId` | `String` | `@db.Uuid` |
| `assignmentId` | `String` | `@db.Uuid` |
| `route` | `String` |  |
| `inputHash` | `String` |  |
| `result` | `Json` |  |
| `createdAt` | `DateTime` | `@default(now())` |

### AssessmentAssignmentRequest

- Таблица: `assessment_assignment_requests`
- Model attributes: `@@index([workId])`, `@@map("assessment_assignment_requests")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @db.Uuid` |
| `workId` | `String` | `@map("work_id") @db.Uuid` |
| `inputHash` | `String` | `@map("input_hash")` |
| `result` | `Json` |  |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `work` | `AssessmentWork` | `@relation(fields: [workId], references: [id], onDelete: Restrict)` |

### AssessmentBankImport

- Таблица: `assessment_bank_imports`
- Model attributes: `@@index([teacherId, expiresAt])`, `@@map("assessment_bank_imports")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `teacherId` | `String` | `@map("teacher_id") @db.Uuid` |
| `title` | `String` |  |
| `data` | `Json` |  |
| `baseline` | `Json` |  |
| `result` | `Json?` |  |
| `expiresAt` | `DateTime` | `@map("expires_at")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `teacher` | `User` | `@relation(fields: [teacherId], references: [id], onDelete: Restrict)` |

### Session

- Таблица: `sessions`
- Model attributes: `@@index([userId])`, `@@index([expiresAt])`, `@@map("sessions")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `token` | `String` | `@unique` |
| `userId` | `String` | `@map("user_id") @db.Uuid` |
| `expiresAt` | `DateTime` | `@map("expires_at")` |
| `ipAddress` | `String?` | `@map("ip_address")` |
| `userAgent` | `String?` | `@map("user_agent")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `user` | `User` | `@relation(fields: [userId], references: [id], onDelete: Cascade)` |

### Account

- Таблица: `accounts`
- Model attributes: `@@unique([providerId, accountId])`, `@@index([userId])`, `@@map("accounts")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `accountId` | `String` | `@map("account_id")` |
| `providerId` | `String` | `@map("provider_id")` |
| `userId` | `String` | `@map("user_id") @db.Uuid` |
| `accessToken` | `String?` | `@map("access_token")` |
| `refreshToken` | `String?` | `@map("refresh_token")` |
| `idToken` | `String?` | `@map("id_token")` |
| `accessTokenExpiresAt` | `DateTime?` | `@map("access_token_expires_at")` |
| `refreshTokenExpiresAt` | `DateTime?` | `@map("refresh_token_expires_at")` |
| `scope` | `String?` |  |
| `password` | `String?` |  |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `user` | `User` | `@relation(fields: [userId], references: [id], onDelete: Cascade)` |

### Verification

- Таблица: `verifications`
- Model attributes: `@@index([identifier])`, `@@index([expiresAt])`, `@@map("verifications")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `identifier` | `String` |  |
| `value` | `String` |  |
| `expiresAt` | `DateTime` | `@map("expires_at")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |

### TeacherProfile

- Таблица: `teacher_profiles`
- Model attributes: `@@map("teacher_profiles")`

| Field | Type | Attributes |
| --- | --- | --- |
| `userId` | `String` | `@id @map("user_id") @db.Uuid` |
| `firstName` | `String` | `@map("first_name")` |
| `lastName` | `String` | `@map("last_name")` |
| `middleName` | `String?` | `@map("middle_name")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `user` | `User` | `@relation(fields: [userId], references: [id], onDelete: Cascade)` |

### StudentProfile

- Таблица: `student_profiles`
- Model attributes: `@@index([leadTeacherId])`, `@@index([classId])`, `@@map("student_profiles")`

| Field | Type | Attributes |
| --- | --- | --- |
| `userId` | `String` | `@id @map("user_id") @db.Uuid` |
| `leadTeacherId` | `String` | `@map("lead_teacher_id") @db.Uuid` |
| `firstName` | `String?` | `@map("first_name")` |
| `lastName` | `String?` | `@map("last_name")` |
| `middleName` | `String?` | `@map("middle_name")` |
| `classId` | `String?` | `@map("class_id") @db.Uuid` |
| `provisioningBatchId` | `String?` | `@map("provisioning_batch_id") @db.Uuid` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `user` | `User` | `@relation("StudentProfileUser", fields: [userId], references: [id], onDelete: Cascade)` |
| `leadTeacher` | `User` | `@relation("StudentProfileLeadTeacher", fields: [leadTeacherId], references: [id], onDelete: Restrict)` |
| `schoolClass` | `SchoolClass?` | `@relation(fields: [classId], references: [id], onDelete: Restrict)` |
| `provisioningBatch` | `StudentProvisioningBatch?` | `@relation(fields: [provisioningBatchId], references: [id], onDelete: Restrict)` |
| `passwordResets` | `StudentPasswordReset[]` |  |

### SchoolClass

- Таблица: `school_classes`
- Model attributes: `@@unique([academicYear, title])`, `@@map("school_classes")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `teacherId` | `String` | `@map("teacher_id") @db.Uuid` |
| `title` | `String` |  |
| `grade` | `Int` |  |
| `academicYear` | `Int` | `@map("academic_year")` |
| `isArchived` | `Boolean` | `@default(false) @map("is_archived")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `teacher` | `User` | `@relation(fields: [teacherId], references: [id], onDelete: Restrict)` |
| `students` | `StudentProfile[]` |  |
| `batches` | `StudentProvisioningBatch[]` |  |
| `assignments` | `AssessmentAssignment[]` |  |

### StudentProvisioningBatch

- Таблица: `student_provisioning_batches`
- Model attributes: `@@map("student_provisioning_batches")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @db.Uuid` |
| `teacherId` | `String` | `@map("teacher_id") @db.Uuid` |
| `classId` | `String?` | `@map("class_id") @db.Uuid` |
| `inputHash` | `String` | `@map("input_hash")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `teacher` | `User` | `@relation(fields: [teacherId], references: [id], onDelete: Restrict)` |
| `schoolClass` | `SchoolClass?` | `@relation(fields: [classId], references: [id], onDelete: SetNull)` |
| `students` | `StudentProfile[]` |  |

### StudentPasswordReset

- Таблица: `student_password_resets`
- Model attributes: `@@map("student_password_resets")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @db.Uuid` |
| `teacherId` | `String` | `@map("teacher_id") @db.Uuid` |
| `studentId` | `String` | `@map("student_id") @db.Uuid` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `teacher` | `User` | `@relation("PasswordResetTeacher", fields: [teacherId], references: [id], onDelete: Restrict)` |
| `student` | `StudentProfile` | `@relation(fields: [studentId], references: [userId], onDelete: Restrict)` |

### AccessGrant

- Таблица: `access_grants`
- Model attributes: `@@unique([studentId, gradeBand])`, `@@index([grantedById])`, `@@map("access_grants")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `studentId` | `String` | `@map("student_id") @db.Uuid` |
| `gradeBand` | `GradeBand` | `@map("grade_band")` |
| `grantedById` | `String` | `@map("granted_by_id") @db.Uuid` |
| `grantedAt` | `DateTime` | `@default(now()) @map("granted_at")` |
| `student` | `User` | `@relation("AccessGrantStudent", fields: [studentId], references: [id], onDelete: Cascade)` |
| `grantedBy` | `User` | `@relation("AccessGrantTeacher", fields: [grantedById], references: [id], onDelete: Restrict)` |

### Section

- Таблица: `sections`
- Model attributes: `@@index([gradeBand, status, sortOrder])`, `@@map("sections")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `gradeBand` | `GradeBand` | `@map("grade_band")` |
| `title` | `String` |  |
| `description` | `String?` |  |
| `status` | `PublicationStatus` | `@default(draft)` |
| `sortOrder` | `Int` | `@default(0) @map("sort_order")` |
| `createdById` | `String` | `@map("created_by_id") @db.Uuid` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `createdBy` | `User` | `@relation("SectionCreator", fields: [createdById], references: [id], onDelete: Restrict)` |
| `lessons` | `Lesson[]` |  |

### Lesson

- Таблица: `lessons`
- Model attributes: `@@index([sectionId, status, sortOrder])`, `@@map("lessons")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `sectionId` | `String` | `@map("section_id") @db.Uuid` |
| `title` | `String` |  |
| `description` | `String?` |  |
| `status` | `PublicationStatus` | `@default(draft)` |
| `sortOrder` | `Int` | `@default(0) @map("sort_order")` |
| `createdById` | `String` | `@map("created_by_id") @db.Uuid` |
| `publishedAt` | `DateTime?` | `@map("published_at")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `section` | `Section` | `@relation(fields: [sectionId], references: [id], onDelete: Restrict)` |
| `createdBy` | `User` | `@relation("LessonCreator", fields: [createdById], references: [id], onDelete: Restrict)` |
| `artifacts` | `LessonArtifact[]` |  |
| `tasks` | `Task[]` |  |

### Asset

- Таблица: `assets`
- Model attributes: `@@index([uploadedById])`, `@@map("assets")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `objectKey` | `String` | `@unique @map("object_key")` |
| `filename` | `String` |  |
| `contentType` | `String` | `@map("content_type")` |
| `sizeBytes` | `BigInt` | `@map("size_bytes")` |
| `contentHash` | `String` | `@map("content_hash")` |
| `uploadedById` | `String` | `@map("uploaded_by_id") @db.Uuid` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `uploadedBy` | `User` | `@relation("AssetUploader", fields: [uploadedById], references: [id], onDelete: Restrict)` |
| `lessonArtifacts` | `LessonArtifact[]` |  |
| `taskImages` | `Task[]` | `@relation("TaskImage")` |
| `taskDiagramScenes` | `Task[]` | `@relation("TaskDiagramScene")` |
| `taskDiagramPreviews` | `Task[]` | `@relation("TaskDiagramPreview")` |

### LibraryAssetDeletion

- Таблица: `library_asset_deletions`
- Model attributes: `@@index([retryAt])`, `@@map("library_asset_deletions")`

| Field | Type | Attributes |
| --- | --- | --- |
| `objectKey` | `String` | `@id @map("object_key")` |
| `retryAt` | `DateTime` | `@default(now()) @map("retry_at")` |

### LessonArtifact

- Таблица: `lesson_artifacts`
- Model attributes: `@@unique([lessonId, type, version])`, `@@index([lessonId, type, status, isActive])`, `@@map("lesson_artifacts")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `lessonId` | `String` | `@map("lesson_id") @db.Uuid` |
| `assetId` | `String` | `@map("asset_id") @db.Uuid` |
| `type` | `LessonArtifactType` |  |
| `version` | `Int` |  |
| `status` | `PublicationStatus` | `@default(draft)` |
| `isActive` | `Boolean` | `@default(false) @map("is_active")` |
| `manifest` | `Json?` |  |
| `publishedAt` | `DateTime?` | `@map("published_at")` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `lesson` | `Lesson` | `@relation(fields: [lessonId], references: [id], onDelete: Cascade)` |
| `asset` | `Asset` | `@relation(fields: [assetId], references: [id], onDelete: Restrict)` |

### Task

- Таблица: `tasks`
- Model attributes: `@@index([lessonId, sortOrder])`, `@@map("tasks")`

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `String` | `@id @default(uuid()) @db.Uuid` |
| `lessonId` | `String` | `@map("lesson_id") @db.Uuid` |
| `title` | `String?` |  |
| `body` | `String` |  |
| `sortOrder` | `Int` | `@default(0) @map("sort_order")` |
| `imageAssetId` | `String?` | `@map("image_asset_id") @db.Uuid` |
| `diagramSceneAssetId` | `String?` | `@map("diagram_scene_asset_id") @db.Uuid` |
| `diagramPreviewAssetId` | `String?` | `@map("diagram_preview_asset_id") @db.Uuid` |
| `createdAt` | `DateTime` | `@default(now()) @map("created_at")` |
| `updatedAt` | `DateTime` | `@updatedAt @map("updated_at")` |
| `lesson` | `Lesson` | `@relation(fields: [lessonId], references: [id], onDelete: Cascade)` |
| `image` | `Asset?` | `@relation("TaskImage", fields: [imageAssetId], references: [id], onDelete: SetNull)` |
| `diagramScene` | `Asset?` | `@relation("TaskDiagramScene", fields: [diagramSceneAssetId], references: [id], onDelete: SetNull)` |
| `diagramPreview` | `Asset?` | `@relation("TaskDiagramPreview", fields: [diagramPreviewAssetId], references: [id], onDelete: SetNull)` |
