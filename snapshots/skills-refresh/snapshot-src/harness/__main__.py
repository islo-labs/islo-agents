"""Weekly skills refresh harness entrypoints."""

from __future__ import annotations

import sys

from . import checkout, collect, publish


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    if len(argv) != 1:
        print(
            "usage: python3 -m harness {checkout|collect|publish}",
            file=sys.stderr,
        )
        return 2

    commands = {
        "checkout": checkout.checkout_skills,
        "collect": collect.collect_changes,
        "publish": publish.publish_skills,
    }
    handler = commands.get(argv[0])
    if handler is None:
        print(f"unknown command: {argv[0]}", file=sys.stderr)
        return 2
    return handler()


if __name__ == "__main__":
    raise SystemExit(main())
