# Setup & Deployment Notes

## GitHub Pages

The app is deployed at **https://velitchko.github.io/to-link-or-not/**

- GitHub Pages source must be set to **GitHub Actions** (not "Deploy from branch") in repo Settings → Pages
- The deploy workflow uses `actions/upload-pages-artifact` + `actions/deploy-pages` — the upstream revisit workflow uses `peaceiris/actions-gh-pages` (branch-based) which is **incompatible** with the GitHub Actions source mode
- `VITE_BASE_PATH` in `.env` must match the repo name: `/to-link-or-not/`
- The study URL segment comes from the key in `public/global.json` — changed from `to-link-or-not` to `study` to avoid the doubled path `…/to-link-or-not/to-link-or-not/`

## Supabase Authentication

Supabase project: `https://wshlfljqswtrkxlnsfjs.supabase.co`

Authentication uses **GitHub OAuth**. To set it up from scratch:

1. Create a GitHub OAuth App at github.com/settings/developers → OAuth Apps → New:
   - Homepage URL: `https://velitchko.github.io/to-link-or-not/`
   - Authorization callback URL: `https://wshlfljqswtrkxlnsfjs.supabase.co/auth/v1/callback`
2. In Supabase → Authentication → Providers → GitHub: enable and paste in Client ID + Secret
3. In Supabase → Authentication → URL Configuration → Redirect URLs: add `https://velitchko.github.io/to-link-or-not/**`

### Bug fixes applied to SupabaseStorageEngine.ts

Two bugs in the original revisit code affected first-time auth setup. These are patched in commit `4279ab9`:

**Fix 1** — `getUserManagementData` used `.single()` which throws `PGRST116` when the `user-management` row doesn't exist yet (fresh database). Changed to `.maybeSingle()` which returns `null` instead.

**Fix 2** — `upsert` calls in `changeAuth` and `_updateAdminUsersList` had no `onConflict` specified. Without it, Supabase defaults to the auto-increment primary key, so every upsert tries to INSERT instead of UPDATE — causing a `23505` duplicate key violation on the second write. Fixed by adding `{ onConflict: 'studyId,docId' }`.

### Alternative: fix on the Supabase side instead (no code changes)

If you want to pull upstream revisit updates cleanly (without the code patch causing merge conflicts), you can revert commit `4279ab9` and fix the schema instead:

```sql
-- In Supabase SQL Editor:

-- Replace auto-increment PK with composite (studyId, docId) PK
-- so upsert resolves conflicts correctly without needing onConflict in code
ALTER TABLE public.revisit DROP CONSTRAINT "revisit_studyId_docId_key";
ALTER TABLE public.revisit DROP CONSTRAINT revisit_pkey;
ALTER TABLE public.revisit ADD PRIMARY KEY ("studyId", "docId");

-- Pre-insert the user-management row so .single() always finds it
INSERT INTO public.revisit ("studyId", "docId", data)
VALUES ('', 'user-management', '{}')
ON CONFLICT DO NOTHING;
```

Then revert the code patch:
```bash
git revert 4279ab9 --no-edit
git push origin main
```
