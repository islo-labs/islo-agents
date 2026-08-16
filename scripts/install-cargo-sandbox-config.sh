#!/usr/bin/env bash
# Write a Cargo config that applies to every crate under /workspace without
# living inside a cloned git repo. Laptop developers never see this file.
set -euo pipefail

mkdir -p /workspace/.cargo
cat > /workspace/.cargo/config.toml <<'EOF'
# Sandbox-only. Do not copy into product repos.
# Shrinks target/ for cargo test / clippy (dev and test profiles).
# debug = 1 keeps panic file:line backtraces without full DWARF.
[profile.dev]
debug = 1
incremental = false

[profile.dev.package."*"]
debug = false

[profile.test]
debug = 1
EOF
