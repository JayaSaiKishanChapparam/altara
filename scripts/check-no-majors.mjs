/**
 * Fails if a release would publish a major version nobody asked for.
 *
 * Release PR #32 bumped five satellites to 1.0.0. Nothing in those packages had
 * changed: `@altara/core` took a minor, 0.2.3 → 0.3.0, which left their
 * `^0.2.0` peer range, and changesets turns a peer dependency leaving range into
 * a major on the dependent — `onlyUpdatePeerDependentsWhenOutOfRange` only
 * suppresses the cascade while the new version is still *in* range. The release
 * PR was merged without anyone reading the version table. Publishing failed for
 * an unrelated reason (an expired token), which is the only reason npm didn't
 * get five accidental 1.0.0s.
 *
 * Two checks, because the bad state exists in two places over a release's life:
 *
 *   1. The pending plan. While changesets are unconsumed, ask changesets what it
 *      would do and reject any `major`. Catches it on the feature PR, before a
 *      release PR is ever opened.
 *   2. The versioned packages. Once a release PR consumes the changesets the plan
 *      is empty, so compare each public package's version against npm `latest`
 *      and reject a major-number increase. Catches it on the release PR, and
 *      again right before `changeset publish`.
 *
 * An intentional major is allowed by naming the package in `ALLOW_MAJOR`
 * (comma-separated), e.g. `ALLOW_MAJOR=@altara/core`.
 *
 * Usage: `node scripts/check-no-majors.mjs`
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import getReleasePlanModule from '@changesets/get-release-plan';

const getReleasePlan = getReleasePlanModule.default ?? getReleasePlanModule;

const allowed = new Set(
  (process.env.ALLOW_MAJOR ?? '').split(',').map((s) => s.trim()).filter(Boolean),
);
const failures = [];

// 1. Pending changesets.
const plan = await getReleasePlan(process.cwd());
for (const r of plan.releases) {
  if (r.type === 'major' && !allowed.has(r.name)) {
    failures.push(`${r.name}: pending changesets plan a major, ${r.oldVersion} → ${r.newVersion}`);
  }
}

// 2. Versions already written to package.json, against what npm has.
const major = (v) => Number(v.split('.')[0]);
for (const dir of readdirSync('packages')) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(`packages/${dir}/package.json`, 'utf8'));
  } catch {
    continue;
  }
  if (pkg.private || allowed.has(pkg.name)) continue;
  let published;
  try {
    published = execFileSync('npm', ['view', pkg.name, 'version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    console.log(`  ${pkg.name}: not on npm yet, skipped`);
    continue;
  }
  if (major(pkg.version) > major(published)) {
    failures.push(`${pkg.name}: package.json is ${pkg.version}, npm latest is ${published}`);
  }
}

if (failures.length) {
  console.error('\nUnapproved major version bumps:\n');
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(
    '\nIf a peer range caused this, widen the range rather than shipping the major.' +
      '\nIf the major is intentional, rerun with ALLOW_MAJOR=<package>[,<package>].\n',
  );
  process.exit(1);
}
console.log('No unapproved major bumps.');
