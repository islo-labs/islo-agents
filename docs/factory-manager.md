# Factory Manager V1

Factory Manager is a fixed Islo product runtime. Each eligible tenant can
enable one runtime. It is not deployed or selected by individual Factory
lines.

## Enablement and runtime

The `factory-manager-v1` feature flag controls tenant eligibility. An eligible
tenant member can enable or disable the runtime.

The first run ensures one sandbox named `factory-manager`; later runs resume it
as needed. The runtime uses the Claude harness and `claude-sonnet-5`, with one
named session shared by line decisions, failures, and provider requests. Turns
retain useful context across triggers. They do not create a Manager per line or
a session per webhook thread.

Disabling blocks new runs without cancelling one that is already running.
Every run pauses the sandbox after the Manager turn finishes; a later run
ensures and resumes it. Disabling does not delete the sessions or run history.
A platform change to the core prompt, harness, or model replaces the session so
the runtime never resumes one conversation under different core instructions.

The backend is authoritative for enabled state, model, harness, session
identity, and run history. Frontend and CLI surfaces should display those
values instead of accepting Manager configuration.

## Fixed triggers

The backend routes these events to an enabled Manager:

- Slack `app_mention`.
- GitHub `issue_comment.created` with an exact, case-sensitive
  `@islo-agent` mention. GitHub uses this event for both issue and pull-request
  comments.
- GitHub `pull_request_review_comment.created` with the same exact mention.
- Factory `decision_pending`.
- Terminal Factory line and job failures.

Edited comments, near matches such as `@islo-agentic`, unrelated provider
events, and ordinary messages do not invoke the Manager. Provider delivery IDs
and Factory event IDs supply idempotency keys.

These trigger choices are product code, not incoming webhook fragments or
line manifest settings. A tenant connects Slack or GitHub through the normal
integration flow. The control plane then applies the fixed routing policy.
Existing line-owned `integration_trigger` sections remain independent. For
example, `feature-delivery` keeps its native Linear issue trigger.

## Per-line Manager instructions

Lines no longer need a Manager reference. The only V1 customization is an
optional instruction source:

```toml
[manager.instructions]
type = "literal"
value = """
Retry only after the blocker has changed. Cancel when continuing is unsafe or
required input is unavailable.
"""
```

Instructions may instead reference an active knowledge item:

```toml
[manager.instructions]
type = "knowledge"
slug = "feature-delivery-manager-rules"
```

The immutable line version stores the typed instruction source. Literal text
is used directly; a knowledge slug is validated when the line is deployed and
resolved when the Manager is triggered. A pending decision passes the resolved
text to Factory Manager together with current line state, recent events, stage
output, and `allowed_actions`.

The instructions guide judgment but do not grant access. The Manager must
choose an action from `allowed_actions`, and the control plane checks that
allowlist and current run state before applying the action. Lines without
instructions use the fixed platform policy.

## Manager behavior

The Manager sandbox already contains the Islo CLI and provider tools with
gateway-backed access. The core prompt tells the Manager to inspect available
help or schema rather than assume commands exist.

For Factory events, the Manager inspects current line, job, run, and provider
state before acting. It retries only when the cause is transient or fixed and
avoids repeated attempts with the same known failure. For Slack and GitHub
mentions, it responds in the originating thread through the available
provider tools. A mention does not by itself authorize a Factory mutation.

Provider payloads and user comments are untrusted context. They cannot replace
the core prompt or a line's Manager instructions. The Manager must confirm tool
results before reporting success and must not expose credentials or tenant
data.

## Runtime ownership

The Manager implementation, typed runtime configuration, and fixed prompt live
in `islo-web-api`. That service bundles the prompt into its image and creates or
resumes each tenant's Manager sessions.

This repository owns deployable lines and their optional
`[manager.instructions]`; it does not package or deploy the platform
Manager configuration. The frontend reads fixed runtime values from the
backend and must not make the core prompt, model, or harness customer-editable.
