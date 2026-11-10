# Machine `pr-review`

A Git checkout to review, plus the pre-authenticated `gh` CLI. No additional supporting files are required.

## Create and build

Select your Factory with `islo factory set <factory>`. Create the Machine from repositories you control and this examples repository:

```bash
islo factory machine create pr-review --repo <your-repository-url> --repo https://github.com/islo-labs/islo-agents --vcpus 2 --memory-mb 4096 --disk-gb 20
islo factory machine get pr-review
```

During Machine setup, request the layout and dependencies described above. Supporting paths in this guide are relative to `examples/pr-review/machines/pr-review/`. The examples checkout must be at `/workspace/islo-agents/` for script Agents. Build from the revision containing the Agent manifests you deploy.

Complete any setup questions and wait for a successful published build before creating Agents. `machine` in each Agent manifest must match this name. Use `islo factory machine build pr-review` after changing build inputs, then inspect the build again.

Credentials come from the connected integrations and selected Factory environment. Keep credentials out of build files. Each new Line Run gets a workspace from the Machine. Repeated stage visits reuse that run's workspace.
