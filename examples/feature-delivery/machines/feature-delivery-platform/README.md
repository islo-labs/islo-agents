# Machine `feature-delivery-platform`

Clone the product repositories and install the full application stack and browser tooling. Copy `files/workspace/prompts/` into `/workspace/prompts/`. Provide an idempotent `/workspace/scripts/boot-stack.sh` that accepts PR branch pins and writes `/workspace/.platform-env` with service URLs. Document the service flags there.

## Create and build

Select your Factory with `islo factory set <factory>`. Create the Machine from repositories you control and this examples repository:

```bash
islo factory machine create feature-delivery-platform --repo <your-repository-url> --repo https://github.com/islo-labs/islo-agents --vcpus 8 --memory-mb 16384 --disk-gb 20 --capability docker --capability browser-use --pause-after-idle 1800 --delete-after 172800 --auto-resume on_activity
islo factory machine get feature-delivery-platform
```

During Machine setup, request the layout and dependencies described above. Supporting paths in this guide are relative to `examples/feature-delivery/machines/feature-delivery-platform/`. The examples checkout must be at `/workspace/islo-agents/` for script Agents. Build from the revision containing the Agent manifests you deploy.

Complete any setup questions and wait for a successful published build before creating Agents. `machine` in each Agent manifest must match this name. Use `islo factory machine build feature-delivery-platform` after changing build inputs, then inspect the build again.

Credentials come from the connected integrations and selected Factory environment. Keep credentials out of build files. Each new Line Run gets a workspace from the Machine. Repeated stage visits reuse that run's workspace.
