# Copy-audit UI evidence (CI only)

This infrastructure is deliberately separate from the feature changes. The
workflow runs on pushes to `test/copy-audit-ui-evidence`, so it can collect
review evidence before any workflow is merged into the default branch.

Each matrix job checks out the exact audited baseline and one exact published
feature commit, installs their locked dependencies independently, then starts
actual Next/React components with deterministic local fixture responses. Only
pnpm's download cache is shared. Never symlink dependencies or build output
between source trees: Next's output tracing can follow those links during
cleanup.

The runner verifies both source SHAs and writes them together with its own
harness SHA and the fixture limitations into `run.json`. Images visibly label
their fixture scope and source commit. Application copy is never replaced by
the capture scripts. The editor harness adds a disposable route importing the
real components and an offline layout; that override is recorded explicitly.

All browser network requests outside the local fixture endpoints are blocked
(or, for the decorative GitHub star counter, answered with a fixed local
response). All identities, strings and tokens are synthetic. Auth/onboarding
assert zero submitted mutations. Project actions and deployment use local
mock outcomes, not live services. These captures do not validate production
accounts, emails, paid generation, persistence, deployment or real clipboard
permission handling.

The workflow uses read-only repository permissions and no secrets. It pins the
browser tooling, fails on assertions, retains raw PNGs/text observations and
logs for seven days, and uploads artifacts even if a scenario fails. Failure
captures and metadata help diagnose incomplete runs. Inspect the pixels before
calling the result visually verified.

The harnesses have syntax/YAML validation locally; browser execution is owned
by the isolated repository CI jobs. Do not use these scripts as an alternate
route around a denied local browser connection.
