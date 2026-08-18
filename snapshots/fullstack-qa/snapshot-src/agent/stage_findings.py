#!/usr/bin/env python3
"""QA-stage tail: validate one agent's findings and publish a knowledge item."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import traceback
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import infra_classify as ic  # noqa: E402
import islo_env  # noqa: E402
import slack_upload  # noqa: E402

AGENT = os.environ.get("QA_AGENT_ID", "qa-agent")
BRIEF = os.environ.get("QA_BRIEF_LABEL", "")
REPO = "/workspace/qa-harness"
FINDINGS_JSON = "/workspace/findings.json"
AGENT_LOG = "/workspace/agent.log"
TAG = "islo-qa-findings"
TARGET = os.environ.get("ISLO_BASE_URL", "http://localhost:5173")
MIN_EVIDENCE_BYTES = 64


def log(msg: str) -> None:
    print(f"[stage] {msg}", flush=True)


def load_findings():
    errors = []
    if not os.path.exists(FINDINGS_JSON):
        return None, [f"{FINDINGS_JSON} was never written"]
    try:
        with open(FINDINGS_JSON) as fh:
            raw = fh.read()
    except OSError as exc:
        return None, [f"could not read {FINDINGS_JSON}: {exc}"]

    if not raw.strip():
        return None, [f"{FINDINGS_JSON} is empty"]

    text = raw.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.S)
    if fence:
        text = fence.group(1)
        errors.append("findings.json was fenced; unwrapped it")

    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        return None, [f"findings.json is not valid JSON: {exc}"]

    if not isinstance(payload, dict):
        return None, ["findings.json is not a JSON object"]
    if not isinstance(payload.get("findings"), list):
        return None, ["findings.json has no 'findings' array"]
    return payload, errors


def evidence_path(finding: dict) -> tuple[str | None, str]:
    """Return (absolute path, kind) where kind is video|transcript."""
    for key, kind in (("video", "video"), ("transcript", "transcript")):
        rel = str(finding.get(key) or "").strip()
        if not rel:
            continue
        path = rel if os.path.isabs(rel) else os.path.join(REPO, rel)
        return path, kind
    return None, ""


def clean_findings(payload: dict):
    keep, rejected = [], []
    for i, f in enumerate(payload.get("findings", [])):
        label = f"#{i + 1}"
        if not isinstance(f, dict):
            rejected.append((label, "not an object"))
            continue

        title = str(f.get("title") or "").strip()
        actual = str(f.get("actual") or "").strip()
        label = f"#{i + 1} {title[:60] or '<untitled>'}"

        if not title or not actual:
            rejected.append((label, "missing title or actual"))
            continue

        blob = ic.finding_blob(f)
        hit = ic.is_infrastructure_text(blob)
        if hit:
            rejected.append((label, f"infrastructure error, not a product bug (matched {hit.group(0)!r})"))
            continue

        sev = str(f.get("severity") or "").strip().lower()
        if sev not in ic.SEVERITIES:
            rejected.append((label, f"severity {sev!r} is not one of {sorted(ic.SEVERITIES)}"))
            continue

        surface = str(f.get("surface") or "").strip().lower()
        if surface not in ic.SURFACES:
            rejected.append((label, f"surface {surface!r} must be web or cli"))
            continue

        confidence = str(f.get("confidence") or "medium").strip().lower()
        if confidence not in ic.CONFIDENCE_LEVELS:
            rejected.append((label, f"confidence {confidence!r} is invalid"))
            continue

        try:
            reproduced = int(f.get("reproduced") or 0)
        except (TypeError, ValueError):
            reproduced = 0
        if reproduced < 2:
            rejected.append((label, f"reproduced only {reproduced}x; needs >=2"))
            continue

        path, kind = evidence_path(f)
        if not path:
            rejected.append((label, "no video or transcript path"))
            continue
        if not os.path.exists(path):
            rejected.append((label, f"evidence {path} does not exist on disk"))
            continue
        if os.path.getsize(path) < MIN_EVIDENCE_BYTES:
            rejected.append((label, f"evidence {path} is too small"))
            continue

        f["_evidence_path"] = path
        f["_evidence_kind"] = kind
        f["severity"] = sev
        f["surface"] = surface
        f["confidence"] = confidence
        f["reproduced"] = reproduced
        keep.append(f)
    return keep, rejected


def tail_agent_log(limit: int = 1500) -> str:
    try:
        with open(AGENT_LOG) as fh:
            return fh.read()[-limit:]
    except OSError:
        return ""


def evidence_excerpt(path: str, kind: str) -> str:
    if kind != "transcript":
        return ""
    try:
        with open(path) as fh:
            return fh.read(8000)
    except OSError:
        return ""



def upload_evidence_to_slack(findings: list[dict], _agent: str) -> list[str]:
    """Register screen recordings in Slack while the sandbox still has them on disk."""
    errors: list[str] = []
    if not (os.environ.get("SLACK_TOKEN") or "").strip():
        log("SLACK_TOKEN is not set — skipping evidence upload")
        return errors
    if not findings:
        return errors

    for f in findings:
        path = f.get("_evidence_path")
        kind = f.get("_evidence_kind")
        if not path or kind != "video":
            continue
        title = str(f.get("title") or os.path.basename(path))
        try:
            uploaded = slack_upload.upload_file(
                path,
                title=title,
            )
            f["_slack_file_id"] = uploaded.get("id")
            f["_slack_permalink"] = uploaded.get("permalink")
            log(f"registered evidence {os.path.basename(path)} -> {uploaded.get('id')}")
        except (OSError, slack_upload.SlackError) as exc:
            msg = f"could not upload {os.path.basename(path)}: {exc}"
            log(msg)
            errors.append(msg)
    return errors


def main() -> int:
    log(f"agent={AGENT} brief={BRIEF!r} target={os.environ.get('ISLO_BASE_URL', TARGET)}")

    agent_rc_path = "/workspace/agent.rc"
    agent_rc = None
    if os.path.exists(agent_rc_path):
        try:
            with open(agent_rc_path) as fh:
                agent_rc = int(fh.read().strip() or "1")
        except (OSError, ValueError):
            agent_rc = None

    payload, load_errors = load_findings()
    infra_errors: list[str] = []
    keep, rejected = [], []

    if payload is None:
        detail = "; ".join(load_errors)
        log(f"no usable findings.json: {detail}")
        tail = tail_agent_log()
        if agent_rc not in (0, None) or ic.INFRA_RE.search(tail):
            infra_errors.append(f"agent produced no findings.json (exit={agent_rc}): {detail}")
        else:
            infra_errors.append(f"findings.json unusable: {detail}")
        payload = {"run_ok": False, "findings": []}
    else:
        for e in load_errors:
            log(f"note: {e}")
        keep, rejected = clean_findings(payload)
        for label, reason in rejected:
            log(f"dropped {label}: {reason}")
            if "infrastructure error" in reason:
                infra_errors.append(f"{label}: {reason}")
        if payload.get("run_ok") is False:
            infra_errors.append("agent set run_ok:false")

    reportable = keep
    for err in upload_evidence_to_slack(reportable, AGENT):
        log(f"evidence upload warning: {err}")

    run_ok = bool(payload.get("run_ok", True)) and not infra_errors and agent_rc in (0, None)

    item = {
        "schema": 1,
        "agent": AGENT,
        "brief": BRIEF or payload.get("brief", ""),
        "run_ok": run_ok,
        "target": payload.get("target") or TARGET,
        "coverage": str(payload.get("coverage") or "").strip(),
        "infra_errors": infra_errors,
        "rejected": [{"finding": lbl, "reason": r} for lbl, r in rejected],
        "findings": [
            {
                "title": f["title"],
                "severity": f["severity"],
                "confidence": f["confidence"],
                "surface": f["surface"],
                "steps": [str(s) for s in (f.get("steps") or [])],
                "expected": str(f.get("expected") or ""),
                "actual": str(f.get("actual") or ""),
                "reproduced": f["reproduced"],
                "evidence_kind": f["_evidence_kind"],
                "evidence": os.path.basename(f["_evidence_path"]),
                "evidence_text": evidence_excerpt(f["_evidence_path"], f["_evidence_kind"]),
                "slack_file_id": f.get("_slack_file_id"),
                "slack_permalink": f.get("_slack_permalink"),
            }
            for f in reportable
        ],
    }

    body = "\n".join(
        [
            f"# Islo QA — {AGENT}",
            "",
            f"- run_ok: {run_ok}",
            f"- target: {item['target']}",
            f"- brief: {item['brief']}",
            f"- reportable findings: {len(item['findings'])}",
            f"- infra errors: {len(infra_errors)}",
            "",
            "Machine-readable payload; the collector reads this block and nothing else.",
            "",
            "```qa_report",
            json.dumps(item, indent=2, sort_keys=True),
            "```",
        ]
    )

    stamp = os.environ.get("QA_RUN_STAMP") or datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    identifier = f"islo-qa-{AGENT}-{stamp}"
    body_path = "/workspace/knowledge-body.md"
    with open(body_path, "w") as fh:
        fh.write(body)

    proc = subprocess.run(
        [
            islo_env.CONTROL_PLANE_ISLO,
            "knowledge",
            "create",
            identifier,
            "--tag",
            TAG,
            "--body",
            f"@{body_path}",
            "-o",
            "json",
        ],
        capture_output=True,
        text=True,
        env=islo_env.control_plane_env(),
    )
    log(f"knowledge create {identifier}: rc={proc.returncode}")
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "unknown error").strip()
        infra_errors.append(f"knowledge create failed: {detail}")
        log(f"stdout: {proc.stdout[-800:]}")
        log(f"stderr: {proc.stderr[-800:]}")

    log(
        f"summary: run_ok={run_ok and proc.returncode == 0} reportable={len(item['findings'])} "
        f"rejected={len(rejected)} infra={len(infra_errors)}"
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        traceback.print_exc()
        print("[stage] unhandled error; exiting 0 so the line continues", flush=True)
        sys.exit(0)
