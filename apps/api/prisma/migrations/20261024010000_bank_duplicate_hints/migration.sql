-- Non-unique advisory lookup indexes. Existing JSON and version hashes stay unchanged.
CREATE INDEX "assessment_task_versions_source_hint_idx" ON "assessment_task_versions"
  (lower(btrim(normalize(data #>> '{task,source,provider}', NFC))), lower(btrim(normalize(data #>> '{task,source,externalId}', NFC))));
CREATE INDEX "assessment_task_versions_statement_hint_idx" ON "assessment_task_versions"
  (md5(btrim(regexp_replace(normalize(data ->> 'statement', NFC), '[[:space:]]+', ' ', 'g'))));
