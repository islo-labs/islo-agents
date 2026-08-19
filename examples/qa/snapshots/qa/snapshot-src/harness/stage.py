#!/usr/bin/env python3
"""Validate agent findings and stage a knowledge handoff for the collector."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import traceback
from datetime import datetime, timezone

import re

INFRA_PATTERNS = [
    r"credential injection",
    r"api error:\s*4\d\d",
    r"api error:\s*5\d\d",
    r"failed to authenticate",
    r"anthropic",
    r"invalid request parameters",
    r"model is not allowed",
    r"playwright.*not installed",
    r"cannot find module",
    r"err_cert",
    r"self.signed certificate",
    r"net::err_failed",
    r"storage state.*(missing|expired)",
    r"\bSKIP_AUTH\b",
    r"rate limit",
    r"ENOTFOUND",
    r"ECONNREFUSED",
]
INFRA_RE = re.compile("|".join(INFRA_PATTERNS), re.I)
SEVERITIES = {"critical", "high", "medium-high", "medium", "medium-low", "low"}
SURFACES = {"web", "cli"}
CONFIDENCE_LEVELS = {"high", "medium", "low"}
EXPECTED_AGENTS = frozenset(
    {
        "qa-agent-web-core",
        "qa-agent-web-platform",
        "qa-agent-cli-cross",
    }
)


def finding_blob(finding: dict) -> str:
    parts = [
        str(finding.get(k) or "")
        for k in ("title", "expected", "actual", "notes", "surface")
    ]
    parts.append(" ".join(str(s) for s in (finding.get("steps") or [])))
    return " ".join(parts)


def is_infrastructure_text(text: str) -> re.Match[str] | None:
    return INFRA_RE.search(text or "")


FINDINGS = "/workspace/findings.json"
AGENT_LOG = "/workspace/agent.log"
TAG = "islo-qa-findings"
MIN_EVIDENCE_BYTES = 2048


def log(msg: str) -> None:
    print(f"[stage] {msg}", flush=True)


def load_findings():
    errors: list[str] = []
    if not os.path.isfile(FINDINGS):
        return None, [f"{FINDINGS} missing"]
    try:
        with open(FINDINGS, encoding="utf-8") as fh:
            payload = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        return None, [f"could not parse {FINDINGS}: {exc}"]
    if not isinstance(payload, dict):
        return None, [f"{FINDINGS} is not an object"]
    return payload, errors


def evidence_path(finding: dict) -> tuple[str | None, str | None]:
    video = str(finding.get("video") or "").strip()
    transcript = str(finding.get("transcript") or "").strip()
    if video:
        return video, "video"
    if transcript:
        return transcript, "transcript"
    return None, None


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

        blob = finding_blob(f)
        hit = is_infrastructure_text(blob)
        if hit:
            rejected.append((label, f"infrastructure error, not a product bug (matched {hit.group(0)!r})"))
            continue

        sev = str(f.get("severity") or "").strip().lower()
        if sev not in SEVERITIES:
            rejected.append((label, f"severity {sev!r} is not one of {sorted(SEVERITIES)}"))
            continue

        surface = str(f.get("surface") or "").strip().lower()
        if surface not in SURFACES:
            rejected.append((label, f"surface {surface!r} must be web or cli"))
            continue

        confidence = str(f.get("confidence") or "medium").strip().lower()
        if confidence not in CONFIDENCE_LEVELS:
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


def main() -> int:
    agent = (os.environ.get("QA_AGENT_ID") or "").strip()
    brief = (os.environ.get("QA_BRIEF_LABEL") or "").strip()
    target = (os.environ.get("ISLO_BASE_URL") or "").rstrip("/")

    if agent not in EXPECTED_AGENTS:
        log(f"unexpected QA_AGENT_ID={agent!r}")
        return 0

    log(f"agent={agent} brief={brief!r} target={target}")

    agent_rc = None
    agent_rc_path = "/workspace/agent.rc"
    if os.path.isfile(agent_rc_path):
        try:
            agent_rc = int(open(agent_rc_path).read().strip())
        except (OSError, ValueError):
            agent_rc = None

    payload, load_errors = load_findings()
    infra_errors: list[str] = []
    keep, rejected = [], []

    if payload is None:
        detail = "; ".join(load_errors)
        log(f"no usable findings.json: {detail}")
        tail = tail_agent_log()
        if agent_rc not in (0, None) or INFRA_RE.search(tail):
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

    run_ok = bool(payload.get("run_ok", True)) and not infra_errors and agent_rc in (0, None)

    item = {
        "schema": 1,
        "agent": agent,
        "brief": brief or payload.get("brief", ""),
        "run_ok": run_ok,
        "target": payload.get("target") or target,
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
            }
            for f in keep
        ],
    }

    body = "\n".join(
        [
            f"# QA — {agent}",
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
    identifier = f"islo-qa-{agent}-{stamp}"
    body_path = "/workspace/knowledge-body.md"
    with open(body_path, "w", encoding="utf-8") as fh:
        fh.write(body)

    proc = subprocess.run(
        [
            "islo",
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
