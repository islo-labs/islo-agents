# Snapshot build notes

QA agents provision from the **`islo-fullstack`** snapshot (built by `islo-devops` CI). Each job run:

1. Extracts the Playwright harness tarball into `/workspace/islo-qa`.
2. Runs `snapshot-src/scripts/start-qa-stack.sh` → `launch.sh` + `start.sh`.
3. Signs in with the fullstack Descope test user (`fullstack@islo.local` / OTP `246810`).

The `islo-qa-baseline` snapshot is only used by the lightweight collector job.

## Optional: standalone harness snapshot

To rebuild `islo-qa-baseline` (collector only):

1. Provision a clean `islo-runner` sandbox.
2. Copy `snapshot-src/workspace/islo-qa` to `/workspace/islo-qa`.
3. Run `snapshot-src/setup-snapshot.sh`.
4. Capture snapshot as `islo-qa-baseline`.

Credentials come from the `islo-qa-fullstack` Factory environment at runtime.
