# Henry Klatt — academic website

A professional academic site drafted from `cv/henry_klatt_cv.tex`, with research,
preprints and work in preparation, teaching, selected talks, service,
and contact details. The CV content snapshot is from October 4, 2026.

The site has six pages: Home, Research (including papers and talks), Teaching,
Resources for students, Service, and CV. The home page contains the requested welcome, the Lichess daily
puzzle, and contact details. The CV page contains the PDF download.

## Preview and build

Requires Node.js 22.13 or later.

```sh
npm ci --ignore-scripts
npm run dev
```

The live local preview uses the bundled Sites/vinext structure. The GitHub Pages
export uses the same `AcademicSite` component and stylesheet, rendered to plain
HTML. No server is needed on GitHub.

```sh
npm run build:pages
npm test
```

The complete standalone website is in `out/`. You can open `out/index.html`
using a local HTTP server. The development preview includes every page.
Navigation and the downloadable CV work without JavaScript.

## Publishing on GitHub

Repository: [WashingApples/HenryKlattMath](https://github.com/WashingApples/HenryKlattMath).
Website: [Henry Klatt](https://washingapples.github.io/HenryKlattMath/).
ORCID: [0009-0004-3329-1657](https://orcid.org/0009-0004-3329-1657).

Publish only this `website` directory to the GitHub repository. Do not
upload the surrounding job-application workspace. Choose **GitHub Actions** in
the repository's **Settings → Pages → Build and deployment → Source**. The
included workflow publishes on pushes to `main`, or when manually triggered.

The workflow obtains the actual GitHub Pages URL automatically. Asset paths are
relative, supporting both a username site and a repository site. To build with a
known canonical URL locally:

```sh
SITE_URL=https://washingapples.github.io/HenryKlattMath npm run build:pages
```

The source configuration follows [GitHub's Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Editing

- `app/site.tsx`: biography, research, papers, talks, and teaching entries.
- `app/globals.css`: colors, typography, spacing, and responsive layout.
- `public/henry-klatt-cv.pdf`: downloadable CV; replace when the CV changes.
- `public/email-contact.png`: the exact CAPTCHA image supplied by the user.
- `public/og-blue.png`: matching social-preview card.
- `app/research/page.tsx`, `app/teaching/page.tsx`, `app/resources/page.tsx`, `app/service/page.tsx`, `app/cv/page.tsx`: page routes.

Paper status is deliberate: one preprint and three works in preparation. The
doctorate is shown as expected spring 2027, and the Oaxaca workshop as scheduled.

## Email image

The email appears as a CAPTCHA-style image. The initial HTML has no plain-text
email or `mailto:` link, and the JavaScript contains no encoded address or reveal
function. Visitors who need selectable text can use the downloadable CV, which
is unchanged as requested. This discourages basic address harvesting, but OCR
can still read the image and scrapers can extract the address from the CV.

## Lichess daily puzzle

The home page has a playable board that loads the current puzzle from
[Lichess's public API](https://lichess.org/api#tag/Puzzles/operation/apiPuzzleDaily).
Visitors can select or drag pieces, use arrow keys and Enter/Space, choose pawn
promotions, ask for a hint, and restart. Correct moves trigger the opponent's
reply; incorrect moves leave the position unchanged. Validation follows the
published solution. Play here is unrated and does not update a Lichess account.

`public/puzzle-session.js` uses chess.js 1.4.0 for legal moves. The library and
piece images are served locally, with attribution and licenses preserved in
`public/chess-pieces/ATTRIBUTION.md` and `public/vendor/chess-LICENSE.txt`.
`public/puzzle.js` handles board interaction and loading. It fetches once on
opening the page and refreshes when returning to a tab on a new UTC date.
Network failures show a retry control and a direct link to Lichess.

The same scripts work on GitHub Pages, including repository subpaths, without
a server or API key. JavaScript and a connection to Lichess are needed to play.

## Image assets

The contact image is copied byte-for-byte from the user's supplied PNG. Its file
is not regenerated or modified. In dark mode, a CSS filter makes the lettering
light and blends the image background into the page. The former generated email
image was removed.

The existing social-preview card was created with the built-in image generation
tool: a white landscape card with navy sans-serif text containing the name,
Ph.D. student role, and university affiliation, with no slogans or decoration.

## Color preference

All six pages follow the browser's light/dark preference automatically through
`prefers-color-scheme`. The blue headings and links, muted text, borders, text
selection, and browser theme colors adapt together. The **Dark mode** toggle at
the top right switches between light and dark and remembers the choice only for
the current tab's visit. A new visit follows the browser by default, including
for users who previously saved a permanent override. Toggling back to the browser's
current theme resumes following its preference, with no separate reset button.
If storage is unavailable, switching still works on the current page.
The puzzle controls follow the selected theme without resetting play;
the chessboard keeps its blue squares in both modes.
