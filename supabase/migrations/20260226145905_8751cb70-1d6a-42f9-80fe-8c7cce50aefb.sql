-- Enable realtime on tenant_users and profiles so we can detect removals and role changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;