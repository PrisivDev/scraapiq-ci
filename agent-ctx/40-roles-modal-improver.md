# Task 40 — Roles + Modal Improver

## Task
Fix role model (OWNER=super-admin, ADMIN=org admin) + improve modal layout/sizing

## Work Done

### Part 1 — Role model fix
- `src/app/api/auth/register/route.ts` : 3 occurrences `role: "OWNER"` → `role: "ADMIN"` (lines 87, 103, 120) with explanatory comment.
- `src/lib/rbac-nav.ts` : unchanged (db/saas = OWNER, backoffice/security = ADMIN) — already correct.
- New endpoints:
  - `src/app/api/organization/invite/route.ts` (POST invite + GET pending)
  - `src/app/api/organization/members/[id]/route.ts` (PUT role + DELETE member)

### Part 2 — Modal layout/sizing improvements
- `src/components/dashboard/organization-details-dialog.tsx` : full-screen mobile, max-w-5xl desktop, sticky header/footer, KPI grid 6 cols lg, tabs horizontal scrollable mobile, Invite UI in Membres tab (button + sub-dialog with email + role select).
- `src/components/dashboard/views/db-viewer.tsx` : full-screen mobile, sticky header/footer, 2-col layout for editable fields.
- `src/components/dashboard/company-detail-dialog.tsx` : max-w-3xl, sections in Cards, sticky header/footer.
- `src/components/dashboard/new-job-dialog.tsx` : max-w-2xl, full-screen mobile, sticky header/footer.
- `src/components/ui/dialog.tsx` : base DialogContent responsive defaults (p-4 sm:p-6, max-w-[calc(100vw-1rem)]).

### Part 3 — Verification
- `bun run lint` : 0 errors, 0 warnings.
- curl tests:
  - New signup testadmin@test.ci → role: ADMIN ✓
  - admin@prisiv.biz → role: OWNER (preserved) ✓
  - ADMIN invites AGENT → success ✓
  - ADMIN tries to invite ADMIN → 400 ✓
  - OWNER invites ADMIN → success ✓
  - OWNER tries to invite OWNER → 400 ✓
  - PUT member role (AGENT → MANAGER) → success ✓
  - DELETE member → success (revoked) ✓
- Agent Browser end-to-end:
  - Login as admin@prisiv.biz → dashboard ✓
  - Open Organization modal → full-screen mobile, max-w-5xl desktop ✓
  - Membres tab → "Inviter un membre" button visible ✓
  - Click → sub-dialog opens with email + role select (4 options for OWNER) ✓
  - Submit invite → toast + refresh + pending section visible ✓
  - `agent-browser errors` → empty ✓

### Part 4 — Worklog appended to `/home/z/my-project/worklog.md`

## Files Modified
1. `src/app/api/auth/register/route.ts` (3 role changes)
2. `src/app/api/organization/invite/route.ts` (NEW)
3. `src/app/api/organization/members/[id]/route.ts` (NEW)
4. `src/components/dashboard/organization-details-dialog.tsx` (layout + Invite UI)
5. `src/components/dashboard/views/db-viewer.tsx` (dialog layout)
6. `src/components/dashboard/company-detail-dialog.tsx` (sections + sizing)
7. `src/components/dashboard/new-job-dialog.tsx` (sizing + sticky)
8. `src/components/ui/dialog.tsx` (base responsive defaults)

## Files NOT Modified (per rules)
- `.env`
- `prisma/schema.prisma`
- `src/lib/rbac-nav.ts` (already correct)

## Screenshots Saved
- modal-identity-improved.png
- modal-members-with-invite.png
- modal-invite-subdialog.png
- modal-invite-subdialog-manager.png
- modal-members-after-invite.png
- modal-mobile-fullscreen.png
- modal-desktop-layout.png
- modal-new-job.png
- modal-members-fullpage.png
