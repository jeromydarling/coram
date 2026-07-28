# POST-IMPLEMENTATION CHECKLIST

> **This checklist MUST be executed after EVERY feature, fix, or architectural change.**
> Do NOT ask the user — just do it.

---

## 1. Testing

- [ ] Run Deno tests (`supabase--test-edge-functions`) for all affected edge functions
- [ ] If a new edge function was created, write tests first
- [ ] Verify build output has no new errors

## 2. Changelog (Help Page)

- [ ] Add entry to `src/pages/Help.tsx` changelog section
- [ ] Include date, type (feature/fix/improvement), title, and bullet list of changes
- [ ] Use human-readable, non-technical language

## 3. Technical Documentation PDF

- [ ] Update `src/content/technicalDocumentation.ts` if the change introduces:
  - New database tables or columns
  - New edge functions
  - New modules or architectural patterns
  - New integrations or AI capabilities
- [ ] Maintain chapter numbering integrity

## 4. Gardener Manuals & Field Guide (`src/lib/manualData.ts`)

- [ ] **Routes**: Add any new routes to `ROUTE_INVENTORY`
- [ ] **Roles**: Update `ROLE_MATRIX` if access patterns changed
- [ ] **Modules**: Add new modules to `MODULE_ANATOMY`
- [ ] **Workflows**: Add new user flows to `CORE_WORKFLOWS`
- [ ] **Sidebar**: Update `SIDEBAR_STRUCTURE` if navigation changed
- [ ] **Signals**: Add new NRI/Testimonium signals to `SIGNAL_TYPES`
- [ ] **Nexus Workflows**: Add new Gardener workflows to `NEXUS_WORKFLOWS`

## 5. App Sections Registry (`src/lib/appSections.ts`)

- [ ] Add any new user-facing sections to `APP_SECTIONS`
- [ ] Include correct `navGroup`, `visibleTo`, and `requiredFeature` values

## 6. Gardener How-To / HowTo Page

- [ ] Check if the change requires updates to `GardenerHowToPage.tsx`
- [ ] Check if admin-facing How-To (`AdminHowTo`) needs updates

## 7. Marketing & Public Pages

- [ ] Check if landing page, pricing, or feature pages need updates
- [ ] Check if SEO metadata needs updating for new pages

---

## When to skip

- Pure refactors with no user-facing or architectural impact
- Dependency updates with no API changes
- Typo fixes in non-documentation files

---

*This file exists as a permanent reference artifact. It is referenced in the project's custom knowledge base.*
