# QA Playwright workspace

Minimal black-box browser workspace at `/workspace/qa-harness` in the `fullstack-qa` snapshot.

## Layout

```
/workspace/qa-harness/
  findings/videos/         # agent-copied Playwright clips
  findings/transcripts/    # CLI evidence
  tests/                   # agent-written repro specs
```

## Environment

- `ISLO_BASE_URL` — deployed app URL (from job params / sandbox env)
- `ISLO_API_KEY` — injected by the Factory environment; use with the `islo` CLI

There is **no** baked email/OTP login harness. Establish browser sessions in your own Playwright specs when needed, or cross-check via CLI.

Chromium uses HTTP/1.1 (`--disable-http2`) for gateway compatibility in test VMs.

## Agent workflow

1. Run `npm install && npx playwright install chromium` if deps are missing.
2. Write repro specs under `tests/` with `video: 'on'` when filing web bugs.
3. Copy evidence into `findings/videos/` or `findings/transcripts/`.
4. Write `/workspace/findings.json` per the job prompt output contract.
