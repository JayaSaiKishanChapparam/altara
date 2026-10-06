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

GitHub does **not** run CI on the release PR: changesets pushes it with
`GITHUB_TOKEN`, and pushes made with that token don't trigger workflows. The
check that protects the publish is the one in the Release workflow that runs on
merge (`scripts/check-no-majors.mjs`, before `changeset publish`). No check runs
on the release PR itself, so reading its version table in step 3 is the only review.

## npm authentication (read this — it bit us once)

The publish step authenticates with the **`NPM_TOKEN`** GitHub Actions secret:

- **Where it's referenced:** `.github/workflows/release.yml` → the
  `changesets/action@v1` step, `env: NPM_TOKEN: ${{ secrets.NPM_TOKEN }}` (line 34).
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
  **Read and write** for packages **and "Bypass two-factor authentication" ticked**.
  Without the bypass box, publishing fails with `EOTP` (see
  [Release failure signatures](#release-failure-signatures)). More secure (least
  privilege). npm caps the expiry (max ~1 year), so **record the expiry below**
  and rotate before it lapses.
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

## Release failure signatures

Both of these come from 2026-10-06. Each was configuration that looked fine
until a release actually exercised it.

### Release PR bumps the satellites to 1.0.0 (unexpected major)

**What happened.** Release PR #32 bumped `aerospace`, `av`, `industrial`,
`mqtt` and `ros` from 0.1.x to **1.0.0**, though none of them had changed.
`@altara/core` had taken a minor, 0.2.3 → 0.3.0 (#31). The PR was merged
without anyone reading its version table. Publishing then failed for an
unrelated reason (the expired token, `E404` above), and that's the only reason
npm didn't get five accidental majors. It was unwound in #33.

**Cause.** A caret range on 0.x covers only the current minor: `^0.2.0`
means `>=0.2.0 <0.3.0`. A core **minor** therefore moves core _out of_ the
satellites' peer range. Changesets treats a peer dependency leaving its range
as a breaking change for the package that depends on it, and promotes that
package to a **major**. `onlyUpdatePeerDependentsWhenOutOfRange` (in
`.changeset/config.json`) does **not** prevent this. It only suppresses the
cascade while the new version is still _in_ range (`shouldBumpMajor` in
`@changesets/assemble-release-plan`). The earlier core minor (0.1 → 0.2)
avoided this only because the peer ranges were widened by hand first; #31
skipped that step.

**Guard.** `scripts/check-no-majors.mjs` runs in CI on feature PRs and in the
Release workflow before `changeset publish`. It fails if either:

- the pending changesets plan any major, or
- any public package's `package.json` major version is ahead of npm `latest`.

The second check is the one that would have stopped #32, since by then the
changesets were already used up. For a deliberate major, set
`ALLOW_MAJOR=<pkg>[,<pkg>]`.

**Current mitigation.** The satellites declare `"@altara/core": ">=0.2.0 <1.0.0"`,
so core 0.x minors stay in range and don't cascade. **Tradeoff:** a peer warning
will no longer flag a breaking core 0.x change. If you make a deliberately
breaking core change, update the satellites' peer ranges by hand in the same PR.

### `EOTP` ("requires a one-time password") on publish, even with a fresh token

**What happened.** After the expired token was replaced, every package failed
to publish with:

```
npm error code EOTP
npm error This operation requires a one-time password from your authenticator.
```

A second new token failed the same way. Note the difference from the `E404`
signature above: `E404` means the token is expired or lacks publish rights,
while `EOTP` means the token is valid but npm still wants a 2FA code, which
CI cannot supply. Publishing worked once both of the settings below were fixed.

**Two independent causes. Check both:**

1. **Token type.** It must be a **granular access token** with **Read and
   write** on the `@altara` scope **and "Bypass two-factor authentication"
   enabled**. A classic "Publish" token, or a granular token without the bypass
   box ticked, fails with `EOTP`.
2. **Package setting.** On npmjs.com, open each `@altara/*` package →
   **Settings → Publishing access**. "Require two-factor authentication and
   disallow tokens" makes **every** token fail, whatever its type. It must be
   "Require two-factor authentication or a granular access token with bypass
   2fa enabled".

The second setting is **per package** and can change without any release
noticing. Both were fixed together on 2026-10-06, so we don't know which one
was actually wrong. Check every package, not just one.

**On `EOTP`:** nothing was published. The versions are already on `main` and
were reviewed in the release PR. Fix the npm side, then rerun the **same**
failed Release run: `gh run rerun <run-id>`. That retries only the publish, from
the reviewed `main`. Don't push to `main` to "retry", and don't re-version.
**Stop after two failed attempts.** A rerun can't change the token or the
package settings, so a second failure means the cause is still on the npm side.

**After publishing, allow for propagation lag.** On 2026-10-06 the registry
took up to ~5 minutes to show a new version as `latest`. The tarball URL
returned 404 for about a minute after the metadata already listed the version.
Poll before concluding a publish half-failed.
