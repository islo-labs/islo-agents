# Machine `designer`

Put your UI checkout at `/workspace/app/`. Install dependencies and browser tooling. Provide an idempotent `/workspace/scripts/start-storybook.sh` that starts Storybook on port 6006 and writes `/workspace/design/share.json` with a `url` field. It must preserve local design edits on later visits.

## Create and build

Select your Factory with `islo factory set <factory>`. Create the Machine from repositories you control and this examples repository:

```bash
islo factory machine create designer --repo <your-repository-url> --repo https://github.com/islo-labs/islo-agents --vcpus 4 --memory-mb 8192 --disk-gb 20 --capability browser-use --pause-after-idle 14400 --delete-after 604800 --auto-resume on_activity
islo factory machine get designer
```

During Machine setup, request the layout and dependencies described above. Supporting paths in this guide are relative to `examples/designer-line/machines/designer/`. The examples checkout must be at `/workspace/islo-agents/` for script Agents. Build from the revision containing the Agent manifests you deploy.

Complete any setup questions and wait for a successful published build before creating Agents. `machine` in each Agent manifest must match this name. Use `islo factory machine build designer` after changing build inputs, then inspect the build again.

Credentials come from the connected integrations and selected Factory environment. Keep credentials out of build files. Each new Line Run gets a workspace from the Machine. Repeated stage visits reuse that run's workspace.
