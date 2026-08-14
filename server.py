#!/usr/bin/env python3
"""TAKT — local video editor for your tablet. Serves the app on your LAN."""

from __future__ import annotations

import os
import socket
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from qrcodegen import QrCode

PUBLIC = ROOT / "public"
DEFAULT_PORT = 7755


def _utf8_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


def local_ips() -> list[str]:
    found: list[str] = []
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))
        found.append(probe.getsockname()[0])
        probe.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in found:
                found.append(ip)
    except OSError:
        pass
    out = [ip for ip in found if not ip.startswith("127.")]
    return out or ["127.0.0.1"]


def qr_ascii(text: str) -> str:
    qr = QrCode.encode_text(text, QrCode.Ecc.MEDIUM)
    n = qr.get_size()
    border = 2
    lines = []
    for y in range(-border, n + border, 2):
        row = []
        for x in range(-border, n + border):
            top = 0 <= y < n and 0 <= x < n and qr.get_module(x, y)
            bot = 0 <= y + 1 < n and 0 <= x < n and qr.get_module(x, y + 1)
            if top and bot:
                row.append("█")
            elif top:
                row.append("▀")
            elif bot:
                row.append("▄")
            else:
                row.append(" ")
        lines.append("  " + "".join(row))
    return "\n".join(lines)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        sys.stdout.write("  " + (fmt % args) + "\n")
        sys.stdout.flush()

    def guess_type(self, path: str) -> str:
        if path.endswith(".js"):
            return "text/javascript; charset=utf-8"
        if path.endswith(".webmanifest") or path.endswith("manifest.json"):
            return "application/manifest+json"
        return super().guess_type(path)


def main() -> int:
    _utf8_stdio()
    os.chdir(PUBLIC)
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass

    httpd = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    ips = local_ips()
    url = f"http://{ips[0]}:{port}/"
    print()
    print("  TAKT")
    print("  Cut to the music.")
    print()
    print(f"  On this PC:   http://127.0.0.1:{port}/")
    print(f"  On tablet:    {url}")
    for extra in ips[1:]:
        print(f"                http://{extra}:{port}/")
    print()
    print("  Same Wi-Fi as this PC. Scan:")
    print()
    print(qr_ascii(url))
    print()
    print("  Leave this window open. Close it to stop.")
    print("  Tablet tip: Chrome → menu → Add to Home screen.")
    print()
    print("  If the tablet cannot open it, Admin PowerShell once:")
    print(
        f'  netsh advfirewall firewall add rule name="TAKT LAN" '
        f"dir=in action=allow protocol=TCP localport={port} profile=private"
    )
    print()
    try:
        webbrowser.open(f"http://127.0.0.1:{port}/")
    except Exception:
        pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  TAKT stopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
