-- One stable ID identifies one task in the shared bank, including tombstones.
-- Stop instead of merging IDs referenced by immutable works and student answers.
BEGIN;
LOCK TABLE assessment_bank_tasks IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE duplicates text;
BEGIN
  SELECT string_agg(stable_id, ', ') INTO duplicates
  FROM (SELECT stable_id FROM assessment_bank_tasks GROUP BY stable_id HAVING count(*) > 1 ORDER BY stable_id LIMIT 20) collisions;
  IF duplicates IS NOT NULL THEN
    RAISE EXCEPTION 'Shared bank stableId collisions (including deleted): %. Resolve explicitly before migration; no data was merged.', duplicates;
  END IF;
END $$;
CREATE UNIQUE INDEX assessment_bank_tasks_stable_id_key ON assessment_bank_tasks(stable_id);
ALTER TABLE assessment_bank_tasks DROP CONSTRAINT assessment_bank_tasks_teacher_id_stable_id_key;
CREATE INDEX assessment_bank_tasks_deleted_at_idx ON assessment_bank_tasks(deleted_at);
COMMIT;
