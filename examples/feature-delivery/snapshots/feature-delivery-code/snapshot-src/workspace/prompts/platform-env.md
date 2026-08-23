# Platform stack environment

Your verification snapshot should include a boot script and an env file the agent can source after the stack is running.

## Expected layout

| Path | Purpose |
|------|---------|
| `/workspace/scripts/boot-stack.sh` | Boots services pinned to PR branches |
| `/workspace/.platform-env` | Exports URLs, ports, and test credentials after boot |

## Boot script contract

`boot-stack.sh` accepts flags mapping services to git refs (for example PR branches). Document your flags in the snapshot README. After a successful boot:

```bash
source /workspace/.platform-env
```

The env file should export whatever verification needs: frontend URL, API base URL, database URL, and any scoped API keys.

## State file (optional)

If your boot script writes deployment state, use a predictable path such as `/workspace/.platform-state.json` so the agent can confirm which refs are deployed before re-booting.
