# Islo QA Playwright harness

Black-box QA harness installed at runtime into each `islo-fullstack` sandbox.

## Layout

```
/workspace/islo-qa/
  .auth/user.json          # generated at runtime (not in snapshot)
  findings/videos/         # agent-copied Playwright clips
  findings/transcripts/    # CLI evidence
  tests/                   # agent-written repro specs
```

## Auth

The Factory environment `islo-qa-fullstack` supplies:

- `ISLO_QA_EMAIL` — `fullstack@islo.local` (Descope test user in project `P397XkCwssNLDTHXJifN0SaFJYSZ`)
- `ISLO_QA_OTP` — fixed OTP `246810` (same as fullstack fixture / PR preview Descope project)
- `ISLO_BASE_URL` — `http://localhost:5173`

Run `npx playwright test --project=setup` before other tests. Never use `SKIP_AUTH=1`.

Chromium is pinned to HTTP/1.1 (`--disable-http2`) for gateway compatibility in test VMs.

## Agent workflow

1. Explore with `browser-use` if helpful.
2. Reproduce bugs in Playwright with `video: 'on'` on the spec file.
3. Copy evidence into `findings/videos/` or `findings/transcripts/`.
4. Write `/workspace/findings.json` per the shared output contract.
