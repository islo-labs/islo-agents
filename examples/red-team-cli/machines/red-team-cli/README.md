# Machine `red-team-cli`

Put your CLI checkout at `/workspace/your-cli/`, install its dependencies, and put its binary on `PATH`. Copy `files/workspace/prompts/` to `/workspace/prompts/`. Create `/workspace/black-box/transcripts/`. Configure the `red-team-cli` Factory environment with scoped target API credentials. Set `TARGET_API_URL` in the Agent configuration before testing your target.

## Create and build

Select your Factory with `islo factory set <factory>`. Create the Machine from repositories you control and this examples repository:

```bash
islo factory machine create red-team-cli --repo <your-repository-url> --repo https://github.com/islo-labs/islo-agents --environment red-team-cli --vcpus 2 --memory-mb 4096 --disk-gb 20
islo factory machine get red-team-cli
```

During Machine setup, request the layout and dependencies described above. Supporting paths in this guide are relative to `examples/red-team-cli/machines/red-team-cli/`. The examples checkout must be at `/workspace/islo-agents/` for script Agents. Build from the revision containing the Agent manifests you deploy.

Complete any setup questions and wait for a successful published build before creating Agents. `machine` in each Agent manifest must match this name. Use `islo factory machine build red-team-cli` after changing build inputs, then inspect the build again.

Credentials come from the connected integrations and selected Factory environment. Keep credentials out of build files. Each new Line Run gets a workspace from the Machine. Repeated stage visits reuse that run's workspace.
