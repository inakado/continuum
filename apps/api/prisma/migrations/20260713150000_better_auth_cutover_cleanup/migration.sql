DROP TABLE "auth_refresh_tokens";
DROP TABLE "auth_sessions";

ALTER TABLE "users" DROP COLUMN "password_hash";
