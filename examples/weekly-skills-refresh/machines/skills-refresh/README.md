# Machine `skills-refresh`

Clone the product repositories to inspect under `/workspace/`. These checkouts define the product revision used for the lookback. Rebuild this Machine to refresh them. Python 3.11 or later, Git, and the pre-authenticated `gh` CLI are required. The prepare Agent clones the skills repository at runtime.

## Create and build

Select your Factory with `islo factory set <factory>`. Create the Machine from repositories you control and this examples repository:

```bash
islo factory machine create skills-refresh --repo <your-repository-url> --repo https://github.com/islo-labs/islo-agents --vcpus 2 --memory-mb 4096 --disk-gb 20
islo factory machine get skills-refresh
```

During Machine setup, request the layout and dependencies described above. Supporting paths in this guide are relative to `examples/weekly-skills-refresh/machines/skills-refresh/`. The examples checkout must be at `/workspace/islo-agents/` for script Agents. Build from the revision containing the Agent manifests you deploy.

Complete any setup questions and wait for a successful published build before creating Agents. `machine` in each Agent manifest must match this name. Use `islo factory machine build skills-refresh` after changing build inputs, then inspect the build again.

Credentials come from the connected integrations and selected Factory environment. Keep credentials out of build files. Each new Line Run gets a workspace from the Machine. Repeated stage visits reuse that run's workspace.
