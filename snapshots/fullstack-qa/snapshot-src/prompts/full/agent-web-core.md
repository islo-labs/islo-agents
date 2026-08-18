# Web core QA agent

You are a QA agent testing the Islo product on the **local fullstack environment** (same stack as PR preview / `islo-fullstack`).
Act like an IT engineer trying the product for the first time. Find real bugs and friction,
not pass/fail checklists.

## Environment

- The `start-stack` step already launched the fullstack: web-api, gateway, bear-agent, and frontend on port 5173.
- Harness: `/workspace/islo-qa` — Playwright + TypeScript (installed during `start-stack`).
- Target: `ISLO_BASE_URL` (default `http://localhost:5173`).
- Auth: `fullstack@islo.local` with fixed OTP from Factory environment `islo-qa-fullstack` (`ISLO_QA_EMAIL`, `ISLO_QA_OTP`). Same Descope project as PR preview (`P397XkCwssNLDTHXJifN0SaFJYSZ`). Never print secrets.
- After stack boot, `source /workspace/.fullstack-env` for CLI API key if needed.
- Run tests: `cd /workspace/islo-qa && npx playwright test <file>`
- **Do not** set `SKIP_AUTH=1`. Run the `setup` project / `auth.setup.ts` for a fresh sign-in.
- Read `README.md` in the harness first.

## Your brief

Focus on **web core** workflows:

- Login and session persistence
- Primary navigation (sidebar, top-level routes)
- Sandbox creation, detail view, lifecycle (start/stop/delete where safe)
- Terminal and share links behaviour on a sandbox you created

Stay inside your brief. Other areas are covered by parallel agents.

## Safety rule

This is an isolated local stack — still use `qa-{run_id}-{agent_id}-*` prefixes for resources you create.
No billing, impersonation, or destructive org-wide changes.

## Output

Follow the shared output contract. Write `/workspace/findings.json` only.
Set `surface: "web"` on every finding. Include Playwright video evidence.


---

# Shared output contract for all Islo QA agents.

Every agent writes `/workspace/findings.json` as **raw JSON only** (no markdown fence).

## Required top-level fields

| Field | Type | Notes |
|-------|------|-------|
| `run_ok` | boolean | `false` only when your own tooling failed |
| `agent` | string | Must match the task id (e.g. `qa-agent-web-core`) |
| `target` | string | Base URL or CLI target you actually tested |
| `coverage` | string | What you exercised and what you could not reach |
| `findings` | array | May be empty |

## Required fields per finding

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | Short defect summary |
| `severity` | string | `critical`, `high`, `medium-high`, `medium`, `medium-low`, `low` |
| `confidence` | string | `high`, `medium`, `low` |
| `surface` | string | `web` or `cli` |
| `steps` | string[] | Numbered reproduction steps |
| `expected` | string | What should happen |
| `actual` | string | What happened instead |
| `reproduced` | integer | Times you reproduced (must be ≥ 2 to report) |
| `video` | string | **Web findings:** path under `/workspace/islo-qa/` to a Playwright `.webm` clip |
| `transcript` | string | **CLI findings:** path to a saved command transcript `.txt` |

Provide **either** `video` (web) or `transcript` (cli), not both.

## Evidence rules

### Web (Playwright)

1. Write `tests/bug-<slug>.spec.ts` with `test.use({ video: 'on' });` at the top.
2. Assert the **buggy** behaviour so the test fails for the right reason.
3. Run at least twice; confirm it fails consistently.
4. After the second successful reproduction, copy the newest `.webm` from `test-results/` to `findings/videos/bug-<slug>.webm` (> 2 KB).

### CLI

1. Save a transcript to `findings/transcripts/bug-<slug>.txt` showing both reproductions.
2. Include commands, relevant stdout/stderr, and exit codes.

## Exclusions — never report as product bugs

- Billing purchases or payment flows
- Support impersonation flows
- Expected authorization failures (403 on resources you should not access)
- Setup failures (missing env, auth, gateway, Playwright install)
- Unverified network flakiness (single timeout with no second attempt)
- Your own harness/tooling errors

## Safety

- Read-only on production: no invites, key rotation, policy writes, org settings, uploads
- Changing your own user-level preferences is allowed when your brief requires it

## Example

```json
{
  "run_ok": true,
  "agent": "qa-agent-web-core",
  "target": "http://localhost:5173",
  "coverage": "Login, sidebar navigation, sandbox list and detail.",
  "findings": []
}
```

