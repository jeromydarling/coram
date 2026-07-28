-- Phase 27: Add Companion-specific sector tags
INSERT INTO sectors (id, name, category, description, color, is_active) VALUES
  (gen_random_uuid(), 'Mentoring', 'Companion', 'Youth and adult mentoring relationships', '#7C8CF8', true),
  (gen_random_uuid(), 'Recovery Sponsorship', 'Companion', 'Addiction recovery sponsorship and 12-step support', '#A78BFA', true),
  (gen_random_uuid(), 'Spiritual Direction', 'Companion', 'Spiritual direction, pastoral companionship, soul care', '#6EE7B7', true),
  (gen_random_uuid(), 'Personal Care', 'Companion', 'Personal care assistance (PCA), home health, daily living support', '#FCA5A5', true),
  (gen_random_uuid(), 'Volunteer Companionship', 'Companion', 'Friendly visitor programs, companion volunteers, befriending', '#93C5FD', true),
  (gen_random_uuid(), 'Coaching', 'Companion', 'Life coaching, career coaching, executive coaching', '#FBBF24', true),
  (gen_random_uuid(), 'Parish Companionship', 'Companion', 'Parish-based home visits, communion calls, pastoral care teams', '#86EFAC', true),
  (gen_random_uuid(), 'Youth Mentoring', 'Companion', 'Youth-specific mentoring programs, Big Brothers/Big Sisters style', '#F9A8D4', true),
  (gen_random_uuid(), 'Family Caregiving', 'Companion', 'Family caregiving for aging parents, children with special needs', '#FDE68A', true),
  (gen_random_uuid(), 'Elder Companionship', 'Companion', 'Elder care companionship, aging-in-place support, senior visits', '#C4B5FD', true),
  (gen_random_uuid(), 'Addiction Recovery Support', 'Companion', 'Broader addiction recovery support beyond formal sponsorship', '#FCA5A5', true),
  (gen_random_uuid(), 'Reentry Support', 'Companion', 'Post-incarceration reentry mentoring and accompaniment', '#67E8F9', true),
  (gen_random_uuid(), 'Grief Companionship', 'Companion', 'Grief support, bereavement companionship, loss accompaniment', '#D8B4FE', true)
ON CONFLICT DO NOTHING;