# Onboarding UI regression evidence

Run only as repository test automation in disposable CI checkouts. Requires Node 22+, installed repository dependencies, and pinned Playwright Chromium supplied by the CI workflow.

ONBOARDING_COPY_BEFORE_DIR and ONBOARDING_COPY_AFTER_DIR select exact Git checkouts; ONBOARDING_COPY_OUTPUT_DIR selects the artifact folder. Run `node capture-onboarding.mjs`.

The script renders the actual Next app for audited baseline dd33611 and the exact selected fix commit. A local proxy supplies synthetic public GraphQL data, rejects all mutations/API actions, and blocks external browser requests. No account is signed in, no password is entered, and no generation/email request is sent.

Eight screenshots cover desktop hero, empty creation, auth interruption/Close preserving text, and compact composer. Each image visibly labels the synthetic fixture and commit. Metadata records exact SHAs and asserts zero submitted mutations. Screenshots show rendered component behavior, not a live backend or paid provider result. Local CUA blocked localhost, so this script is run independently as an authorized repository CI test, not through an alternate browser-control route.
