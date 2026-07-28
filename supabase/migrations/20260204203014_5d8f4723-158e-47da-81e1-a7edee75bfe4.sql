-- Part 1: Add warehouse_manager to existing app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'warehouse_manager';

-- Create email_campaign_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_campaign_status') THEN
    CREATE TYPE email_campaign_status AS ENUM (
      'draft', 'syncing', 'scheduled', 'sending', 'sent', 'failed', 'canceled'
    );
  END IF;
END$$;