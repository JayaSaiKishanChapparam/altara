# Releasing

Publishing is automated with [changesets](https://github.com/changesets/changesets)
via `.github/workflows/release.yml` (runs on every push to `main`).

## Flow

1. A feature PR includes a changeset (`.changeset/*.md`). Merge it to `main`.
2. The Release workflow opens a **"chore: release packages"** PR that bumps
   versions + writes CHANGELOGs and consumes the changeset.
3. **Review that PR's version table**, then merge it.
4. Merging it re-runs the workflow, which now runs `pnpm changeset publish` and
   pushes the new versions to npm + creates git tags.

Nothing publishes until the "chore: release packages" PR is merged.

## npm authentication (read this — it bit us once)

The publish step authenticates with the **`NPM_TOKEN`** GitHub Actions secret:

- **Where it's referenced:** `.github/workflows/release.yml` → the
  `changesets/action@v1` step, `env: NPM_TOKEN: ${{ secrets.NPM_TOKEN }}` (line 30).
- **Where to set it:** GitHub → repo **Settings → Secrets and variables → Actions → `NPM_TOKEN`**.

### Failure signature

A bad/expired/under-scoped token does **not** fail loudly as "auth error" — npm
masks it. On the publish step you'll see, for every package:

```
npm error code E404
npm error 404 Not Found - PUT https://registry.npmjs.org/@altara%2f<pkg>
npm error 404 '@altara/<pkg>@x.y.z' is not in this registry.
```

For a scoped package that already exists, **`E404` on `PUT` = the token is
expired or lacks publish rights** (npm returns 404 to mask a 403). If you see
this: the versions are already bumped in `main` (changeset consumed), nothing
published. Fix the token, then re-run the failed publish job:
`gh run rerun <run-id> --failed` — `changeset publish` republishes any version
not yet on the registry.

### Token recommendation

Use a token that won't silently expire mid-release:

- **Preferred — granular access token** scoped to the `@altara` org/packages with
  **Read and write** for packages. More secure (least privilege). npm caps the
  expiry (max ~1 year), so **record the expiry below** and rotate before it lapses.
- **Simplest — classic "Automation" token.** Non-expiring and bypasses 2FA, but
  broadly scoped to the account. Use only if you accept the wider scope.

Do **not** use a "Publish"/granular token with a short default expiry for CI — that
is what caused the silent `E404` on the 0.1.0 release.

### Current token

> Keep this current whenever the token is rotated.

| Field | Value |
| --- | --- |
| Token type | _(granular access / classic automation)_ |
| Scope | `@altara` packages — read + write |
| Created | _YYYY-MM-DD_ |
| **Expiry** | _YYYY-MM-DD_ (or **none** for a classic automation token) |
| Rotation reminder | Set a calendar reminder ~2 weeks before expiry |

If the expiry is "none", note that here explicitly so future maintainers don't
go hunting for a date that doesn't exist.
