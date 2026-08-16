# Snapshot contract: `islo-qa-baseline`

<!-- PLACEHOLDER: build a VM snapshot named `islo-qa-baseline` with the collector agent only. -->

## Required paths

| Path in snapshot | Contents |
|------------------|----------|
| `/opt/islo-qa/agent/collect_and_post.py` | Aggregates staged findings from knowledge, dedupes, files Linear issues |
| `/opt/islo-qa/agent/` | Supporting modules the collector imports |

The `islo-qa-collector` job is lightweight — no browser stack, no parallel fanout. It reads findings staged by the `islo-qa` stage and publishes to Linear.

## Environment

`LINEAR_TEAM_ID` (and optional `SLACK_CHANNEL`) must be set in Factory environment **`islo-qa-fullstack`**. The job defaults to `DRY_RUN=1` until you opt in.

See [`lines/islo-qa-line/README.md`](../../lines/islo-qa-line/README.md) for deploy steps.
