# Snapshot contract: `designer`

UI sandbox for the design stage. The same sandbox is kept across follow-ups for one `work_key`. The job publishes exactly two web Surfaces, Frontend and Storybook, while both backing processes run.

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/workspace/app/` | Your UI git checkout |
| `/workspace/app/package.json` | Provides `npm run start` for the frontend on port 3000 |
| `/workspace/scripts/start-storybook.sh` | Starts Storybook on port 6006, listening on all sandbox interfaces |
| Browser on `PATH` | Whatever tool the design prompt should use for screenshots |

The job starts the frontend with `npm run start -- --host 0.0.0.0 --strictPort` when port 3000 is not already healthy. `start-storybook.sh` must be idempotent, leave Storybook running, and preserve local design edits on later visits. It must not call `islo surface` or create public shares. The job sets `STORYBOOK_SHARE=1` when starting it so Storybook uses secure WebSocket HMR through its public share. The job waits for the frontend root and Storybook `/index.json` to respond over HTTP before it calls `islo surface web 3000 --label "Frontend"` and `islo surface web 6006 --label "Storybook"` separately. The job writes both returned URLs to `/workspace/design/share.json`; `url` remains the Storybook URL used for the `share_url` output, and `frontend_url` is the frontend URL.

For the Islo frontend checkout, `npm run start` serves port 3000. The job sets `VITE_ALLOWED_HOSTS=.share.islo.dev` and binds Vite to all sandbox interfaces. Storybook must likewise be reachable through the sandbox, not only over loopback.

```bash
islo snapshot save <your-build-sandbox> --name designer
```

The job names the sandbox `designer-<work_key>`. Do not point `snapshot_name` at a shared internal image.
