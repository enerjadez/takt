#!/usr/bin/env python3
"""Pack TAKT into one HTML file the tablet can open from Downloads."""

from __future__ import annotations

import base64
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUB = ROOT / "public"
OUT = ROOT / "TAKT.html"
ORDER = ["db.js", "store.js", "library.js", "audius.js", "engine.js", "ui.js", "app.js"]


def strip_js(src: str) -> str:
    # Multiline and single-line ES imports
    src = re.sub(
        r"^\s*import\s+(?:type\s+)?[\s\S]*?from\s+['\"][^'\"]+['\"]\s*;?\s*$",
        "",
        src,
        flags=re.M,
    )
    src = re.sub(r"^\s*import\s+['\"][^'\"]+['\"]\s*;?\s*$", "", src, flags=re.M)
    src = re.sub(r"^\s*export\s+\{[^}]*\}\s*;?\s*$", "", src, flags=re.M)
    src = re.sub(r"^\s*export\s+default\s+", "", src, flags=re.M)
    src = re.sub(r"^\s*export\s+", "", src, flags=re.M)
    src = src.replace("</script>", "<\\/script>")
    return src


def leftover_imports(src: str) -> list[str]:
    bad = []
    for i, line in enumerate(src.splitlines(), 1):
        s = line.strip()
        if s.startswith("import {") or s.startswith("import ") and " from " in s:
            if "importMediaFile" in s:
                continue
            bad.append(f"{i}: {s[:160]}")
    return bad


def main() -> None:
    css = (PUB / "css" / "app.css").read_text(encoding="utf-8")
    icon = (PUB / "icons" / "icon-512.jpg").read_bytes()
    icon_uri = "data:image/jpeg;base64," + base64.b64encode(icon).decode("ascii")
    chunks = []
    for name in ORDER:
        chunks.append(f"\n/* ---- {name} ---- */\n")
        chunks.append(strip_js((PUB / "js" / name).read_text(encoding="utf-8")))
    js = "\n".join(chunks)
    bad = leftover_imports(js)
    if bad:
        print("leftover imports:\n" + "\n".join(bad))
        raise SystemExit(2)

    tmp = ROOT / "_bundle_check.js"
    tmp.write_text(js, encoding="utf-8")
    check = subprocess.run(["node", "--check", str(tmp)], capture_output=True, text=True)
    tmp.unlink(missing_ok=True)
    if check.returncode != 0:
        print(check.stderr or check.stdout)
        raise SystemExit(3)

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
  .boot-fail {{
    margin: 40px 24px;
    max-width: 560px;
    color: #f4f4f7;
    font-family: Manrope, Segoe UI, Roboto, sans-serif;
  }}
  .boot-fail h1 {{ font-family: Syne, sans-serif; letter-spacing: -0.04em; }}
  .boot-fail pre {{
    white-space: pre-wrap;
    background: #16161c;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 12px;
    color: #ff8aa0;
  }}
  </style>
</head>
<body>
  <div id="app">
    <div class="home" id="boot-splash">
      <div class="home-top">
        <div class="brand">
          <img src="{icon_uri}" alt="" />
          <div>
            <h1>TAKT</h1>
            <p>Opening… if this stays here, open the file in Chrome (not Files preview).</p>
          </div>
        </div>
      </div>
    </div>
  </div>
  <input id="file-clips" class="hidden-file" type="file" accept="video/*,image/*" multiple />
  <input id="file-audio" class="hidden-file" type="file" accept="audio/*" multiple />
  <script>
  window.onerror = function (msg, src, line, col, err) {{
    var app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = '<div class="boot-fail"><h1>TAKT hit a snag</h1><p>Open this file in <b>Chrome</b>. The Files app preview cannot run it.</p><pre>' +
      String(msg) + (line ? ("\\nline " + line) : "") + '</pre></div>';
  }};
  </script>
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
