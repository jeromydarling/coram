-- Remove legacy run references first, then the legacy suites
DELETE FROM qa_test_runs WHERE suite_key IN (
  SELECT key FROM qa_test_suites WHERE spec_path NOT LIKE 'qa-runner/tests/%' OR spec_path IS NULL
);
DELETE FROM qa_test_suites WHERE spec_path NOT LIKE 'qa-runner/tests/%' OR spec_path IS NULL;