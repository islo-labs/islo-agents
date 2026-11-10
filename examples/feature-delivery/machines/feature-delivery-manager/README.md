# Machine `feature-delivery-manager`

This prompt Agent handles Manager turns only. A source-level build with the `islo` CLI is sufficient.

## Create and build

Select your Factory with `islo factory set <factory>`. Create the Machine from repositories you control and this examples repository:

```bash
islo factory machine create feature-delivery-manager --repo <your-repository-url> --repo https://github.com/islo-labs/islo-agents --vcpus 2 --memory-mb 4096 --disk-gb 20
islo factory machine get feature-delivery-manager
```

During Machine setup, request the layout and dependencies described above. Supporting paths in this guide are relative to `examples/feature-delivery/machines/feature-delivery-manager/`. The examples checkout must be at `/workspace/islo-agents/` for script Agents. Build from the revision containing the Agent manifests you deploy.

Complete any setup questions and wait for a successful published build before creating Agents. `machine` in each Agent manifest must match this name. Use `islo factory machine build feature-delivery-manager` after changing build inputs, then inspect the build again.

Credentials come from the connected integrations and selected Factory environment. Keep credentials out of build files. Each new Line Run gets a workspace from the Machine. Repeated stage visits reuse that run's workspace.
