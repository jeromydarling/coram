-- Add new notification type configs for admin operational alerts
INSERT INTO notification_type_config (event_type, description, admin_only, default_on, enabled)
VALUES 
  ('gmail_quota_warning', 'Gmail daily send quota approaching soft cap (admin/leadership only)', true, true, true),
  ('stale_enrichment_job', 'Enrichment job stuck in leased state >15 min (admin/leadership only)', true, true, true),
  ('search_failure_spike', 'Multiple search run failures detected in 1 hour (admin/leadership only)', true, true, true),
  ('watchlist_budget_exhausted', 'Daily watchlist crawl budget fully consumed (admin/leadership only)', true, true, true),
  ('campaign_delivery_health', 'Campaign finished with high failure rate (admin/leadership only)', true, true, true)
ON CONFLICT (event_type) DO NOTHING;