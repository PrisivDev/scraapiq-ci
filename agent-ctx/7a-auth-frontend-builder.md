# Task 7a — Auth Frontend Builder

## Work record

Built 7 pages + 5 shared components + 1 header modification for the ScrapIQ CI auth system.

### Files created (12)

**Shared components** (`src/components/auth/`):
- `footer.tsx` — `AuthFooter` sticky footer for auth/account pages
- `auth-layout.tsx` — `AuthLayout` (split-screen 60/40, gradient emerald→teal) + `AccountLayout` (centered, header with brand + "Back to dashboard")
- `password-strength.tsx` — `PasswordStrength` + `evaluatePassword` (length/upper/lower/digit/special)
- `oauth-buttons.tsx` — `OAuthButtons` (Google + Microsoft, SVG inline logos)
- `user-menu.tsx` — `UserMenu` (live /api/me fetch, avatar, links to /account/*, logout) + `LogoutButton`

**Pages** (`src/app/`):
- `auth/login/page.tsx` — login form, OAuth, 401/423/429 handling with countdown, redirect to /auth/verify-2fa on `requiresTwoFactor`, Suspense wrapper
- `auth/register/page.tsx` — register with live password strength, OAuth
- `auth/verify-2fa/page.tsx` — InputOTP 6 slots, backup-code toggle, rate-limit handling
- `auth/setup-2fa/page.tsx` — 3-step wizard (init QR+secret+backup codes → confirm TOTP → success), auth guard, .txt backup codes download
- `account/security/page.tsx` — auth guard, 2FA status + enable/disable dialog, OAuth providers, password change (placeholder), last login info
- `account/sessions/page.tsx` — auth guard, table (desktop) + cards (mobile), revoke single + revoke all (with confirmation)
- `account/permissions/page.tsx` — auth guard, role summary + counters, role hierarchy, grouped permission badges, collapsible role×permission matrix

### Files modified (1)
- `src/components/dashboard/header.tsx` — replaced hardcoded user dropdown with `UserMenu` (live user data + working logout + /account/* links)

### Lint status
- `bun run lint` → 0 errors, 0 warnings ✓

### E2E tests (curl)
- register → 200 (creates user + cookies)
- /api/me with cookies → 200 (full user payload)
- /api/permissions → 200 (all permissions + role hierarchy)
- /api/sessions → 200 (active sessions list)
- /api/twofa/setup init → 200 (secret + QR data URL + backup codes)
- logout → 200 + clears cookies
- /api/me after logout → 401 (token revoked)
- All auth pages return 200 unauthenticated
- All protected pages return 307 → /auth/login when no cookie, 200 with cookie

### Notes for next agents
- Dashboard `/` is intentionally left without client-side auth guard (middleware allows it). UserMenu gracefully degrades to "Mon compte" if /api/me fails.
- Password change form on /account/security is a placeholder (no backend endpoint).
- OAuth "Délier" button is disabled (no unlink endpoint).
- Test user `test7a@example.ci` was created during E2E test (in `db/custom.db`).
