# Isolated editor-feedback screenshot fixtures for CI

Baseline must be exactly `dd33611e3debb0170b801f42370cda55d6c5caa7`; after must
be the editor-feedback feature commit reported by the implementation worker.
Use separate checkouts, the committed lockfile, pnpm 9.1.0, and Node 22.

This harness has **not been run locally**. The cloud browser denied localhost
access in this environment; these files prepare an independent CI artifact job.
The feature branch contains no fixture route/root-layout change.

For each checkout:

1. Install repository dependencies with pnpm 9.1.0.
2. Run `node /path/to/evidence/setup-fixture.mjs /path/to/checkout`.
3. Start `pnpm --dir /path/to/checkout/frontend exec next dev -p PORT`.
4. Install `playwright@1.51.0` in this evidence directory, then run
   `npx playwright install --with-deps chromium`.
5. Run `node capture.mjs http://127.0.0.1:PORT before|after OUTPUT_DIR`.
   Suggested isolated ports: 3203 before, 3103 after.
6. Upload all ten PNGs and both observation JSON files. Inspect image pixels
   before publishing. A completed job is required before calling them verified.

The page imports actual CodeEngine, CodeTab, SaveChangesBar, DeployDialog and
WebPreview. Context, HTTP/Apollo, and clipboard results are explicitly mocked;
all network destinations other than the local fixture origin are denied and
counted. No credentials, sign-in, paid generation or deployment is used.
The fake clipboard rejection has a no-op rejection observer to suppress only
the development overlay; it remains rejected for the component's await.
Monaco's script origin is changed to a local nonexistent fixture route so it
cannot fetch the external editor; the history panel itself remains real.
The app layout is temporarily simplified to avoid external font fetching.

Assertions cover before/after indeterminate loading, failed-history treatment
and after retry, actual 320px save-bar layout, falsely optimistic baseline
copy versus selectable recovery after rejection, and preview accessible names.
Backend outcome uncertainty and save/restore request timing are covered by the
committed unit/component tests, not represented as real provider behavior.
