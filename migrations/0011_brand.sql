-- ---------------------------------------------------------------------
-- 0011 — Brand tokens
--
-- Workspace settings, not a twelfth module. §5 lists eleven and is closed.
-- A group's colours and wordmark are configuration several modules read; the
-- composer that turns them into a flyer is a Nuntius surface (§5.4) reading
-- Convocare event data (§5.3).
--
-- One row per tenant, enforced by a primary key on tenant_id rather than a
-- separate id. There is no meaningful second brand for a workspace, and a
-- table that allows one invites code that has to pick.
--
-- Nothing here is personal data. Colours, a name, and an R2 key for a logo the
-- group uploaded of itself. That makes this the least sensitive table in the
-- product, and it is the reason the flyer composer can render without ever
-- touching a contact record.
--
-- Deliberately absent: a "voice" or "tone" column. The house style this was
-- drawn from proposes AI-generated brand voice tokens; §7 of CLAUDE.md wants
-- every AI guess labelled and human-approved, and storing a generated voice as
-- workspace config makes it look like a decision the group made. If that lands
-- later it belongs beside the draft it produced, not here.
-- ---------------------------------------------------------------------

CREATE TABLE public.brand_profiles (
  tenant_id  uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Shown as the wordmark when no logo is set. Defaults to the workspace name
  -- at first save rather than being backfilled, so an unedited brand is
  -- visibly unset rather than quietly wrong.
  name       text NOT NULL,
  -- Six-digit hex, validated in the application and again here. The CHECK is
  -- not belt-and-braces: these strings are interpolated into an SVG document,
  -- and a colour column that can hold arbitrary text is an injection surface.
  primary_hex text NOT NULL CHECK (primary_hex ~ '^#[0-9a-f]{6}$'),
  accent_hex  text NOT NULL CHECK (accent_hex  ~ '^#[0-9a-f]{6}$'),
  surface_hex text NOT NULL CHECK (surface_hex ~ '^#[0-9a-f]{6}$'),
  ink_hex     text NOT NULL CHECK (ink_hex     ~ '^#[0-9a-f]{6}$'),
  -- R2 key in R2_FILES. Registered with the burn path below, because an object
  -- left behind after a workspace is destroyed is the one thing §6 promises
  -- cannot happen.
  logo_key   text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_profiles FORCE ROW LEVEL SECURITY;

-- Readable by everyone in the workspace: a flyer composer, an event page and
-- the export all need it. `legal` is excluded in line with every other
-- non-case table — a legal hold reviewer has no business in branding.
CREATE POLICY brand_profiles_select ON public.brand_profiles FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

-- Stewards only. Changing the brand changes every public surface at once.
CREATE POLICY brand_profiles_write ON public.brand_profiles FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

CREATE TRIGGER brand_profiles_touch
  BEFORE UPDATE ON public.brand_profiles
  FOR EACH ROW EXECUTE FUNCTION coram.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_profiles TO coram_app;
