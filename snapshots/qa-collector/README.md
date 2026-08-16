# Snapshot contract: `qa-collector`

<!-- PLACEHOLDER: build a VM snapshot named `qa-collector` with the collector agent only. -->

## Required paths

| Path in snapshot | Contents |
|------------------|----------|
| `/opt/qa-harness/agent/collect_and_post.py` | Aggregates staged findings from knowledge, dedupes, files Linear issues |
| `/opt/qa-harness/agent/` | Supporting modules the collector imports |

The `fullstack-qa-collector` job is lightweight — no browser stack, no parallel fanout. It reads findings staged by the `fullstack-qa` stage and publishes to Linear.

## Environment

`LINEAR_TEAM_ID` (and optional `SLACK_CHANNEL`) must be set in Factory environment **`fullstack-qa`**. The job defaults to `DRY_RUN=1` until you opt in.

See [`lines/fullstack-qa-line/README.md`](../../lines/fullstack-qa-line/README.md) for deploy steps.
