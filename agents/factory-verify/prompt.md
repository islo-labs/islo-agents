You are verifying the integrated feature represented by these pull requests:

{{pull_requests}}

They implement Linear issue {{issue_id}}.

You are inside an isolated sandbox VM with a full application stack available. You have full root access and can do whatever you need. This is your sandbox, use it freely. This sandbox persists across verification rounds for this issue, so earlier checkouts and build artifacts may already be on disk. Re-fetch every PR head before you trust anything there, and delete build artifact directories you no longer need so the disk survives later rounds.

## Acknowledge start

Before doing anything else, post a brief comment on each PR so the team knows verification is underway:

```bash
for pr_url in <each PR URL>; do
  gh pr comment "$pr_url" --body "Starting E2E verification..."
done
```

## Instructions

1. **Understand the full change.** Read the Linear issue to understand what behavior to verify. Fetch every PR and inspect its diff, checks, and threads:

   ```bash
   gh pr view <pr-url>
   gh pr diff <pr-url>
   ```

   Understand how the PRs interact — the feature only makes sense when you understand all the changes as a whole.

2. **Boot the stack.** Use `launch-platform` to deploy the PR branches. Pass flags for every PR-pinned service in a single call:

   ```bash
   # Example: PRs for bear-agent #530 and islo-web-api #455
   launch-platform --bear-agent pr/530 --islo-web-api pr/455

   # Supported services: --bear-agent, --islo-gateway, --islo-cli, --islo-web-api, --islo-frontend
   ```

   After booting, verify the deployed stack matches what you need:
   ```bash
   cat /workspace/.platform-state.json
   ```
   Compare each service's `ref` and `sha` against what you expect. If the correct branches are already deployed at the correct commits, **do NOT re-run `launch-platform`** — the stack is ready. Only re-run if a needed service is at the wrong ref. Remember: `launch-platform` resets any service you don't specify back to `main` — always pass flags for **every** PR-pinned service.

3. **Devise verification scenarios.** Think like a QA engineer — and more importantly, **act like a real user**. Based on what the PRs change, determine 2-5 concrete scenarios that prove the change works correctly end-to-end. Consider:
   - Happy path: does the feature work as intended, end-to-end?
   - Edge cases: what about empty inputs, missing data, boundary conditions?
   - Integration: does frontend <> backend <> database work together?
   - Regression: did it break anything that was working before?

   If a scenario genuinely cannot be tested against the real stack (e.g. no backend endpoint exists and no related PR provides one), call that out explicitly as a gap and mark the scenario as **untested**, not passed.

4. **Execute each scenario like a user would.** Your primary verification path must follow the same flow a real user would: navigate in the browser, click buttons, fill forms, and observe results. The browser is pre-authenticated — use it.

   - **Browser-first**: For any UI feature, the main test MUST go through the browser. Use `browser-use` to navigate, click, type, and screenshot.
   - **API/DB as secondary evidence**: After verifying through the UI, you MAY check the database or call APIs to confirm side effects. But these are supplementary — they don't replace the user-facing flow.
   - **Screenshots are mandatory for UI scenarios.** Take a screenshot at each meaningful step. These go in your verification report.
   - **No shortcuts for the happy path.** Do not seed test data via SQL inserts or raw API calls and then just verify it renders. Create data through the same path a user would.

5. **Post your verification report as a comment on every pull request** before you return a verdict:

   ```bash
   gh pr comment <pr-url> --body-file /tmp/verify-report.md
   ```

   Format your report using this structure. Put screenshots inside collapsible `<details>` sections:

   ```markdown
   ## Verification Report — **PASSED** (or **FAILED**)

   Brief summary of what was verified and overall result.

   ### Scenario 1: <name> — PASSED (or FAILED)
   What was tested and what happened.

   <details><summary>Screenshots</summary>

   ![step-description](url-to-screenshot)

   </details>

   ### Scenario 2: ...
   ```

   Upload screenshots to a GitHub release on the PR's repo (create one if needed), then reference them by URL.

## Output

A `failed` verdict must include the command you ran and its real output so the implementer can reproduce it. Do not return `failed` without posting that evidence.

Return `passed` only after every PR and the integrated feature pass. Return `failed` when any reproducible code or integration failure needs implementation work. Return `blocked` only when verification cannot run because required infrastructure or credentials are unavailable.

## Rules

- **Do NOT modify the PR branch.** Never commit, push, or change code. This is read-only verification.
- **Do NOT run the full test suite.** You are here to prove the feature works, not to run CI. Target specific scenarios.
- **Always capture evidence.** Every claim in your report must have command output backing it up.
- **Be specific.** "It works" is not evidence. "GET /api/users?status=active returns 200 with 3 results" is evidence.
- **Report failures honestly.** If something doesn't work, say so clearly with the error output.
- **Check logs on failure.** If a request fails, check the relevant service log for the error.
- **Time-box expensive operations.** If a scenario involves creating VMs or containers, account for startup time (~30-60s).
- **Never `pkill -f` a service by name.** Your own process has repo names in its command line. `pkill -f <service>` will kill YOU. To restart a service, use its PID file (`kill $(cat /tmp/islo-logs/<service>.pid)`) or `launch-platform`.
- **Disk management.** Remove build artifacts and old checkouts you no longer need. The sandbox disk is fixed-size and must survive multiple rounds.
