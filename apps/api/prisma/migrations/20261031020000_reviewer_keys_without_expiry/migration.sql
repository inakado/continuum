-- NULL means no expiry. Preserve revoked, disabled and already expired keys.
ALTER TABLE "reviewer_device_keys" ALTER COLUMN "expiresAt" DROP NOT NULL;

WITH eligible AS (
  SELECT device.id
  FROM "reviewer_device_keys" device
  JOIN "api_keys" api ON api.id = device.id
  WHERE device."revokedAt" IS NULL
    AND device."expiresAt" > CURRENT_TIMESTAMP
    AND api.enabled = true
    AND (api."expiresAt" IS NULL OR api."expiresAt" > CURRENT_TIMESTAMP)
), changed AS (
  UPDATE "reviewer_device_keys"
  SET "expiresAt" = NULL
  WHERE id IN (SELECT id FROM eligible)
  RETURNING id
)
UPDATE "api_keys"
SET "expiresAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE id IN (SELECT id FROM changed);
