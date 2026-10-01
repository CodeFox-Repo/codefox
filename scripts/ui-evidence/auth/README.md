# Auth copy UI evidence

The capture script starts the actual Next frontends from two checkouts, with synthetic GraphQL responses and all external browser requests blocked. It captures signup requirements and unavailable password-reset email before and after. It never submits registration, login, email, payment, or generation mutations.

Prerequisites: Node 20+, repository dependencies installed from pnpm-lock.yaml with pnpm 9.1.0; Playwright plus Chromium available to this script. Make the original base commit dd33611e3debb0170b801f42370cda55d6c5caa7 and the auth fix commit available as separate checkouts. Install each checkout independently; never symlink node_modules between source trees.

Run:

AUTH_COPY_BEFORE_DIR=/absolute/base AUTH_COPY_AFTER_DIR=/absolute/fix AUTH_COPY_OUTPUT_DIR=/absolute/artifacts node capture.mjs

Ports: browser fixtures 3204 (before) and 3104 (after); internal Next servers 3206 and 3106. Fixture responses are local only. Both contexts block requests to any other origin. Entered strings are synthetic example.test addresses and a dummy password, with no submissions.

Output: four PNGs plus metadata.json recording exact checkout SHAs, fixture state, viewport, and that no mutations were submitted. These are fixture-state screenshots, not production sign-in or email-delivery validation.
