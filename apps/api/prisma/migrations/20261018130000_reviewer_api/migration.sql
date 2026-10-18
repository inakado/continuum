-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "configId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT,
    "start" TEXT,
    "referenceId" TEXT NOT NULL,
    "prefix" TEXT,
    "key" TEXT NOT NULL,
    "refillInterval" INTEGER,
    "refillAmount" INTEGER,
    "lastRefillAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rateLimitEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rateLimitTimeWindow" INTEGER NOT NULL DEFAULT 60000,
    "rateLimitMax" INTEGER NOT NULL DEFAULT 120,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "remaining" INTEGER,
    "lastRequest" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "permissions" TEXT,
    "metadata" TEXT,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviewer_device_keys" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "scopes" TEXT[],
    "assignmentIds" UUID[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "reviewer_device_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_reviewer_grants" (
    "id" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "reviewerUserId" UUID NOT NULL,
    "canPublish" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "assessment_reviewer_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_reviews" (
    "id" UUID NOT NULL,
    "solutionId" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "publishedRevision" INTEGER,

    CONSTRAINT "assessment_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_review_versions" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "sourceRevision" INTEGER NOT NULL,
    "points" INTEGER,
    "reportId" UUID,
    "authorUserId" UUID NOT NULL,
    "keyId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_review_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_review_reports" (
    "id" UUID NOT NULL,
    "solutionId" UUID NOT NULL,
    "sourceRevision" INTEGER NOT NULL,
    "uploaderId" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentHash" TEXT,
    "sizeBytes" INTEGER,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviewer_write_receipts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "keyId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "route" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviewer_write_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_referenceId_idx" ON "api_keys"("referenceId");

-- CreateIndex
CREATE INDEX "reviewer_device_keys_userId_idx" ON "reviewer_device_keys"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_reviewer_grants_assignmentId_reviewerUserId_key" ON "assessment_reviewer_grants"("assignmentId", "reviewerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_reviews_solutionId_key" ON "assessment_reviews"("solutionId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_review_versions_reviewId_revision_key" ON "assessment_review_versions"("reviewId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_review_reports_objectKey_key" ON "assessment_review_reports"("objectKey");

-- CreateIndex
CREATE INDEX "reviewer_write_receipts_assignmentId_idx" ON "reviewer_write_receipts"("assignmentId");

-- AddForeignKey
ALTER TABLE "reviewer_device_keys" ADD CONSTRAINT "reviewer_device_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_reviewer_grants" ADD CONSTRAINT "assessment_reviewer_grants_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assessment_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_reviewer_grants" ADD CONSTRAINT "assessment_reviewer_grants_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_reviews" ADD CONSTRAINT "assessment_reviews_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "assessment_solution_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_review_versions" ADD CONSTRAINT "assessment_review_versions_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "assessment_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_review_versions" ADD CONSTRAINT "assessment_review_versions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "assessment_review_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_review_reports" ADD CONSTRAINT "assessment_review_reports_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "assessment_solution_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
