# loganmears.com

Hand-written static site: HTML, CSS and ES modules. No build step, no dependencies.
Everything deployable lives in `site/` and is published by `.github/workflows/pages.yml`.

- `site/index.html`: all content (hero, timeline, games, toolkit, contact)
- `site/assets/styles.css`: design system, light/dark themes
- `site/assets/js/`: `main.js` (entry), `wordle.js`, `cipher.js`, `palette.js` (Cmd+K), `sound.js`, `words.js`

Preview locally: `python3 -m http.server --directory site 8000`, then open http://localhost:8000.
