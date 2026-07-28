-- No-op migration to trigger types.ts regeneration
-- All recent tables (restoration_signals, recovery_tickets, providence_signals, 
-- tenant_privacy_settings, public_movement_cache) will be picked up.
SELECT 1;
