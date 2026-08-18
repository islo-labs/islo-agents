"""Red-team Factory line harness entrypoints."""

from __future__ import annotations

import sys

from . import notify, prepare


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    if len(argv) != 1:
        print(
            "usage: python3 -m harness {prepare-cli|prepare-report|notify-slack}",
            file=sys.stderr,
        )
        return 2

    commands = {
        "prepare-cli": prepare.prepare_cli,
        "prepare-report": prepare.prepare_report,
        "notify-slack": notify.post_slack,
    }
    handler = commands.get(argv[0])
    if handler is None:
        print(f"unknown command: {argv[0]}", file=sys.stderr)
        return 2
    return handler()


if __name__ == "__main__":
    raise SystemExit(main())
