# How The Succession works

The Succession is a client-side React application that turns JSON collection data into an
interactive, zoomable radial map. Vite serves the development app and builds the static site;
there is no server-side database or API.

## Starting the app

1. `index.html` loads the font families and mounts `src/main.jsx`.
2. `src/main.jsx` imports the global stylesheet and renders `App` inside React `StrictMode`.
3. `src/App.jsx` imports the four JSON data files and calls `buildFormation(layers, circles, cross)`
   once with `useMemo`.
4. The resulting formation model is passed to the SVG stage (`Formation`), the navigation rail
   (`Rail`), and the details/search panel (`Panel`).

Run `npm install` once, then `npm run dev`. The development command first generates optimized
image variants. `npm run build` does the same before producing the static files in `dist/`.
`npm run lint` runs ESLint.

## The data model

All collection content and layout are local JSON:

- `src/data/layers.json` defines the centre group's rings, in inside-to-outside order. Each ring
  supplies its circle count and can also contain `members`, rotation, size, radius, and a description.
- `src/data/circles.json` supplies the centre circle and optional content for each centre-ring
  position. Its `layers` arrays correspond by index to `layers.json`.
- `src/data/cross.json` supplies the four directional arm centres and their rings. Its optional
  `outer` section adds a hollow ring around the entire cross.
- `src/data/site.json` supplies the brand, overview copy, owner label, and site notes.

A circle's details can include `title` (or `name`), `subtitle`, `subtitleLabel`, `image`, `color`,
`description`, and `details`. A description can be one string or multiple paragraphs. Details can
be an array of `{ "label", "value" }` rows or an object whose keys become labels.

For centre-ring members, inline `members` from `layers.json` take precedence over matching entries
in `circles.json`; fields not supplied inline fall back to `circles.json`. Layer counts control
geometry: absent entries become placeholders and surplus entries are ignored. Arm and outer-ring
members are configured inline in `cross.json`.

The checked-in configuration currently creates 459 circles: 439 in the centre group and 20 in the
four arms. The formation builder still supports an optional outer ring, but none is configured.
Empty placeholders are intentional and remain selectable.

## Building the geometry

`src/lib/formation.js` is independent of React. It normalizes the source data and builds these
collections:

- **Groups**: the centre, four arms, and optional outer ring.
- **Rings**: each circle layer, with its centre, radius, member circles, label placement, and
  thread geometry.
- **Nodes**: circle identifiers, group/ring membership, position, radius, display data, and
  clockwise index.
- **Links**: straight spokes from the centre to each arm and, when enabled, from the arms to the
  outer ring.
- **Lookup maps**: ring keys and group IDs for selection, navigation, and search.

Coordinates are in world units. Members are placed clockwise from 12 o'clock. Ring radii are
computed from circle count, circle size, and minimum spacing; dense rings shrink their circles to
fit unless the configuration explicitly fixes their size or radius. Automatic rotation can place
each new ring in the widest gap of the previous ring.

Each member also gets a thread-circle geometry that links it to its nearest predecessor. Thread
circles are grouped into a single compound SVG path per ring, rather than one DOM circle per thread.
Group extents determine how far the four arms sit from the centre and how far the optional outer
ring sits from the cross. This keeps the cross symmetric as its contents change.

`buildFormation` also computes `bounds` and `extent`, which the stage uses to choose its initial
camera scale. `searchFormation` folds case and diacritics, requires every query word to match, and
scores titles above subtitles, descriptions, details, and layer descriptions.

## Rendering and camera behavior

`src/components/Formation.jsx` renders the formation in SVG:

- The camera is one SVG transform. A `requestAnimationFrame` animation interpolates its position
  and logarithmic scale when a circle or ring is selected.
- Pointer dragging pans. The wheel zooms around the pointer so the world point beneath it stays
  fixed. Camera updates are applied directly to the SVG transform rather than triggering a React
  render every frame.
- Circle fills are painted above the connecting threads, so the SVG does not need a large mask full
  of per-circle holes. Masks are retained only for currently visible curved-label gaps and thread
  fade-out at the edge of a group.
- Layer guide circles are compound paths grouped by ring. Their hit areas use matching compound
  paths, so clicking or hovering any thread still targets the correct layer without hundreds of
  extra hit-test elements.
- Curved circle labels and their SVG text paths are created only while that node's label is visible:
  after zooming in, or while the node is hovered or selected. Long labels are measured using the
  loaded web font and scaled to fit their circle.
- Formations with at least 200 nodes use a short, simultaneous entrance for populated circles and
  skip entrance animations for empty placeholders, avoiding hundreds of long-running staggered CSS
  animations.
- Layer names are curved along the ring. Hovering a ring reveals its name; selecting it highlights
  the string and switches the panel to the layer's overview.

The current interaction state is owned by `App.jsx`. Selecting a circle clears layer selection;
selecting a layer clears circle selection. `Panel.jsx` renders overview, circle details, or layer
members accordingly. `Rail.jsx` switches among groups and their chapters. Search results can select
either a circle or a layer.

