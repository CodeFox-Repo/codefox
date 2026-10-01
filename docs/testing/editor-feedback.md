# Editor and deployment feedback

Scope: CF02, CF04, CF05, CF08 (version history), CF09 (preview controls),
CF13 (deployment clipboard), and CF14 from the CodeFox copy audit.

## Behavior

- Project preparation is indeterminate. Neither elapsed time nor a saved
  presentation flag establishes readiness. Navigating to a different chat
  resets its editor/loading state.
- A lost restore response is an unknown outcome. Refresh project files and
  version history before another attempt. A known request rejection preserves
  the current editor/draft and refreshes history separately.
- Failed or malformed history reads show an error and a functioning retry,
  separately from a successfully read empty history.
- Deployment timeouts, lost network responses, and unreadable response bodies
  direct the user to check Vercel deployments before retrying. The client does
  not claim that nothing was deployed and does not automatically deploy again.
- A deployment URL is only marked copied after the clipboard promise resolves.
  Denial or missing clipboard support offers the complete URL in a selectable,
  read-only input. Closing/reopening invalidates a pending copy result.
- The save bar names the actions “Discard changes” and “Save file,” wraps at
  narrow widths, and retains edits plus the save action after a save failure.
- Preview navigation, zoom, refresh, fullscreen and path controls have
  persistent accessible names. This is targeted accessibility coverage, not a
  full screen-reader or WCAG audit.

## Reproduce the automated checks

Use the repository's pinned pnpm 9.1.0 and a completed dependency installation:

```sh
pnpm --dir frontend exec jest --config jest.editor-feedback.config.js --runInBand
pnpm --dir backend exec jest src/project/__tests__/deploy.spec.ts --runInBand
node scripts/check-editor-feedback.mjs
pnpm check
pnpm --dir frontend exec tsc --noEmit
pnpm --dir backend exec tsc --noEmit
pnpm --dir frontend build
pnpm --dir backend build
```

The component tests render the real affected components with explicit offline
fixtures for project context, the Monaco editor, HTTP/Apollo responses and
clipboard results. They do not sign in, run a paid generation, contact Vercel,
or certify production deployment behavior. The backend tests inject `post`
and never transmit a real token.

Tests cover waiting beyond six minutes, cached completion, newer navigation,
no-project responses, preserved failed-save edits, discard, failed/malformed
history plus retry, three uncertain restore outcomes, known rejection,
success, stale history responses, delayed/denied/missing clipboard, reopening,
repeated copy and preview accessible names.

## Verification record

The dependency-free regression was run against the original implementation
and failed, then passed after the fix. The complete source-check runner has
three pre-existing failures on the baseline: `check-lint-feedback.mjs`,
`check-notes-contract.mjs`, and `check-quota-wired.mjs`. This change adds one
passing check and introduces no additional source-check failure.

Final validation on 2026-10-01:

- 24/24 offline frontend component tests passed
- 40/40 backend suites, 280/280 tests passed (including 19 deployment tests)
- Backend production build passed. An earlier frontend production build passed;
  the final repeat after the file-loading guard was blocked during Next output
  cleanup before compilation (see below)
- Focused frontend (including new tests) and backend lint passed with warnings
- Backend standalone TypeScript check passed
- The completed frontend standalone TypeScript check had the same baseline error:
  `src/config/common-path.ts` cannot resolve `fs-extra`/its declarations. The
  existing Next configuration ignores build-time type errors; a passing build
  is not presented as a passing standalone type check
- Source checks: 38/41 passed; the three failures above also fail on baseline

Late-save coverage additionally checks file navigation, newer edits during a
save, chat navigation, background refreshes, and a delayed read of the next
file. Content from one file cannot be edited/saved as a newly selected file
before that file's read completes.

Local browser screenshots are not verified: this environment's cloud browser
blocked localhost. A separate, explicitly mocked before/after fixture harness
was prepared for an isolated repository CI artifact job. It is not included
in this feature change, and no live deployment, account flow, or paid generation
was attempted.

The final repeated frontend build encountered an infrastructure failure in
Next's cleanup of `.next/standalone`: generated workspace symlinks led into the
shared dependency checkout. Required dependency paths subsequently became
unavailable, so further build/type/baseline reruns were stopped. Final 24-case
component tests and focused lint had already passed on the final source. A
clean independent dependency installation is required for the final build
rerun; do not reuse a shared symlinked workspace for standalone-output cleanup.
The last complete component red run on the original implementation had 21
failures out of 23 tests; the final delayed-file-read case was added afterward.
