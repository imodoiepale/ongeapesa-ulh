#!/usr/bin/env python3
"""Inline the brand artwork into the pitch deck so the published page is self-contained.

The artifact host blocks every external request, so each image has to travel with the
HTML as a data URI. Run from anywhere:

    python3 "Product Launch/06_Pitch_Deck/build.py"
"""

import base64
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SRC = HERE / "deck.src.html"
OUT = HERE / "ongea-pesa-loop-deck.html"

ART = {
    "__ORB__": "public/brand/orbital/voice-core-dark.webp",
    "__VOICE__": "public/brand/orbital/backgrounds/voice-dark.webp",
    "__TRUST__": "public/brand/orbital/backgrounds/trust-dark.webp",
    "__CHAMA__": "public/brand/orbital/backgrounds/chama-dark.webp",
}


def main() -> int:
    html = SRC.read_text(encoding="utf-8")

    for token, rel in ART.items():
        path = ROOT / rel
        if not path.is_file():
            print(f"missing artwork: {rel}", file=sys.stderr)
            return 1
        uri = "data:image/webp;base64," + base64.b64encode(path.read_bytes()).decode("ascii")
        if token not in html:
            print(f"token {token} not found in deck.src.html", file=sys.stderr)
            return 1
        html = html.replace(token, uri)

    OUT.write_text(html, encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)} — {OUT.stat().st_size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
