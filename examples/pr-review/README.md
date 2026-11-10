# PR review Line

A Machine-backed Prompt Agent reviews newly opened GitHub pull requests and posts one advisory comment. The Line binds event inputs to that Agent stage and returns `review_result`, `summary`, and `reviewed_head_sha`.

## Prepare the Machine and Agent

Connect GitHub locally and choose a repository you trust. In `line.toml`, replace `REPLACE_WITH_OWNER/REPLACE_WITH_REPOSITORY`. Fork PR text and changed files are untrusted input.

Select your intended Factory, then prepare the Agent's Machine:

```bash
islo factory current
islo factory machine create pr-review --repo https://github.com/REPLACE_WITH_OWNER/REPLACE_WITH_REPOSITORY --gateway-profile default
islo factory machine get pr-review
```

Wait for a published, usable Machine version. If a suitable Machine already exists, set `machine` in `agents/pr-review.toml` to its name instead. The Machine owns repositories, environment, gateway profile, and lifecycle. Configure retention to suit your run history and cleanup needs.

The Agent owns its reusable prompt, harness, model, provider, Skills, and MCP configuration. The prompt explicitly renders `{{repository}}`, `{{pull_request_number}}`, and `{{pull_request_url}}` from the Line stage params. Declaring those named params alone does not deliver their values to the Agent. This example uses Claude with `claude-sonnet-4-5` and default provider routing. Ensure that the intended automation identity has a suitable provider connection. To use another provider or model, inspect the live schema and model catalog before editing those fields.

```bash
islo schema agent --short
islo agent validate examples/pr-review/agents/pr-review.toml
islo agent create examples/pr-review/agents/pr-review.toml
```

For an existing Agent, inspect it first with `islo agent get pr-review`. Use `islo agent update pr-review <update-file>` with a copy that omits the immutable `name` field.

## Validate and deploy the Line

The Line owns stage params and outputs, trigger selection, routing, and limits. Its review stage uses `agent = "pr-review"`. Agent sandboxes use the Agent's Machine and default to `pr-review-{{line_run_id}}`.

```bash
python3 scripts/validate_examples.py
python3 scripts/test_pr_review_inputs.py
islo schema factory --short
islo factory line validate examples/pr-review/line.toml
islo factory line deploy examples/pr-review/line.toml --dry-run
islo factory line deploy examples/pr-review/line.toml
```

Obtain approval for deployment and the advisory GitHub comment before running the example.

## Verify one run

First make a local copy of `line.toml` with a manual trigger. Replace its entire `[trigger]` section, including selector and outputs, with `[trigger] type = "manual"` in valid TOML. Give `[line].name` a unique temporary name. Validate and deploy that copy, then pass representative values for the three review params. Running it posts one advisory comment on the selected PR.

```bash
islo factory line run <temporary-name> --param repository=OWNER/REPOSITORY --param-json pull_request_number=123 --param pull_request_url=https://github.com/OWNER/REPOSITORY/pull/123
islo factory line-run status <run-id>
islo factory line-run stages <run-id>
islo factory line-run events <run-id>
```

When the manual check succeeds, open one PR in the approved repository to verify the integration trigger. Inspect `islo factory line runs pr-review`, followed by that run's status, stages, and events. Expect one advisory comment and all three declared outputs. A provider failure at inference establishes neither a review verdict nor successful comment delivery; report setup and routing evidence separately.

`line-run ask` addresses the Manager. `line-run agent-turn` sends a follow-up to the successful stage Agent session.

## Customize and clean up

Change the reusable prompt in `agents/pr-review.toml` through an Agent update. Start a fresh Line run after updating it; an existing run retains the Agent configuration it first resolved. Validate and redeploy the Line after changing its contracts or trigger.

Stop active temporary runs before removing their temporary Lines. Line removal does not delete run sandboxes. Inspect `islo ls -a` and remove only test sandboxes you created. Remove the deployed Line, Agent, and Machine only when no other workflow depends on them:

```bash
islo factory line rm pr-review --force
islo agent delete pr-review
islo factory machine delete pr-review
```

Only `pull_request.opened` is configured. Updated or reopened PRs do not retrigger this Line unless you extend the trigger.

## Check input delivery without inference

The CI regression checks that each PR identifier is declared by the stage and referenced in the prompt. With a local checkout of the current Web API and its Python environment installed, run the runtime check:

```bash
/path/to/islo-web-api/.venv/bin/python scripts/test_pr_review_inputs.py --api-repo /path/to/islo-web-api
```

This uses the API's Agent manifest generation and session prompt renderer. It checks that initial and resumed prompts contain representative repository, PR number, and URL values for manual and integration-trigger inputs. It needs no deployment, provider credentials, or inference.
