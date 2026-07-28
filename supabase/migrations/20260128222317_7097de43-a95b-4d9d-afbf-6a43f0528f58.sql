-- Create table to track import batches
CREATE TABLE public.csv_import_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_type TEXT NOT NULL, -- 'contacts', 'events', 'grants'
  file_name TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  imported_by UUID REFERENCES auth.users(id),
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_rolled_back BOOLEAN NOT NULL DEFAULT false,
  rolled_back_at TIMESTAMP WITH TIME ZONE,
  rolled_back_by UUID REFERENCES auth.users(id)
);

-- Create table to track individual records affected by imports
CREATE TABLE public.csv_import_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id UUID NOT NULL REFERENCES public.csv_import_history(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'contact', 'event', 'grant', 'opportunity'
  entity_id UUID NOT NULL,
  operation TEXT NOT NULL, -- 'created' or 'updated'
  previous_data JSONB, -- For updates, store the previous state for rollback
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_csv_import_records_import_id ON public.csv_import_records(import_id);
CREATE INDEX idx_csv_import_history_imported_by ON public.csv_import_history(imported_by);
CREATE INDEX idx_csv_import_history_import_type ON public.csv_import_history(import_type);

-- Enable RLS
ALTER TABLE public.csv_import_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_import_records ENABLE ROW LEVEL SECURITY;

-- Policies for csv_import_history
CREATE POLICY "Users can view import history"
  ON public.csv_import_history
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert import history"
  ON public.csv_import_history
  FOR INSERT
  WITH CHECK (auth.uid() = imported_by);

CREATE POLICY "Users can update their own imports or admins can update any"
  ON public.csv_import_history
  FOR UPDATE
  USING (
    auth.uid() = imported_by 
    OR public.has_role(auth.uid(), 'admin')
  );

-- Policies for csv_import_records
CREATE POLICY "Users can view import records"
  ON public.csv_import_records
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert import records"
  ON public.csv_import_records
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete import records during rollback"
  ON public.csv_import_records
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));