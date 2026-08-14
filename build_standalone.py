#!/usr/bin/env python3
"""Pack TAKT into one HTML file the tablet can open from Downloads."""

from __future__ import annotations

import base64
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUB = ROOT / "public"
OUT = ROOT / "TAKT.html"

ORDER = ["db.js", "store.js", "library.js", "audius.js", "engine.js", "ui.js", "app.js"]


def strip_js(src: str) -> str:
    src = re.sub(r"^import\s+.*?from\s+['\"].*?['\"];?\s*$", "", src, flags=re.M)
    src = re.sub(r"^export\s+\{[^}]*\};?\s*$", "", src, flags=re.M)
    src = re.sub(r"^export\s+", "", src, flags=re.M)
    src = re.sub(r"const\s*\{\s*(\w+)\s*\}\s*=\s*await import\([^)]+\);\s*", "", src)
    return src


def main() -> None:
    css = (PUB / "css" / "app.css").read_text(encoding="utf-8")
    icon = (PUB / "icons" / "icon-512.jpg").read_bytes()
    icon_uri = "data:image/jpeg;base64," + base64.b64encode(icon).decode("ascii")
    chunks = []
    for name in ORDER:
        chunks.append(f"\n/* ---- {name} ---- */\n")
        chunks.append(strip_js((PUB / "js" / name).read_text(encoding="utf-8")))
    js = "\n".join(chunks)
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
  <meta name="theme-color" content="#070709" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <title>TAKT</title>
  <link rel="icon" href="{icon_uri}" />
  <style>
{css}
  </style>
</head>
<body>
  <div id="app"></div>
  <input id="file-clips" class="hidden-file" type="file" accept="video/*,image/*" multiple />
  <input id="file-audio" class="hidden-file" type="file" accept="audio/*" multiple />
  <script>
window.TAKT_ICON = {icon_uri!r};
{js}
  </script>
</body>
</html>
"""
    OUT.write_text(html, encoding="utf-8")
    desktop = Path.home() / "Desktop" / "TAKT.html"
    desktop.write_text(html, encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")
    print(f"wrote {desktop}")


if __name__ == "__main__":
    main()
