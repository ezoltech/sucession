# The Succession

A radial archive in the style of the reference video: one fixed circle at the centre, with any number of concentric layers of circles around it. Hover a circle to read its name. Click it and the camera flies in with a motion-blur zoom, and the side panel switches to that circle's details.

```bash
npm install
npm run dev
```

## Configure the formation

Everything is driven by four JSON files in `src/data/`.

### 1. `layers.json`: how many layers, and how many circles in each

One entry per layer, from the inside out. The centre circle always exists and is not listed here.

```json
[
  { "name": "First Heirs", "circles": 3 },
  { "name": "Second Heirs", "circles": 6, "rotation": 30 }
]
```

| key        | required | meaning                                                                    |
| ---------- | -------- | -------------------------------------------------------------------------- |
| `circles`  | yes      | number of circles on this layer                                            |
| `name`     | no       | label shown in the rail and panel (defaults to "Layer N")                  |
| `rotation` | no       | degrees to rotate the layer clockwise (the first circle sits at 12 o'clock) |
| `size`     | no       | circle radius for this layer (default 38; the centre is 64)                |
| `radius`   | no       | force the ring radius (by default it is computed so nothing overlaps)      |

To add a layer, add another object. For example, `{ "circles": 12 }` adds a third ring of 12.

### 2. `circles.json`: the content of each circle

`center` holds the middle circle. `layers` is an array of arrays that follows the same order as `layers.json`: the first array holds layer 1's circles, the second holds layer 2's, and so on. Circles in each array run clockwise from 12 o'clock.

```json
{
  "center": { "title": "...", "subtitle": "...", "image": "/images/...", "description": ["..."] },
  "layers": [
    [ { ... }, { ... }, { ... } ],
    [ { ... }, { ... }, { ... }, { ... }, { ... }, { ... } ]
  ]
}
```

| key             | meaning                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `title`         | name curved under the circle and shown as the panel heading                                      |
| `subtitle`      | second curved line (collector, artist and so on), shown after "In the collection of"            |
| `subtitleLabel` | optional replacement for "In the collection of"                                                  |
| `image`         | path in `public/` (for example `/images/me.jpg`) or a full URL. It is cropped to a circle.       |
| `color`         | background shown behind the image while it loads                                                |
| `description`   | a string, or an array of strings for several paragraphs                                          |
| `details`       | optional rows: `[{ "label": "Year", "value": "2024" }]`                                          |

If a layer has more circles than entries, the extra circles render as empty dashed placeholders. Extra entries are ignored. In dev mode a console warning tells you which layer doesn't match.

### 3. `cross.json`: the four circles around the centre

The whole formation is a big cross: the centre group in the middle, and one more circle straight above, below, left and right of it, each joined to the centre by a straight line. The four circles sit perfectly on the axes, at exactly the same distance.

Each of the four is written the same way, top to bottom: **the circle → its layers → how many circles each layer has → the details of each circle.**

```json
{
  "gap": 0.5,
  "size": 0.7,
  "arms": {
    "top": {
      "name": "Top",
      "center": { "title": "Top centre", "subtitle": "", "image": "", "description": [], "details": [] },
      "layers": [
        {
          "name": "",
          "circles": 0,
          "description": "",
          "members": []
        }
      ]
    },
    "right": { … same shape … },
    "bottom": { … },
    "left": { … }
  }
}
```

| key       | meaning                                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `gap`     | free thread between the rim of the centre group and the rim of an arm, as a fraction of the two sizes added together (default 0.4) |
| `size`    | radius of an arm's circle as a fraction of the middle circle's (default 0.7). An arm may set its own `size` too              |
| `name`    | label for the circle (rail, search, panel)                                                                                   |
| `center`  | the circle itself. Same fields as `center` in `circles.json`                                                                 |
| `layers`  | its rings, from the inside out. Same format as `layers.json`                                                                  |

Inside a layer:

| key           | meaning                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `circles`     | **how many circles** this layer has. `0` means the layer is not drawn                                                 |
| `members`     | **the details of each circle**, one object per circle, in clockwise order from 12 o'clock (same fields as in `layers.json`) |
| `name`, `description` | optional, for the layer itself                                                                         |

Each layer you add is another ring further out. For example, a right circle with a ring of 6 (two of them filled in) and a ring of 12:

```json
"layers": [
  {
    "name": "First ring",
    "circles": 6,
    "members": [
      { "name": "Anna", "subtitle": "…", "image": "/images/…", "description": ["…"], "details": [] },
      { "name": "Ben" }
    ]
  },
  { "name": "Second ring", "circles": 12, "members": [] }
]
```

Circles without a matching entry in `members` are drawn as empty placeholders, so you can raise `circles` first and fill in details later. Delete the layer (or set `circles` to `0`) and the arm goes back to a single circle.

**The threads follow the pattern.** The four circles sit at `(centre size + biggest arm size) × (1 + gap)` from the middle, so the thread joining each one to the centre gets longer whenever a circle is added to the centre or to any of the four, and shorter when one is removed. All four stay at the same distance, so the cross always stays symmetrical and the links stay straight. To go back to the plain single formation, drop the `cross` argument from the `buildFormation(...)` call in `App.jsx`.

### 4. `site.json`: brand and overview text

This file holds the brand name, the collection title and owner, the intro stanzas and the notes shown in the panel when nothing is selected.

## Controls

- **Hover** shows the circle's curved label.
- **Click** zooms into the circle. Click empty space or press **Esc** to fly back out.
- **← / →** (or the panel's footer) moves to the previous or next circle, going centre first and then each layer clockwise.
- **Drag** pans and **scroll** zooms.
- The little cross in the rail jumps between the centre and the four arms; the chapters below it list the layers of the group you are in.
- The rail jumps to a layer. **Replay** re-runs the intro, and the **›‹** button in the panel collapses it.

## Structure

```
src/
  data/            layers.json, circles.json, cross.json, site.json
  lib/formation.js ring layout math (radii, angles, spacing) and the cross: buildGroup (one centre + its layers) and buildFormation (centre + 4 arms + links)
  lib/easing.js    cubic-bezier easing (the reference site's motion tokens)
  components/
    Formation.jsx  SVG stage: camera, motion blur, orbits, curved labels, intro
    Panel.jsx      details panel
    Rail.jsx       left navigation rail
public/images/demo demo artwork (replace with your own)
```
