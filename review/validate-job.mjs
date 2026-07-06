const REQUIRED_PARAMS = new Map([
  ["repo", "string"],
  ["pr_number", "integer"],
  ["head_ref", "string"],
  ["base_ref", "string"],
  ["sandbox_name", "string"],
  ["agents_ref", "string"],
  ["model", "string"],
  ["max_turns", "integer"],
  ["max_budget_usd", "number"],
]);
const REQUIRED_PARAM_NAMES = new Set([
  "repo",
  "pr_number",
  "head_ref",
  "base_ref",
  "sandbox_name",
  "agents_ref",
]);

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

export function validateReviewJob(job) {
  const errors = [];

  if (!isObject(job)) {
    return ["expected `islo job get` to return a JSON object"];
  }

  if (!job.latest_version) {
    errors.push("job has no deployed version");
  }

  const params = Array.isArray(job.params) ? job.params : [];
  const paramsByName = new Map(
    params
      .filter((param) => param && typeof param === "object")
      .map((param) => [param.name, param]),
  );

  for (const [name, expectedType] of REQUIRED_PARAMS) {
    const param = paramsByName.get(name);
    if (!param) {
      errors.push(`missing required param '${name}'`);
      continue;
    }
    if (param.type !== expectedType) {
      errors.push(
        `param '${name}' must be type '${expectedType}', got '${param.type}'`,
      );
    }
    if (REQUIRED_PARAM_NAMES.has(name) && param.required !== true) {
      errors.push(`param '${name}' must be required`);
    }
  }

  const manifest = job.latest_version?.manifest;
  if (!isObject(manifest)) {
    errors.push("latest deployed version is missing manifest");
  } else {
    const sandbox = manifest.run?.sandbox;
    if (!isObject(sandbox)) {
      errors.push("manifest missing run.sandbox");
    } else {
      if (sandbox.mode !== "ensure") {
        errors.push(
          `manifest run.sandbox.mode must be 'ensure', got '${sandbox.mode}'`,
        );
      }
      if (sandbox.name !== "{{sandbox_name}}") {
        errors.push(
          "manifest run.sandbox.name must be '{{sandbox_name}}' for stable routing",
        );
      }

      const lifecycle = sandbox.lifecycle;
      if (!isObject(lifecycle) || lifecycle.pause_after_idle == null) {
        errors.push("manifest run.sandbox.lifecycle.pause_after_idle is required");
      }
      if (isObject(lifecycle) && lifecycle.pause_after != null) {
        errors.push("manifest must use pause_after_idle, not pause_after");
      }
    }
  }

  return errors;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  let job;
  try {
    job = JSON.parse(await readStdin());
  } catch (error) {
    console.error(
      `Failed to parse \`islo job get\` JSON: ${error.message ?? error}`,
    );
    process.exit(1);
  }

  const errors = validateReviewJob(job);
  if (errors.length > 0) {
    console.error("The deployed islo-review job is not compatible:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    console.error("Deploy a compatible islo-review job from review/job.toml.");
    process.exit(1);
  }

  console.log("The deployed islo-review job is compatible.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
