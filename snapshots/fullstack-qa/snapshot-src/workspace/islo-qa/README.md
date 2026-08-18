# QA Playwright harness

Black-box browser harness for Factory QA agents. Installed at `/workspace/qa-harness` in the `fullstack-qa` snapshot.

## Layout

```
/workspace/qa-harness/
  .auth/user.json          # generated at runtime (not in snapshot)
  findings/videos/         # agent-copied Playwright clips
  findings/transcripts/    # CLI evidence
  tests/                   # agent-written repro specs
```

## Auth

The Factory environment supplies:

- `ISLO_QA_EMAIL` — test user email
- `ISLO_QA_OTP` — fixed OTP for that user
- `ISLO_BASE_URL` — deployed app URL (default `https://app.islo.dev`)

Run `npx playwright test --project=setup` before other tests. Never use `SKIP_AUTH=1`.

Chromium is pinned to HTTP/1.1 (`--disable-http2`) for gateway compatibility in test VMs.

## Agent workflow

1. Explore with browser tools if helpful.
2. Reproduce bugs in Playwright with `video: 'on'` on the spec file.
3. Copy evidence into `findings/videos/` or `findings/transcripts/`.
4. Write `/workspace/findings.json` per the shared output contract.
