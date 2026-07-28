
-- Update RLS policies on csv_import_history to allow regional users to rollback their own imports
-- (They can already view and insert, we need to let them update their own)

-- Drop the existing update policy which was admin-only or self-update
DROP POLICY IF EXISTS "Users can update their own imports or admins can update any" ON public.csv_import_history;

-- Create a new policy allowing users to update their own imports (for rollback)
CREATE POLICY "Users can update their own imports"
ON public.csv_import_history
FOR UPDATE
USING (auth.uid() = imported_by)
WITH CHECK (auth.uid() = imported_by);

-- Allow admins to update any import (for management purposes)
CREATE POLICY "Admins can update any import"
ON public.csv_import_history
FOR UPDATE
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Update RLS on csv_import_records to allow regional users to delete their own import records during rollback
DROP POLICY IF EXISTS "Admins can delete import records during rollback" ON public.csv_import_records;

-- Users can delete import records for their own imports
CREATE POLICY "Users can delete their own import records"
ON public.csv_import_records
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM csv_import_history
    WHERE csv_import_history.id = csv_import_records.import_id
      AND csv_import_history.imported_by = auth.uid()
  )
);

-- Admins can delete any import records
CREATE POLICY "Admins can delete any import records"
ON public.csv_import_records
FOR DELETE
USING (has_role(auth.uid(), 'admin'));
