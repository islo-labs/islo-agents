# Snapshot contract: `qa-collector`

<!-- PLACEHOLDER: build a VM snapshot named `qa-collector` with the collector agent only. -->

## Required paths

| Path in snapshot | Contents |
|------------------|----------|
| `/opt/qa-harness/agent/collect_and_post.py` | Aggregates staged findings from knowledge, dedupes, files Linear issues |
| `/opt/qa-harness/agent/` | Supporting modules the collector imports |

The `fullstack-qa-collector` job is lightweight — no browser stack, no parallel fanout. Harness source is in `snapshot-src/`; build with `setup-snapshot.sh`.

## Building

```bash
./snapshots/qa-collector/setup-snapshot.sh
islo snapshot save qa-collector
```

See [`lines/fullstack-qa-line/README.md`](../../lines/fullstack-qa-line/README.md) for deploy steps.
