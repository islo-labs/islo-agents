"""Red-team Factory line harness entrypoints."""

from __future__ import annotations

import sys

from . import cleanup, notify, prepare


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    if len(argv) != 1:
        print(
            "usage: python3 -m harness "
            "{prepare-cli|prepare-black-box|prepare-report|cleanup-check|notify-slack}",
            file=sys.stderr,
        )
        return 2

    commands = {
        "prepare-cli": prepare.prepare_cli,
        "prepare-black-box": prepare.prepare_black_box,
        "prepare-report": prepare.prepare_report,
        "cleanup-check": cleanup.cleanup_check,
        "notify-slack": notify.post_slack,
    }
    handler = commands.get(argv[0])
    if handler is None:
        print(f"unknown command: {argv[0]}", file=sys.stderr)
        return 2
    return handler()


if __name__ == "__main__":
    raise SystemExit(main())
