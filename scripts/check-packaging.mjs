/**
 * Runs `publint` and `@arethetypeswrong/cli` over every published package.
 *
 * Both tools inspect the *packed tarball*, not `src/`, so this has to run after
 * a build. CI wires it in after `turbo build`.
 *
 * Why a script rather than two lines of YAML: publint and attw each exit
 * non-zero on the first package that fails, which means a run tells you about
 * one problem at a time. Six packages with the same mistake then take six
 * round-trips to find. This runs all twelve checks, prints every failure, and
 * exits non-zero once at the end.
 *
 * Usage: `node scripts/check-packaging.mjs`
 */
import { execFileSync } from 'node:child_process';

const PACKAGES = ['core', 'aerospace', 'av', 'industrial', 'ros', 'mqtt'];

/**
 * attw's `NoResolution` on a CSS subpath is expected and not actionable:
 * `@altara/core/styles.css` maps to a stylesheet, which has no type
 * declarations to resolve and never will. Everything else must pass.
 */
const ATTW_IGNORE_RULES = ['no-resolution'];

let failed = false;

const run = (cmd, args) => {
  try {
    return { ok: true, out: execFileSync(cmd, args, { encoding: 'utf8', stdio: 'pipe' }) };
  } catch (err) {
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
};

for (const name of PACKAGES) {
  const dir = `packages/${name}`;

  const lint = run('pnpm', ['exec', 'publint', dir]);
  if (!lint.ok) {
    failed = true;
    console.error(`\n--- publint: @altara/${name} ---\n${lint.out}`);
  }

  const types = run('pnpm', [
    'exec',
    'attw',
    '--pack',
    dir,
    '--ignore-rules',
    ...ATTW_IGNORE_RULES,
  ]);
  if (!types.ok) {
    failed = true;
    console.error(`\n--- attw: @altara/${name} ---\n${types.out}`);
  }

  if (lint.ok && types.ok) console.log(`ok  @altara/${name}`);
}

if (failed) {
  console.error('\nPackaging checks failed.');
  process.exit(1);
}

console.log(`\n${PACKAGES.length} packages clean (publint + attw).`);
