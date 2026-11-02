# startup84.hensap.id

The marketing site for Startup '84, plus its privacy policy and support pages. Static, hosted on
GitHub Pages.

- `index.html`, `css/site.css`, `js/main.js`: the page; three.js from jsDelivr (pinned).
- `js/room.js`: the isometric room, drawn from the game's baked art (`assets/iso`, from the game's
  `Tools/bake_iso.py`) with the engine's layout (`data/iso.json`).
- `privacy/`, `support/`: linked from the App Store listing.
- Sysfont by Alina Sava, SIL Open Font License (`assets/fonts/OFL.txt`).

Preview: `python3 -m http.server 8484`.
