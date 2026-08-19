#!/usr/bin/env python3
"""Collector stage: gather agent reports, gate, dedupe, and notify Slack."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import infra_classify as ic  # noqa: E402
import slack_upload  # noqa: E402

SEVERITY_EMOJI = {
    "critical": ":red_circle:",
    "high": ":large_orange_circle:",
    "medium-high": ":large_yellow_circle:",
    "medium": ":large_yellow_circle:",
    "medium-low": ":white_circle:",
    "low": ":white_circle:",
}

TAG = "islo-qa-findings"
REPORT_FENCE = re.compile(r"```qa_report\s*(.*?)```", re.S)
DUPLICATE_SIMILARITY = 0.55


def dry_run_enabled() -> bool:
    value = (os.environ.get("DRY_RUN") or "").strip().lower()
    return value not in ("", "0", "false", "no")


def log(msg: str) -> None:
    print(f"[collect] {msg}", flush=True)


def islo_json(args: list[str]):
    proc = subprocess.run(
        ["islo", *args, "-o", "json"],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        log(f"islo {' '.join(args)} failed rc={proc.returncode}: {proc.stderr[-400:]}")
        return None
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        log(f"islo {' '.join(args)} returned non-JSON ({exc}): {proc.stdout[:300]}")
        return None


def as_items(payload):
    if payload is None:
        return []
    if isinstance(payload, list):
        return payload
    for key in ("items", "data", "knowledge", "results"):
        if isinstance(payload.get(key), list):
            return payload[key]
    return [payload] if payload.get("identifier") or payload.get("id") else []


def parse_ts(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def collect_reports(lookback_hours: int) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)
    listing = as_items(islo_json(["knowledge", "list", "--tag", TAG]))
    log(f"{len(listing)} knowledge item(s) tagged {TAG}")

    reports = []
    for entry in listing:
        ident = entry.get("identifier") or entry.get("id") or entry.get("name")
        if not ident:
            continue
        detail = islo_json(["knowledge", "get", str(ident)])
        if not isinstance(detail, dict):
            log(f"skip {ident}: could not read the item")
            continue

        ts = parse_ts(entry.get("created_at") or entry.get("updated_at")) or parse_ts(
            detail.get("created_at") or detail.get("updated_at")
        )
        if ts is None:
            log(f"skip {ident}: no timestamp")
            continue
        if ts < cutoff:
            log(f"skip {ident}: older than {lookback_hours}h window")
            continue

        body = detail.get("body") or detail.get("content") or ""
        if not body:
            inner = detail.get("item") or detail.get("knowledge") or {}
            body = (inner or {}).get("body", "") if isinstance(inner, dict) else ""
        match = REPORT_FENCE.search(body or "")
        if not match:
            log(f"skip {ident}: no qa_report block")
            continue
        try:
            report = json.loads(match.group(1))
        except json.JSONDecodeError as exc:
            log(f"skip {ident}: invalid qa_report JSON ({exc})")
            continue
        report["_identifier"] = str(ident)
        reports.append(report)
        log(
            f"read {ident}: agent={report.get('agent')} run_ok={report.get('run_ok')} "
            f"findings={len(report.get('findings') or [])}"
        )
    return reports


def gate(reports: list[dict], max_findings: int):
    reasons: list[str] = []
    if not reports:
        return False, ["no agent reports in the lookback window"], [], [], 0

    seen_agents = {r.get("agent") for r in reports}
    missing = sorted(ic.EXPECTED_AGENTS - {a for a in seen_agents if a})
    if missing:
        reasons.append(f"missing agent report(s): {', '.join(missing)}")

    infra = [f"{r.get('agent')}: {e}" for r in reports for e in (r.get("infra_errors") or [])]
    if infra:
        reasons.append(f"{len(infra)} infrastructure error(s): " + "; ".join(infra[:5]))

    unhealthy = [r for r in reports if not r.get("run_ok")]
    if unhealthy:
        reasons.append(
            f"{len(unhealthy)} agent(s) did not finish cleanly: "
            + ", ".join(str(r.get("agent")) for r in unhealthy)
        )

    findings = []
    for r in reports:
        if not r.get("run_ok"):
            continue
        for f in r.get("findings") or []:
            if not str(f.get("title") or "").strip():
                continue
            f["_agent"] = r.get("agent")
            f["_target"] = r.get("target")
            findings.append(f)

    if not findings and not reasons:
        reasons.append("no validated findings with evidence")

    findings = dedupe_within_run(findings)
    findings.sort(
        key=lambda f: (
            ic.SEVERITY_ORDER.get(f.get("severity"), 9),
            ic.CONFIDENCE_ORDER.get(f.get("confidence"), 9),
            f.get("title", ""),
        )
    )
    capped_from = len(findings)
    if len(findings) > max_findings:
        log(f"capping at {max_findings} of {len(findings)} findings")
        findings = findings[:max_findings]

    targets = sorted({r.get("target") for r in reports if r.get("target")})
    return (not reasons), reasons, findings, targets, capped_from


def dedupe_within_run(findings: list[dict]) -> list[dict]:
    kept: list[dict] = []
    for f in findings:
        dup = False
        for existing in kept:
            if f.get("surface") != existing.get("surface"):
                continue
            if ic.title_similarity(f.get("title", ""), existing.get("title", "")) >= DUPLICATE_SIMILARITY:
                dup = True
                break
        if not dup:
            kept.append(f)
    return kept


def consume_reports(reports: list[dict]) -> None:
    for r in reports:
        proc = subprocess.run(
            ["islo", "knowledge", "delete", r["_identifier"]],
            capture_output=True,
            text=True,
        )
        log(f"consumed {r['_identifier']}: delete rc={proc.returncode}")


def slack_channel() -> str:
    return (os.environ.get("SLACK_CHANNEL") or os.environ.get("SLACK_CHANNEL_ID") or "").strip()


def condense(text: str | None, limit: int) -> str:
    value = " ".join((text or "").split())
    if len(value) <= limit:
        return value
    return value[: limit - 1] + "…"


def format_finding_detail(finding: dict, *, numbered: int | None = None) -> str:
    emoji = SEVERITY_EMOJI.get(finding.get("severity"), ":white_circle:")
    prefix = f"{numbered}. " if numbered is not None else ""
    steps = "\n".join(f"{i}. {s}" for i, s in enumerate(finding.get("steps") or [], 1))
    lines = [
        f"{prefix}{emoji} *{finding.get('title', 'Untitled')}*",
        f"• Agent: `{finding.get('_agent')}`",
        f"• Surface: `{finding.get('surface')}` | Severity: `{finding.get('severity')}` | "
        f"Confidence: `{finding.get('confidence')}` | Reproduced: `{finding.get('reproduced')}`",
        "",
        "*Expected*",
        finding.get("expected") or "(not provided)",
        "",
        "*Actual*",
        finding.get("actual") or "(not provided)",
    ]
    if steps:
        lines += ["", "*Steps*", steps]
    evidence = finding.get("evidence")
    if evidence:
        lines += ["", f"*Evidence file:* `{evidence}` ({finding.get('evidence_kind') or 'file'})"]
    permalink = (finding.get("slack_permalink") or "").strip()
    if permalink:
        lines += ["", f"*Recording:* <{permalink}|Open screen recording>"]
    excerpt = (finding.get("evidence_text") or "").strip()
    if excerpt:
        lines += ["", "*Transcript excerpt*", f"```{excerpt[:3500]}```"]
    return "\n".join(lines)


def build_slack_message(
    *,
    gate_open: bool,
    gate_reasons: list[str],
    reports: list[dict],
    findings: list[dict],
    targets: list[str],
    capped_from: int,
    slack_posted: bool,
    exit_code: int,
) -> str:
    run_id = os.environ.get("ISLO_LINE_RUN_ID") or os.environ.get("ISLO_RUN_ID") or "manual"
    lines = ["*Islo QA — automated run complete*"]

    if exit_code == 0:
        lines.append(":white_check_mark: Collector finished successfully.")
    else:
        lines.append(f":x: Collector exited with code {exit_code}.")

    if gate_open:
        lines.append(
            f"Notify gate: *open* — {len(findings)} finding(s) against "
            f"{', '.join(targets) or 'unknown target'}."
        )
        if slack_posted:
            lines.append(":speech_balloon: Findings and screen recordings posted to the channel.")
    else:
        lines.append("Notify gate: *closed* — no findings posted.")
        for reason in gate_reasons:
            lines.append(f"• {reason}")

    healthy = [r for r in reports if r.get("run_ok")]
    unhealthy = [r for r in reports if not r.get("run_ok")]
    lines.append(
        f"Agent reports: {len(reports)} total, {len(healthy)} healthy, {len(unhealthy)} unhealthy."
    )
    for r in reports:
        agent = r.get("agent") or "unknown"
        status = "ok" if r.get("run_ok") else "failed"
        count = len(r.get("findings") or [])
        rejected = len(r.get("rejected") or [])
        lines.append(f"• `{agent}`: {status}, {count} staged finding(s), {rejected} rejected")

    if findings:
        lines.append("")
        lines.append("*Findings:*")
        for i, f in enumerate(findings[:8], 1):
            lines.extend(["", format_finding_detail(f, numbered=i)])
        if capped_from > len(findings):
            lines.append(
                f"\n_{capped_from - len(findings)} lower-severity finding(s) omitted from this summary._"
            )

    lines += [
        "",
        f"Run id: `{run_id}`",
        "_Exploratory QA against the local fullstack environment — triage severities before acting._",
    ]
    return "\n".join(lines)


def collect_recording_files(findings: list[dict]) -> list[tuple[str, bytes, str]]:
    files: list[tuple[str, bytes, str]] = []
    for finding in findings:
        file_id = (finding.get("slack_file_id") or "").strip()
        if not file_id:
            continue
        title = str(finding.get("title") or "Screen recording")
        content, filename = slack_upload.download_file(file_id)
        files.append((filename, content, title))
    return files


def post_findings_to_slack(
    findings: list[dict],
    reports: list[dict],
) -> bool:
    channel = slack_channel()
    if not channel:
        log("SLACK_CHANNEL is not set — skipping Slack notification")
        return False

    summary = build_slack_message(
        gate_open=True,
        gate_reasons=[],
        reports=reports,
        findings=findings,
        targets=sorted({r.get("target") for r in reports if r.get("target")}),
        capped_from=len(findings),
        slack_posted=True,
        exit_code=0,
    )

    recordings = collect_recording_files(findings)
    if recordings:
        slack_upload.share_files_to_channel(
            channel,
            recordings,
            initial_comment=summary,
        )
        log(f"posted Slack summary with {len(recordings)} recording(s) to {channel}")
    else:
        resp = slack_upload.post_message(channel, summary)
        log(f"posted Slack summary to {channel} ts={resp.get('ts')}")
    return True


def notify_slack(message: str) -> None:
    channel = slack_channel()
    if not channel:
        log("SLACK_CHANNEL is not set — skipping Slack notification")
        return
    try:
        resp = slack_upload.post_message(channel, message)
        log(f"posted Slack summary to {channel} ts={resp.get('ts')}")
    except slack_upload.SlackError as exc:
        log(f"Slack notification failed: {exc}")


def main() -> int:
    lookback = int(os.environ.get("LOOKBACK_HOURS") or "6")
    max_findings = int(os.environ.get("MAX_ISSUES") or os.environ.get("MAX_FINDINGS") or "8")

    log(f"lookback={lookback}h max_findings={max_findings} slack_channel={slack_channel() or '(unset)'}")

    reports: list[dict] = []
    gate_open = False
    gate_reasons: list[str] = []
    findings: list[dict] = []
    targets: list[str] = []
    capped_from = 0
    slack_posted = False
    exit_code = 0
    crash_error: str | None = None

    try:
        reports = collect_reports(lookback)
        gate_open, gate_reasons, findings, targets, capped_from = gate(reports, max_findings)

        if not gate_open:
            log("NOTIFY GATE CLOSED — nothing posted beyond the summary:")
            for r in gate_reasons:
                log(f"  - {r}")
        else:
            log(f"gate open: {len(findings)} finding(s) for {targets}")
            if dry_run_enabled():
                log("DRY_RUN enabled — skipping Slack post and knowledge consume")
            else:
                try:
                    slack_posted = post_findings_to_slack(findings, reports)
                    if slack_posted:
                        consume_reports(reports)
                except slack_upload.SlackError as exc:
                    log(f"Slack post failed — knowledge items left for inspection: {exc}")
                    exit_code = 1

        return exit_code
    except Exception as exc:  # noqa: BLE001
        crash_error = str(exc)
        exit_code = 1
        log(f"collector crashed: {exc}")
        return exit_code
    finally:
        if not gate_open or not slack_posted:
            message = build_slack_message(
                gate_open=gate_open,
                gate_reasons=gate_reasons,
                reports=reports,
                findings=findings,
                targets=targets,
                capped_from=capped_from,
                slack_posted=slack_posted,
                exit_code=exit_code,
            )
            if crash_error:
                message += f"\n\n:warning: Collector error: `{crash_error}`"
            print("\n" + "=" * 72, flush=True)
            print(message, flush=True)
            print("=" * 72, flush=True)
            if not slack_posted:
                if dry_run_enabled():
                    log("DRY_RUN enabled — skipping Slack notification")
                else:
                    notify_slack(message)


if __name__ == "__main__":
    sys.exit(main())
