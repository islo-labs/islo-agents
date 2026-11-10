# Machine `qa`

Copy `files/workspace/prompts/` to `/workspace/prompts/` and customize the three briefs for your product. Copy `files/workspace/qa-harness/` to `/workspace/qa-harness/`. Install its npm dependencies and Playwright browsers. Install your product CLI on `PATH` for the cross-surface brief. The report scripts run from the `islo-agents` checkout; no `/opt` copy is needed.

## Create and build

Select your Factory with `islo factory set <factory>`. Create the Machine from repositories you control and this examples repository:

```bash
islo factory machine create qa --repo <your-repository-url> --repo https://github.com/islo-labs/islo-agents --environment qa --vcpus 2 --memory-mb 4096 --disk-gb 20 --capability browser-use
islo factory machine get qa
```

During Machine setup, request the layout and dependencies described above. Supporting paths in this guide are relative to `examples/qa/machines/qa/`. The examples checkout must be at `/workspace/islo-agents/` for script Agents. Build from the revision containing the Agent manifests you deploy.

Complete any setup questions and wait for a successful published build before creating Agents. `machine` in each Agent manifest must match this name. Use `islo factory machine build qa` after changing build inputs, then inspect the build again.

Credentials come from the connected integrations and selected Factory environment. Keep credentials out of build files. Each new Line Run gets a workspace from the Machine. Repeated stage visits reuse that run's workspace.
