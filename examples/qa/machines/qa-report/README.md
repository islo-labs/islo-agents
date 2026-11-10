# Machine `qa-report`

Python 3.11 or later and the `islo` CLI are required. The collector and its helper modules run directly from `machines/qa-report/files/agent/` in this checkout. Configure a Factory environment named `qa` for your test credentials.

## Create and build

Select your Factory with `islo factory set <factory>`. Create the Machine from repositories you control and this examples repository:

```bash
islo factory machine create qa-report --repo <your-repository-url> --repo https://github.com/islo-labs/islo-agents --environment qa --vcpus 1 --memory-mb 2048 --disk-gb 10
islo factory machine get qa-report
```

During Machine setup, request the layout and dependencies described above. Supporting paths in this guide are relative to `examples/qa/machines/qa-report/`. The examples checkout must be at `/workspace/islo-agents/` for script Agents. Build from the revision containing the Agent manifests you deploy.

Complete any setup questions and wait for a successful published build before creating Agents. `machine` in each Agent manifest must match this name. Use `islo factory machine build qa-report` after changing build inputs, then inspect the build again.

Credentials come from the connected integrations and selected Factory environment. Keep credentials out of build files. Each new Line Run gets a workspace from the Machine. Repeated stage visits reuse that run's workspace.
