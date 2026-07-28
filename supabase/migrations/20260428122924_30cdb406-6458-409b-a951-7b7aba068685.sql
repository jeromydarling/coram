ALTER TABLE library_essays
  DROP CONSTRAINT IF EXISTS library_essays_target_app_chk;

ALTER TABLE library_essays
  ADD CONSTRAINT library_essays_target_app_chk
  CHECK (target_app IN (
    'thecros',
    'vigilia',
    'resurrectio',
    'hortus',
    'communis',
    'transitus',
    'bitoku',
    'theschola'
  ));