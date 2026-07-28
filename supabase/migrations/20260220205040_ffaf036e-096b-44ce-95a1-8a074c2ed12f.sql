
-- Phase 8E: Guided Activation Checklist + Operator Impersonation

-- 1) activation_offers — consent + scheduling state per tenant
CREATE TABLE public.activation_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive','purchased','scheduled','completed','canceled')),
  consent_granted boolean NOT NULL DEFAULT false,
  consent_granted_at timestamptz,
  consent_granted_by uuid,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  meeting_link text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.activation_offers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_activation_offers_updated_at
  BEFORE UPDATE ON public.activation_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tenant admins can read/update their own
CREATE POLICY "Tenant users can read own activation_offers"
  ON public.activation_offers FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = activation_offers.tenant_id AND tu.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Tenant users can update own activation_offers"
  ON public.activation_offers FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = activation_offers.tenant_id AND tu.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin can insert activation_offers"
  ON public.activation_offers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete activation_offers"
  ON public.activation_offers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- 2) activation_checklist_templates — global operator-managed templates
CREATE TABLE public.activation_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  items jsonb NOT NULL DEFAULT '[]',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activation_checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_act_templates_updated_at
  BEFORE UPDATE ON public.activation_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone authenticated can read templates"
  ON public.activation_checklist_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin can manage templates"
  ON public.activation_checklist_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- 3) activation_checklists — per-tenant instantiated checklist
CREATE TABLE public.activation_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_keys text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','ready','blocked')),
  readiness_score int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.activation_checklists ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_act_checklists_updated_at
  BEFORE UPDATE ON public.activation_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Tenant users can read own checklist"
  ON public.activation_checklists FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = activation_checklists.tenant_id AND tu.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin can manage checklists"
  ON public.activation_checklists FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Tenant users can update own checklist"
  ON public.activation_checklists FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = activation_checklists.tenant_id AND tu.user_id = auth.uid())
  );


-- 4) activation_checklist_items — normalized items for tracking
CREATE TABLE public.activation_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.activation_checklists(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  category text NOT NULL CHECK (category IN ('access','data','decisions','goals')),
  label text NOT NULL,
  help text,
  required boolean NOT NULL DEFAULT true,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid,
  notes text,
  UNIQUE(checklist_id, item_key)
);

ALTER TABLE public.activation_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can read own checklist items"
  ON public.activation_checklist_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activation_checklists ac
      JOIN public.tenant_users tu ON tu.tenant_id = ac.tenant_id
      WHERE ac.id = activation_checklist_items.checklist_id AND tu.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Tenant users can update own checklist items"
  ON public.activation_checklist_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activation_checklists ac
      JOIN public.tenant_users tu ON tu.tenant_id = ac.tenant_id
      WHERE ac.id = activation_checklist_items.checklist_id AND tu.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin can manage checklist items"
  ON public.activation_checklist_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- 5) Indexes
CREATE INDEX idx_activation_offers_tenant ON public.activation_offers(tenant_id);
CREATE INDEX idx_activation_offers_status ON public.activation_offers(status);
CREATE INDEX idx_activation_checklists_tenant ON public.activation_checklists(tenant_id);
CREATE INDEX idx_activation_checklist_items_checklist ON public.activation_checklist_items(checklist_id);

-- 6) Seed default checklist templates
INSERT INTO public.activation_checklist_templates (key, title, description, items) VALUES
('base', 'Getting Started', 'Essential preparation for every organization', '[
  {"key":"admin_login","label":"Confirm admin login credentials","help":"Make sure you can log in as an administrator.","category":"access","required":true},
  {"key":"top_25_partners","label":"List your 25 most important partners","help":"Think of the organizations you interact with most.","category":"data","required":true},
  {"key":"email_decision","label":"Choose your email provider","help":"Gmail, Outlook, or keep using your current tool?","category":"decisions","required":true},
  {"key":"mission_statement","label":"Draft your mission in one sentence","help":"What does your organization exist to do?","category":"goals","required":false},
  {"key":"first_journey","label":"Identify your first relationship journey","help":"Which partnership story should we begin telling?","category":"goals","required":false}
]'::jsonb),
('gmail', 'Gmail Integration', 'Preparation for connecting Gmail', '[
  {"key":"gmail_admin_access","label":"Google Workspace admin access available","help":"You will need permissions to authorize the connection.","category":"access","required":true},
  {"key":"gmail_contact_groups","label":"Note important Gmail contact groups","help":"Which labels or groups should transfer?","category":"data","required":false}
]'::jsonb),
('outlook', 'Outlook Integration', 'Preparation for connecting Outlook', '[
  {"key":"outlook_admin_access","label":"Microsoft 365 admin access available","help":"You will need permissions to authorize the connection.","category":"access","required":true},
  {"key":"outlook_distribution_lists","label":"Note distribution list names","help":"Which lists should carry over?","category":"data","required":false}
]'::jsonb),
('hubspot', 'HubSpot Migration', 'Preparing to bring data from HubSpot', '[
  {"key":"hubspot_api_key","label":"HubSpot API key or export ready","help":"Admin login for your current CRM, or export permission.","category":"access","required":true},
  {"key":"hubspot_contacts_mapped","label":"Contact fields mapped to CROS","help":"Which custom fields matter most?","category":"data","required":true},
  {"key":"hubspot_deals_decision","label":"Decide which deals to migrate","help":"All, active only, or custom filter?","category":"decisions","required":true}
]'::jsonb),
('salesforce', 'Salesforce Migration', 'Preparing to bring data from Salesforce', '[
  {"key":"sf_export_ready","label":"Salesforce data export ready","help":"Download contacts and accounts as CSV.","category":"access","required":true},
  {"key":"sf_custom_fields","label":"List custom fields to preserve","help":"Which custom fields carry meaning?","category":"data","required":true}
]'::jsonb),
('campaigns', 'Campaigns Add-on', 'Preparation for Relatio Campaigns™', '[
  {"key":"campaigns_mailchimp_decision","label":"Do you want Campaigns enabled, or keep using Mailchimp for now?","help":"We can run both in parallel.","category":"decisions","required":true},
  {"key":"campaigns_templates","label":"Gather 2-3 email templates you love","help":"These will inspire your CROS templates.","category":"data","required":false}
]'::jsonb),
('metros', 'Metros / Civitas™', 'Preparation for geographic community awareness', '[
  {"key":"metros_primary_city","label":"Name your primary metro area","help":"Where does most of your community live?","category":"data","required":true},
  {"key":"metros_secondary","label":"List any secondary metros","help":"Anywhere else you serve or plan to expand?","category":"data","required":false}
]'::jsonb),
('communio', 'Communio Collaboration', 'Preparation for cross-organization sharing', '[
  {"key":"communio_partner_orgs","label":"Identify partner organizations for Communio","help":"Who would you share signals with?","category":"goals","required":false},
  {"key":"communio_sharing_level","label":"Choose your sharing comfort level","help":"Signals only, events, or full collaboration?","category":"decisions","required":true}
]'::jsonb);
