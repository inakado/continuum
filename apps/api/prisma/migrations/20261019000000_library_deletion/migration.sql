CREATE TABLE "library_asset_deletions" (
  "object_key" TEXT PRIMARY KEY,
  "retry_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "library_asset_deletions_retry_at_idx" ON "library_asset_deletions"("retry_at");
