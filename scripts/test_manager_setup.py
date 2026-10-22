"""Guard the documented Manager Machine deployment prerequisites."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

for slug in ("feature-delivery", "designer-line"):
    readme = (ROOT / "examples" / slug / "README.md").read_text()
    machine = f"{slug}-manager"
    create = f"islo factory machine create {machine} --repo "
    inspect = f"islo factory machine get {machine}"
    assert create in readme, f"{slug}: Machine create needs --repo"
    assert inspect in readme, f"{slug}: Machine readiness check missing"
    assert readme.index(create) < readme.index(inspect) < readme.index("islo agent create")
print("Manager Machine setup: OK")
