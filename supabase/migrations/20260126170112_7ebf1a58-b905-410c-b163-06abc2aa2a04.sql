-- Add quarterly_target column to metros table
ALTER TABLE public.metros 
ADD COLUMN quarterly_target integer DEFAULT 500;

-- Add comment for clarity
COMMENT ON COLUMN public.metros.quarterly_target IS 'Quarterly device volume target for this metro';