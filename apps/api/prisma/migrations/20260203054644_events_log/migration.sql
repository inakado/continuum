-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('admin', 'learning', 'system');

-- CreateTable
CREATE TABLE "domain_event_log" (
    "id" UUID NOT NULL,
    "category" "EventCategory" NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_user_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_event_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "domain_event_log_occurred_at_idx" ON "domain_event_log"("occurred_at");

-- CreateIndex
CREATE INDEX "domain_event_log_category_occurred_at_idx" ON "domain_event_log"("category", "occurred_at");

-- CreateIndex
CREATE INDEX "domain_event_log_event_type_occurred_at_idx" ON "domain_event_log"("event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "domain_event_log_actor_user_id_occurred_at_idx" ON "domain_event_log"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "domain_event_log_entity_type_entity_id_idx" ON "domain_event_log"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "domain_event_log" ADD CONSTRAINT "domain_event_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
