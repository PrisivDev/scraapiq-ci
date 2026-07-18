# Task 38 — Profile + DB Editor Builder

Work records for task 38 (make profile management + DB editing functional for OWNER).

## Files created

- `src/app/api/me/route.ts` — added `PUT` handler alongside existing `GET`
- `src/app/api/organization/route.ts` — new file, `GET` + `PUT` (OWNER/ADMIN only)
- `src/app/api/admin/db/[table]/route.ts` — new, `GET` (paginated list) + `POST` (create), OWNER only
- `src/app/api/admin/db/[table]/[id]/route.ts` — new, `GET` + `PUT` + `DELETE`, OWNER only
- `src/lib/db-admin.ts` — new, shared helpers (whitelist, blocked fields, sanitize, DMMF column lookup, type coercion)

## Files modified

- `src/components/dashboard/views/settings-view.tsx` — fully rewrote the Profile card + added an Organisation card; profile now fetches `/api/me` on mount and saves via `PUT /api/me`; organisation card fetches `/api/organization` and saves via `PUT /api/organization` (visible only for OWNER/ADMIN)
- `src/components/dashboard/views/db-viewer.tsx` — added an edit-mode switch, paginated rows view (`/api/admin/db/[table]`), edit/create Dialog (`PUT`/`POST`), delete AlertDialog (`DELETE`) with confirmation, capture-table-on-dialog-open to avoid stale-closure races
- `src/lib/auth/audit.ts` — added 5 new AuditAction values: `user_profile_update`, `org_update`, `db_record_create`, `db_record_update`, `db_record_delete`; added `"admin"` AuditCategory

## API endpoints created

| Method | Path | Description |
| --- | --- | --- |
| PUT | `/api/me` | Update own profile (name, email, locale, timezone, avatarUrl). Email uniqueness check (409 if taken). Logs `user_profile_update` to AuditLog. |
| GET | `/api/organization` | Returns the current user's organization + workspace + role. |
| PUT | `/api/organization` | Update org name (OWNER/ADMIN only). Regenerates unique slug. Logs `org_update` to AuditLog. |
| GET | `/api/admin/db/[table]?page=1&limit=20` | Paginated list + columns (from Prisma DMMF, works even on empty tables) + total count. OWNER only. |
| POST | `/api/admin/db/[table]` | Create a new record. Strips BLOCKED_FIELDS (passwordHash, twoFactorSecret, etc.) and AUTO_FIELDS (id, createdAt, updatedAt, etc.). Logs `db_record_create` to AuditLog. |
| GET | `/api/admin/db/[table]/[id]` | Fetch single record by id. OWNER only. |
| PUT | `/api/admin/db/[table]/[id]` | Partial update (only provided fields). Same field stripping as POST. Logs `db_record_update`. |
| DELETE | `/api/admin/db/[table]/[id]` | Delete by id. Self-deletion blocked (can't delete own user row). Logs `db_record_delete` with full snapshot for traceability. |

## Security guarantees

- All `/api/admin/db/[table]*` routes require OWNER role (401 if unauthenticated, 403 if not OWNER).
- Table name validated against a 23-table whitelist (`ALLOWED_TABLES` in `src/lib/db-admin.ts`) — no SQL injection via dynamic table name.
- BLOCKED_FIELDS stripped from every write: `passwordHash`, `twoFactorSecret`, `twoFactorBackupCodes`, `refreshTokenHash`, `tokenHash`, `secret`, `hashedKey`, `keyHash`, `accessToken`, `refreshToken`. Verified end-to-end: PUT `/api/admin/db/user/{id}` with `{"passwordHash":"hacked","name":"Try Hack"}` → `passwordHash` stripped (server logs `[admin/db/user/{id}] PUT stripped blocked fields: [ 'passwordHash' ]`), only `name` applied.
- AUTO_FIELDS also stripped: `id`, `createdAt`, `updatedAt`, `lastSeenAt`, `usedAt`, `revokedAt`, `expiresAt` — server-managed, not user-settable.
- Self-deletion blocked: DELETE `/api/admin/db/user/{selfId}` → 400 `"Vous ne pouvez pas supprimer votre propre compte via le DB editor"`.
- All mutations log to AuditLog with full context (table, recordId, fields changed, snapshot for deletes).

## Verification results

### Profile form (settings-view.tsx)
- ✅ Form fetches `/api/me` on mount and populates name="Admin Prod", email="admin@scraapiq.ci", locale="fr", timezone="Africa/Abidjan" (NOT hardcoded "Adama Koné"/"adama@agribusiness.ci").
- ✅ Inputs are controlled (useState for each field, onChange updates state).
- ✅ "Enregistrer" button calls `PUT /api/me` with current field values.
- ✅ Button shows spinner (`Loader2 animate-spin`) + "Enregistrement…" while saving; disabled.
- ✅ Toast "Profil mis à jour" on success.
- ✅ Persistence verified: edited name to "Admin Prod Modifié", saved, reloaded page → name still "Admin Prod Modifié" (loaded from DB).
- ✅ Organisation card visible for OWNER (shows org name, slug, plan); editing name + save regenerates slug.

### DB Viewer (db-viewer.tsx)
- ✅ "Mode édition" Switch toggles edit mode.
- ✅ Edit mode shows paginated rows (20/page) from `/api/admin/db/[table]?page=1&limit=20`.
- ✅ "Nouveau" button + "Créer le premier enregistrement" link both open the create dialog with all columns (even for empty tables — uses Prisma DMMF).
- ✅ Create dialog: filled name/sector/commune/city → clicked Enregistrer → toast "Enregistrement créé" → row appeared in list (table badge updated from "0" to "1").
- ✅ Row click → edit dialog opens with all fields populated; sensitive fields show disabled with lock icon; dates show as disabled read-only text.
- ✅ Edit dialog: changed name + rating → clicked Enregistrer → toast "Enregistrement mis à jour" → row updated.
- ✅ Delete: click trash icon → AlertDialog "Supprimer cet enregistrement ?" → click "Supprimer" → toast "Enregistrement supprimé" → row removed.
- ✅ Sensitive fields (passwordHash, etc.) shown as disabled with lock icon in dialog; never editable.
- ✅ Boolean fields use Select dropdown (true/false); date fields disabled.
- ✅ AuditLog confirms all 5 mutation types are logged (db_record_create, db_record_update, db_record_delete, user_profile_update, org_update).

### Lint
- ✅ `bun run lint` → 0 errors, 0 warnings.

### Agent Browser errors
- ✅ `agent-browser errors` → empty (no page errors, no console errors).

### Screenshots
- ✅ `/home/z/my-project/profile-edit.png` (122 KB) — profile form filled with real data (Admin Prod, admin@scraapiq.ci, organisation card visible).
- ✅ `/home/z/my-project/db-edit-dialog.png` (107 KB) — edit dialog open with all company fields populated, sensitive + date fields disabled.
