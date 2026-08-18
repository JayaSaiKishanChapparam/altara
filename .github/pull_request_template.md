## What and why

<!-- What changes, and what problem it solves. Link the issue if there is one. -->

## Checklist

- [ ] **Changeset** — `pnpm changeset`, if this touches a published package's
      behavior or metadata. Skip only for docs, tests, and CI.
- [ ] **Tests** — a render test for a new component, a regression test for a fix.
- [ ] **`pnpm turbo lint typecheck test build`** passes locally.
- [ ] **Story** at `apps/storybook/stories/components/<Component>.stories.tsx`
      for a new component (`Default` + `Playground`).
- [ ] **Accessibility** — `role` and a meaningful `aria-label`; keyboard support
      for anything interactive.
- [ ] **Both themes** — renders under `data-altara-theme="dark"` and `="light"`.

## Sign-off

By submitting this PR I certify the [Developer Certificate of
Origin](https://developercertificate.org/) — see
[CONTRIBUTING.md](../CONTRIBUTING.md#sign-your-work-dco).

- [ ] My commits are signed off (`git commit -s`).
