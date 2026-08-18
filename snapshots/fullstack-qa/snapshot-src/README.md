# Snapshot build notes

Source for the `fullstack-qa` snapshot. Bake with `../setup-snapshot.sh`, then capture.

The snapshot holds Playwright tests, prompts, and `stage.py` (knowledge handoff). No prepare/cleanup — Islo deletes provision-mode sandboxes when the run finishes.
