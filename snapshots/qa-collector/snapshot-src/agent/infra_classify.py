"""Shared infrastructure-error classification for Islo QA agents."""

from __future__ import annotations

import re

INFRA_PATTERNS = [
    r"credential injection",
    r"api error:\s*4\d\d",
    r"api error:\s*5\d\d",
    r"failed to authenticate",
    r"anthropic",
    r"gateway\.islo\.dev",
    r"invalid request parameters",
    r"model is not allowed",
    r"playwright.*not installed",
    r"cannot find module",
    r"err_cert",
    r"self.signed certificate",
    r"net::err_failed",
    r"storage state.*(missing|expired)",
    r"\bSKIP_AUTH\b",
    r"linear.*(401|403)",
    r"rate limit",
    r"ENOTFOUND",
    r"ECONNREFUSED",
]
INFRA_RE = re.compile("|".join(INFRA_PATTERNS), re.I)

SEVERITIES = {"critical", "high", "medium-high", "medium", "medium-low", "low"}
SURFACES = {"web", "cli"}
CONFIDENCE_LEVELS = {"high", "medium", "low"}

SEVERITY_ORDER = {
    "critical": 0,
    "high": 1,
    "medium-high": 2,
    "medium": 3,
    "medium-low": 4,
    "low": 5,
}

CONFIDENCE_ORDER = {"high": 0, "medium": 1, "low": 2}

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


def normalize_title(title: str) -> set[str]:
    tokens = re.findall(r"[a-z0-9]+", (title or "").lower())
    return {t for t in tokens if len(t) > 2}


def title_similarity(a: str, b: str) -> float:
    sa, sb = normalize_title(a), normalize_title(b)
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)