Keyboard controls are handled by `App.jsx`: the arrow keys move through circles or layers, Escape
returns to the overview (or exits fullscreen), and `S` folds/unfolds the sidebar. The panel also
supports search, previous/next navigation, and collapsing. The rail supports overview, replay, and
fullscreen. On narrow screens the rail is hidden and the panel becomes a bottom sheet.

## Images and performance

The source artwork remains under `public/images/`. JSON can continue to refer to source paths such
as `/images/demo/peter.jpg`; full external image URLs are also supported.

Before development or production builds, `scripts/optimize-images.js` uses `sharp` to create
orientation-corrected WebP variants at 256px, 384px, and 1024px maximum dimensions, at quality 80. These
generated files live under `public/images/optimized/`, which is ignored by Git and regenerated
automatically by the `predev` and `prebuild` npm lifecycle scripts. Keep the original JPEG, JPG, or
PNG source in `public/images/`; do not hand-edit the generated variants.

After Vite builds, `scripts/clean-build-images.js` removes only the copied JPEG/PNG source files
from `dist/`; the originals remain untouched in `public/images/`. The optimized WebP files are the
only raster versions sent with the production site.

The panel uses the 384px version. The initial stage view frames the centre and its first ring, and
attaches the centre portrait and first-ring portraits using their 256px variants. This keeps the
opening view useful without loading every image in the 459-circle formation. Other portraits remain
deferred: the stage requests the 1024px version only when an image-bearing circle is selected or
reaches at least 48 CSS pixels in diameter inside the visible stage. Once shown, a portrait stays in
the session's seen-image set and uses its smaller 256px version when zoomed back below that size.
Seen images are attached only while inside the stage, and browsers can reuse their cached variants
when panning back. Remote images are left as-is and are subject to their host's availability and
caching.

The SVG scene still contains all circle positions so that navigation and layer geometry are
immediately available, but expensive label paths and per-thread DOM elements are not duplicated for
every member. The panel and stage use the same optimized URL for a selected portrait.

## Styling and motion

`src/index.css` defines the layout, typography, responsive breakpoints, layer/node states, reduced
motion behavior, and light/dark theme tokens. The default theme is light; `App.jsx` applies the saved
choice to `data-theme` on the document root and persists it in local storage.

### Theme colors

The palette is defined by the CSS custom properties in [`src/index.css`](./src/index.css). The
eight-digit hex values include an alpha channel in the final two digits.

| UI role | Light | Dark |
| --- | --- | --- |
| Ink and primary text | `#0c0a09` | `#f3efe6` |
| Secondary text | `#0c0a09b3` | `#f3efe6b3` |
| Medium text | `#0c0a09a6` | `#f3efe6a6` |
| Tertiary text | `#0c0a0999` | `#f3efe699` |
| Disabled text | `#0c0a096b` | `#f3efe66b` |
| Base surface | `#e2ddd6` | `#0a0908` |
| Mid surface | `#e8e4dd` | `#100f0d` |
| Panel surface | `#eeeae3` | `#151311` |
| Raised surface | `#fafaf8` | `#1e1b18` |
| Surface wash | `#0c0a091a` | `#f3efe61a` |
| Subtle border | `#0c0a091a` | `#f3efe61a` |
| Medium border | `#0c0a0926` | `#f3efe626` |
| Strong border | `#0c0a0940` | `#f3efe640` |
| Warm accent | `#c25e09` | `#e3ab52` |
| Thumbprint accent | `#c87220` | `#d9b66a` |

Formation threads use the ink color in light mode. In dark mode, the threads and straight links use
a metallic gradient with stops `#f2dc96`, `#c9a24e`, `#e7e4dc`, `#b8984f`, and `#dcd8cf`. Dark
circle edges use `#f3efe6`; the empty-circle fill uses `#f3efe612`. These specialized SVG colors and
opacities are defined alongside the theme tokens.

`src/lib/easing.js` provides cubic-bezier easing functions used by the camera. Framer Motion animates
panel content changes.

The app also respects `prefers-reduced-motion` for the camera, drawn geometry, and guide fade-in.

## Main files

| File | Responsibility |
| --- | --- |
| `src/main.jsx` | React entry point |
| `src/App.jsx` | Data loading, selection state, stage sizing, theme, keyboard, and page controls |
| `src/lib/formation.js` | Data normalization, layout math, cross construction, colors, and search |
| `src/lib/images.js` | Maps local source image URLs to generated WebP URLs |
| `scripts/optimize-images.js` | Generates the ignored responsive WebP files |
| `src/components/Formation.jsx` | SVG scene, camera, label visibility, image loading, and interactions |
| `src/components/Panel.jsx` | Search, details, layer membership, and paging |
| `src/components/Rail.jsx` | Group and layer navigation |
| `src/index.css` | Visual system, responsive layout, and themes |
