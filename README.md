# The Succession

[![Star on GitHub](https://img.shields.io/badge/GitHub-Star%20this%20project-c25e09?style=flat-square&logo=github)](https://github.com/ezoltech/sucession/)

**The Succession** is an interactive, zoomable radial archive built to visualize **Ethiopian Orthodox Tewahedo Church (EOTC)** Christology, apostolic succession, and saint commemoration around a central Christological core.

One fixed circle sits at the center—**Our Lord, God, and Savior Jesus Christ**—surrounded by concentric rings of His Apostles, the 36 Holy Women, the 72 Disciples, and the 318 Orthodox Fathers of Nicaea, framed by a symmetrical four-arm cross representing the Prophets, the Virgin Mary, Monastic Fathers, and Martyrs.

Hover any circle to reveal its curved Ge'ez/Amharic label, click to smoothly zoom in with logarithmic camera flight and motion blur, and explore each saint's Synaxarium feast days, hagiography, and scriptural witness in the side panel.

> **Preview Screenshot:** *(To be added after capturing the live app screenshot — e.g. `./docs/screenshot.png`)*

---

## What the Archive Covers

The checked-in configuration renders **459 circles** across a central radial group (**439 circles**) and a four-arm cross (**20 circles**):

### Center Circle (`src/data/circles.json`)
* **እግዚእነ ወአምላክነ ወመድሃኒነ ኢየሱስ ክርስቶስ (Jesus Christ):** Includes Ge'ez passages from the Gospels (John 1:1–14, John 3:13–16) and Pauline Epistles (1 Timothy 3:16), a Ge'ez summary of His salvific economy (*ነገረ ድኅነት*) from the Ethiopian Synaxarium and Liturgy, and the **9 Major Feasts** (`፱ቱ ዓበይት በዓላት`) and **9 Minor Feasts** (`፱ቱ ንኡሳን በዓላት`) of the Lord alongside monthly commemorations (`በ፳፱`).

### Concentric Center Layers (`src/data/layers.json`)
1. **Layer 1 — `፲፪ቱ ሃዋርያት ቅዱሳን` (The 12 Holy Apostles · 12 circles):** Complete Amharic biographies, individual feast days, and shared feasts (`ሰኔ ፳–፳፩`, `ሐምሌ ፭`) from `መጽሐፈ ስንክሳር`.
2. **Layer 2 — `፴፮ቱ ቅዱሳት አንስት` (The 36 Holy Women · 36 circles):** Complete Amharic Synaxarium histories and feast days for the holy women who served Christ and the early Church (collectively commemorated on `የቅዱሳት አንስት ሰንበት`).
3. **Layer 3 — `፸፪ቱ አርድዕት` (The 72 Disciples · 72 circles, 52 populated + 20 placeholders):** Includes the Seven Deacons, Evangelists St. Mark and St. Luke, St. Paul and his co-workers, and early apostolic bishops, with Amharic `መጽሐፈ ስንክሳር` feast dates, Romans 16 / Acts citations, and collective commemoration (`ሐምሌ ፬`).
4. **Layer 4 — `፫፻፲፰ቱ ርቱዐነ ሃይማኖት` (The 318 Orthodox Fathers of Nicaea · 318 circles, 15 populated + 303 placeholders):** Key defender bishops of the First Council of Nicaea (325 A.D.), featuring both their collective Council feast (`ኅዳር ፱`) and individual Synaxarium repose days.

### Cross Arms (`src/data/cross.json`)
Four directional arms symmetrically linked to the center:
* **Top (`ቅዱሳን ነቢያት አበዊነ`):** `አዳም አቡነ` (Adam) + 1 ring of 4 placeholders
* **Right:** `እግዝእትነ ቅድስት በክልኤ ማርያም ወላዲተ አምላክ` (St. Mary, Mother of God) + 1 ring of 4 placeholders
* **Bottom:** `ርዕሰ መነኮሳት አባ እንጦንስ ገዳማዊ` (St. Anthony the Great) + 1 ring of 4 placeholders
* **Left:** `ሊቀ ሰማዕታት ማር ቅዱስ ጊዮርጊስ` (St. George) + 1 ring of 4 placeholders

---

## References & Sources Used

* **Ethiopian Synaxarium (`መጽሐፈ ስንክሳር`):** Primary source for annual feast days (`ዓመታዊ በዓል`), martyrdom/repose accounts, translation of relics, and collective commemorations (`ኅዳር ፱`, `ሐምሌ ፬`, `ሐምሌ ፭`, `ሰኔ ፳–፳፩`).
* **Holy Bible (Ge'ez & Amharic — `መጽሐፍ ቅዱስ`):**
  * Gospels of John (`ዮሐ. ፩፥፩–፲፬`, `ዮሐ. ፫፥፲፫–፲፮`) and Mark (`ማር. ፲፭፥፳፩`), Luke (`ሉቃ. ፲፥፩`)
  * Acts of the Apostles (`ሐዋ. ፮`, `ሐዋ. ፱`, `ሐዋ. ፲፫`, `ሐዋ. ፲፯`, `ሐዋ. ፳`)
  * Pauline Epistles (`ሮሜ ፲፮`, `ፊል. ፪`, `፩ ጢሞ. ፫፥፲፮`, `ወደ ፊልሞና`)
* **Ethiopic Liturgy & Patristic Tradition:** Anaphora commemorations (`ጸሎተ ቅዳሴ`), the Nicene Creed (`ጸሎተ ሃይማኖት`, Council of Nicaea 325 A.D.), and the *Ethiopic Didascalia* / Apostolic Constitutions (`ዲዳስቅልያ`) for early episcopal sees of the Seventy Disciples.
* **Coptic & Eastern Orthodox Synaxaria:** Cross-referenced (using the shared Alexandrian/Ethiopian calendar mapping) for early apostolic disciples whose individual feast days are preserved in wider Orthodox tradition.

---

## Features & Controls

* **Interactive SVG Camera:** Drag to pan, scroll to zoom around the cursor, and click any circle or ring to trigger a smooth logarithmic camera flight (`src/components/Formation.jsx`).
* **Curved Typography & Sacred Geometry:** Each layer weaves connecting thread circles to its predecessor ring; labels curve around each circle and dynamically measure web-font widths to fit.
* **Search & Navigation Rail:** Multi-word, diacritic-folded search (`searchFormation`), group cross switcher (`Rail.jsx`), breadcrumb history, and previous/next circle or layer paging (`Panel.jsx`).
* **Themes & Modes:** Light (parchment) and Dark (obsidian with metallic gold/silver gradients) themes, foldable sidebar (`S`), replay intro animation, and fullscreen immersive mode (`Esc` to exit/reset), plus a quick **Star on GitHub** action in the top-right bar.
* **Responsive Image Pipeline:** Local `.jpg`/`.png` artwork in `public/images/` is automatically converted via `sharp` (`scripts/optimize-images.js`) into `256px`, `384px`, and `1024px` `.webp` variants and lazily loaded based on viewport visibility and zoom level.

---

## Getting Started

```bash
npm install
npm run dev
```

* `npm run dev` — generates optimized WebP variants and starts the Vite development server.
* `npm run build` — optimizes images, builds the static bundle into `dist/`, and cleans raw source image copies from `dist/`.
* `npm run lint` — runs ESLint across the codebase.

For full architectural details, geometry math, and performance notes, see [howitworks.md](./howitworks.md).

---

## Configuring the Formation

All content and ring geometry are driven by four JSON files in `src/data/`:

* [`src/data/layers.json`](./src/data/layers.json) — concentric rings (`name`, `circles`, `rotation`, `size`, `radius`, `description`, `members`).
* [`src/data/circles.json`](./src/data/circles.json) — center circle (`center`) and fallback per-layer content.
* [`src/data/cross.json`](./src/data/cross.json) — four directional cross arms (`top`, `right`, `bottom`, `left`) and optional `outer` ring.
* [`src/data/site.json`](./src/data/site.json) — brand title, overview copy, and sidebar notes.

## Structure

```text
src/
  data/            layers.json, circles.json, cross.json, site.json
  lib/
    formation.js   ring layout math, cross/thread geometry, colors, and search
    easing.js      cubic-bezier motion tokens
    images.js      responsive WebP URL resolver
  components/
    Formation.jsx  SVG stage, camera flight, motion blur, curved labels, lazy images
    Panel.jsx      search, minimap, details view, layer member list, paging
    Rail.jsx       cross group switcher, layer chapters, overview/replay/fullscreen
scripts/
  optimize-images.js     Sharp WebP generator (256px / 384px / 1024px)
  clean-build-images.js  strips raw source images from dist/ after build
public/images/demo/      artwork assets
```

---

If you find this archive helpful, please consider giving it a star on GitHub: **[github.com/ezoltech/sucession](https://github.com/ezoltech/sucession/)**
