# Project-action UI evidence harness

This is a CI test harness for the actual CodeFox Next/React/Radix UI. It serves deterministic local GraphQL and preview fixtures. It must not point to a real backend or production account. The token returned by the fixture is a literal non-credential, and all browser requests outside localhost are blocked (the decorative GitHub star request receives a fixed local response).

The capture script is intended for an isolated repository CI Chromium test job, not to bypass local CUA/browser restrictions. It has passed Node syntax validation; no successful browser run has yet been claimed.

## Inputs

- Before: exact source commit `dd33611e3debb0170b801f42370cda55d6c5caa7`
- After: the project-feedback branch commit (local implementation `b770da3cf9dbaf212a504565fe612f80be35c83a`, tree `e52622fb5502e3522f2103870a31a0e83d746397`; use the verified published equivalent if its commit ID differs)
- Both checkouts must have dependencies installed with the repository-pinned pnpm 9.1.0
- Chromium/Chrome: set `CHROME_PATH` to its executable; default `/usr/bin/google-chrome`
- The capture script resolves the repository's existing backend `puppeteer` dependency. No extra JS test dependency is needed

## Run sequentially for before / after

Use a normal CI job shell, with the harness directory, fixture server, and frontend on the same runner. Start the fixture once; the capture script changes only its deterministic state file between scenarios.

```bash
export EVIDENCE_DIR="$PWD/project-feedback-evidence"
printf '{"scenario":"normal","isPublic":false}' > "$EVIDENCE_DIR/fixture-state.json"
node "$EVIDENCE_DIR/fixture-server.mjs" > "$EVIDENCE_DIR/fixture-server.log" 2>&1 &
FIXTURE_PID=$!

# Substitute the actual checkout and before/after mode for each run.
export REPO="$PWD/codefox-after"
export MODE=after
(
  cd "$REPO/frontend"
  NEXT_TELEMETRY_DISABLED=1 \
  NEXT_PUBLIC_GRAPHQL_URL=http://localhost:3116/graphql \
  NEXT_PUBLIC_BACKEND_URL=http://localhost:3116 \
  NEXT_PUBLIC_DEV_EMAIL=fixture@example.test \
  NEXT_PUBLIC_DEV_PASSWORD=fixture-only \
  node node_modules/next/dist/bin/next dev -p 3102
) > "$EVIDENCE_DIR/$MODE-next.log" 2>&1 &
NEXT_PID=$!
trap 'kill "$NEXT_PID" "$FIXTURE_PID" 2>/dev/null || true' EXIT

# Readiness check is server-only, no browser control.
for attempt in $(seq 1 120); do
  if curl --fail --silent http://localhost:3102/ >/dev/null; then break; fi
  sleep 2
done

node "$EVIDENCE_DIR/capture-project-feedback.mjs" \
  --repo "$REPO" --url http://localhost:3102 --mode "$MODE" \
  --out "$EVIDENCE_DIR/$MODE"
```

Stop the first Next process before starting the second checkout on the same port, or use a separate port and `--url`. Run captures sequentially because the fixture state file is shared. Keep both source checkouts otherwise unchanged. The fixture port can be configured via `CODEFOX_FIXTURE_PORT` and should match the frontend environment.

## Assertions and output

Each run writes eight raw PNG screenshots, matching visible-text snapshots, and `capture.json` with the exact checkout SHA. Each image has an explicit local-fixture/evidence caption, while the rendered UI comes from the real application source.

- Rename chat vs rename project scope
- Duplicate failure (generic recovery vs erroneous deletion toast)
- Duplicate success (one correct toast vs erroneous deletion toast)
- Query failures (error/retry vs false empty state), plus after-state recovery checks
- Clear-history confirmation vs baseline immediate clear
- Clear failure remains retryable; Cancel/Escape submit no mutation
- Desktop visibility label
- Compact visibility label and current-state description

The request log counts clear-history mutations to validate Cancel/Escape behavior. The script stops on assertion failure or uncaught page errors. Upload the complete evidence directory and logs even on failure. Inspect resulting PNGs before treating the capture as visual verification.

## Limits

This proves the actual frontend against controlled boundary responses. It does not prove live account access, backend persistence, model generation, production deployment, third-party clipboard permissions, or visibility of previously created copies. Component Jest tests cover deferred/rejected/unavailable clipboard and same-tick repeated actions.
