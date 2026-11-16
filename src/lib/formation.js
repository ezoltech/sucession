// Builds the radial formation: one fixed centre circle plus N concentric layers.
// All values are in "world units"; the camera maps them to screen pixels.

export const CENTER_R = 64; // radius of the centre circle
export const NODE_R = 38; // default radius of every layer circle
const FIRST_GAP = 64; // gap between the centre circle edge and layer 1 circle edges
const RING_GAP = 40; // gap between the circle edges of two neighbouring layers
const MIN_SPACING = 1.3; // neighbours on one ring keep at least 1.3 × diameter apart (centre to centre)
const NAME_FS_MIN = 4; // font size range (world units) of the layer name written on a string
const NAME_FS_MAX = 14;

// ───────── Theme colours ─────────
// A circle that has no "color" in circles.json gets one from this earthy palette, which is
// built from the site's own tones (ember, tidewater, ochre, bone, charcoal, oxblood, verdigris…).
const CENTER_COLOR = "#b4491c"; // used when the centre circle has no colour of its own
const COLOR_PLACEHOLDERS = true; // also tint circles that exist in layers.json but have no entry in circles.json yet
const THEME_PALETTE = [
  "#a9441a", // ember
  "#3a6a70", // tidewater
  "#c38d1f", // ochre
  "#5d7d92", // steel
  "#7a2416", // oxblood
  "#cfc6b8", // bone
  "#4d7563", // verdigris
  "#b37a32", // amber
  "#26333c", // charcoal
  "#c25e09", // accent (--accent-warm)
  "#6e5a46", // walnut
  "#7f9a8c", // sage
];
// When there are more circles than palette entries the palette repeats in a slightly
// lighter / darker / hue-shifted tone, so it still looks like the same family.
const TONE_SHIFTS = [
  { h: 0, l: 0 },
  { h: 8, l: 9 },
  { h: -8, l: -9 },
  { h: 16, l: 16 },
  { h: -16, l: -15 },
];
// Bold versions of the same family, used to light up a layer string when it is clicked.
const HIGHLIGHT_PALETTE = [
  "#c25e09", // accent orange
  "#b8431a", // ember
  "#8f2a1c", // oxblood
  "#1f6b75", // deep tidewater
  "#2d7a58", // deep verdigris
  "#3f6f9a", // steel blue
  "#b8780f", // gold ochre
];
// The same family, brighter, so a lit string still pops on the black background of dark mode.
const HIGHLIGHT_PALETTE_DARK = [
  "#f08a2c", // orange
  "#ee6b43", // ember
  "#e4566b", // oxblood, lifted
  "#44bfcf", // tidewater
  "#52c48f", // verdigris
  "#78aee0", // steel
  "#f2c14e", // gold
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

function hslToHex(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const ss = s / 100;
  const ll = l / 100;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n) => {
    const k = (n + hh / 30) % 12;
    return ll - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  const hex = (x) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

/**
 * Theme-matched colour for the circle at (layer, index).
 * It depends only on those two numbers, so adding circles or layers never recolours existing ones,
 * and neighbours on a ring always get different palette entries.
 */
export function themeColor(layer, index) {
  const raw = Math.max(0, layer - 1) * 3 + index;
  const base = THEME_PALETTE[raw % THEME_PALETTE.length];
  const shift =
    TONE_SHIFTS[Math.floor(raw / THEME_PALETTE.length) % TONE_SHIFTS.length];
  if (!shift.h && !shift.l) return base;
  const [h, s, l] = hexToHsl(base);
  return hslToHex(h + shift.h, s * 0.88, clamp(l + shift.l, 20, 78));
}

/**
 * Random bold highlight colour for a clicked layer string. Always from the theme family
 * (slightly jittered so it is never exactly the same twice) and never close to `prev`.
 * `dark` picks the brighter set that reads on the dark-mode background.
 */
export function randomHighlight(prev = null, dark = false) {
  const palette = dark ? HIGHLIGHT_PALETTE_DARK : HIGHLIGHT_PALETTE;
  const hueDist = (a, b) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  };
  const prevHue = prev ? hexToHsl(prev)[0] : -999;
  const far = palette.filter((c) => hueDist(hexToHsl(c)[0], prevHue) > 20);
  const pool = far.length ? far : palette;
  const base = pool[Math.floor(Math.random() * pool.length)];
  const [h, s, l] = hexToHsl(base);
  return hslToHex(
    h + (Math.random() * 16 - 8),
    clamp(s + (Math.random() * 10 - 5), 35, 90),
    dark
      ? clamp(l + (Math.random() * 8 - 4), 52, 72)
      : clamp(l + (Math.random() * 8 - 4), 28, 48),
  );
}

const toArray = (v) =>
  Array.isArray(v) ? v : v == null || v === "" ? [] : [v];

// details can be [{ label, value }, …] or a plain { "Label": "value", … } object
function toDetails(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object")
    return Object.entries(v).map(([label, value]) => ({ label, value }));
  return [];
}

function normalise(raw, fallbackTitle, autoColor = null) {
  const d = raw && typeof raw === "object" ? raw : null;
  return {
    title: d?.title || d?.name || fallbackTitle,
    subtitle: d?.subtitle || "",
    subtitleLabel: d?.subtitleLabel,
    image: d?.image || null,
    // an explicit colour in circles.json always wins; otherwise the theme colour is used
    color: d?.color || (d || COLOR_PLACEHOLDERS ? autoColor : null),
    description: toArray(d?.description),
    details: toDetails(d?.details),
    isPlaceholder: !d,
  };
}

/**
 * Rotation that gives a layer the most breathing room against the layer before it.
 * Every previous node sits somewhere inside one "step" of this layer (step = 360 / count);
 * the best rotation puts this layer's nodes in the middle of the widest empty stretch.
 * (3 → 6 gives 30°, 12 → 72 gives 2.5° …)
 */
function autoRotation(step, prevAngles) {
  if (!prevAngles.length) return 0;
  const res = prevAngles
    .map((a) => (((a + 90) % step) + step) % step)
    .sort((a, b) => a - b);
  let best = -1;
  let mid = 0;
  for (let i = 0; i < res.length; i++) {
    const from = res[i];
    const to = i === res.length - 1 ? res[0] + step : res[i + 1];
    if (to - from > best + 1e-9) {
      best = to - from;
      mid = from + (to - from) / 2;
    }
  }
  return mid % step;
}

// ───────── Cross layout ─────────
// The formation is a cross: the original centre group plus one more circle straight above, below,
// left and right of it. Every one of them is built by the same code (buildGroup), so an arm is a
// centre circle exactly like the middle one: it stays a single circle until layers are added to it
// in cross.json, and then it grows its own rings, threads and members the same way the centre does.
const ARMS = [
  { dir: "top", id: "t", dx: 0, dy: -1, name: "Top" },
  { dir: "right", id: "r", dx: 1, dy: 0, name: "Right" },
  { dir: "bottom", id: "b", dx: 0, dy: 1, name: "Bottom" },
  { dir: "left", id: "l", dx: -1, dy: 0, name: "Left" },
];
const ARM_SIZE = 0.7; // an arm's centre circle, as a fraction of the middle one (so a little smaller)
const CROSS_GAP = 0.5; // free space between the rims of two groups, as a multiple of the centre group's extent
const ARM_LAG = 900; // intro: the arms start drawing after the centre group (ms) …
const ARM_STAGGER = 140; // … one after the other (ms)
const LINK_PAD = 1.5; // how close a circle must be to a link for the link to be cut around it
// How many circles a layer config asks for ("circles": 12, "count": 12, or the number of members)
function layerCount(cfg) {
  const inline = Array.isArray(cfg?.members)
    ? cfg.members
    : Array.isArray(cfg?.circles)
      ? cfg.circles
      : [];
  const declared = Array.isArray(cfg?.circles)
    ? undefined
    : (cfg?.circles ?? cfg?.count);
  return Math.max(0, Math.floor(Number(declared ?? inline.length) || 0));
}

/**
 * One group: a centre circle at (cx, cy) plus N concentric layers around it.
 * Each layer in layers.json may also carry its circles' details inline (all optional):
 *   members: [{ title | name, subtitle, subtitleLabel, image, color, description, details }, …]
 * Inline data wins over the same circle in circles.json; circles without data stay empty placeholders.
 *
 * @param {Array<{circles?:number, name?:string, description?:string|string[], rotation?:number|"auto",
 *                members?:object[], size?:number, radius?:number, threads?:boolean}>} layersConfig
 * @param {{center?: object, layers?: Array<Array<object>>}} circleData
 * @param {{id:string, dir:string, name:string, centerTitle:string, cx:number, cy:number, lag:number, slots:object[], centerR?:number, quiet?:boolean}} opt
 */
function buildGroup(layersConfig, circleData, opt) {
  const { id, dir, name, centerTitle, cx, cy, lag, slots, quiet } = opt;
  const centerR = opt.centerR ?? CENTER_R;
  // the centre group keeps the plain ids ("c", "1-0" …); arms are prefixed ("t:c", "t:1-0" …)
  const pre = id === "c" ? "" : `${id}:`;
  const nodes = [];
  const rings = [];
  // one "slot" per centre circle and per layer: labels switch on per slot as the camera zooms in
  const newSlot = (r) => slots.push({ base: Math.min(r, NODE_R) }) - 1;

  nodes.push({
    id: `${pre}c`,
    group: id,
    ring: null,
    layer: 0,
    index: 0,
    count: 1,
    x: cx,
    y: cy,
    r: centerR,
    angle: -90,
    sweep: 0,
    lag,
    slot: newSlot(centerR),
    data: normalise(circleData.center, centerTitle, CENTER_COLOR),
  });

  let prevR = 0;
  let prevNodeR = centerR;
  let prevAngles = [];

  layersConfig.forEach((cfg, li) => {
    // circles inline in layers.json: "members": [ … ] (or "circles": [ … ] given as an array)
    const inline = Array.isArray(cfg?.members)
      ? cfg.members
      : Array.isArray(cfg?.circles)
        ? cfg.circles
        : [];
    // "circles": 12 stays in charge of the count; without it the number of members is used
    const count = layerCount(cfg);
    if (!count) return;

    const layerNo = rings.length + 1;
    const gap = layerNo === 1 ? FIRST_GAP : RING_GAP;
    const edge = prevR + prevNodeR; // outer edge of the layer before

    // ── Size + radius ────────────────────────────────────────────────────────
    // `fit` is the biggest circle radius per unit of ring radius that still leaves 1.3 × diameter
    // between neighbours. A layer that has room keeps NODE_R at the usual distance (nothing changes).
    // A crowded layer used to be pushed far outwards; now its circles shrink just enough to sit
    // right behind the previous layer instead, so every layer stays close to the centre.
    // A layer that sets its own "size" or "radius" in layers.json keeps exactly what it asks for.
    const wantsSize = Number(cfg.size) > 0;
    const r0 = wantsSize ? Number(cfg.size) : NODE_R;
    const fit = count > 1 ? Math.sin(Math.PI / count) / MIN_SPACING : Infinity;
    let r = r0;
    let R;
    if (Number(cfg.radius) > 0) {
      R = Number(cfg.radius);
      if (!wantsSize) r = Math.min(r0, R * fit);
    } else {
      const near = edge + gap + r0;
      if (r0 <= near * fit)
        R = near; // enough room: same as before
      else if (wantsSize)
        R = (MIN_SPACING * r0) / Math.sin(Math.PI / count); // fixed size: push outwards
      else {
        R = (edge + gap) / (1 - fit); // shrink the circles instead
        r = R * fit;
      }
    }

    // ── Rotation ─────────────────────────────────────────────────────────────
    // Node i sits at (-90° + rotation + 360° / count × i): -90° is 12 o'clock and angles run
    // clockwise, so `rotation` turns the whole layer clockwise by that many degrees.
    // "rotation": "auto" picks the turn that keeps this layer furthest from the one before it.
    const step = 360 / count;
    const rotation =
      typeof cfg.rotation === "string" &&
      cfg.rotation.trim().toLowerCase() === "auto"
        ? autoRotation(step, prevAngles)
        : Number(cfg.rotation) || 0;
    const fileData = Array.isArray(circleData.layers?.[li])
      ? circleData.layers[li]
      : [];
    // data for circle i: the inline member, filled in with whatever circles.json has for it
    const dataFor = (i) => {
      const a = fileData[i];
      let b = inline[i];
      // an inline "name" counts as the title, so it also beats a "title" from circles.json
      if (b && typeof b === "object" && b.name && !b.title)
        b = { ...b, title: b.name };
      return a && b && typeof a === "object" && typeof b === "object"
        ? { ...a, ...b }
        : (b ?? a);
    };
    const entries = Math.max(fileData.length, inline.length);

    // layers with no data at all are fine (empty placeholders); only a half-filled layer is worth a hint
    if (!quiet && import.meta.env?.DEV && entries > 0 && entries !== count) {
      console.warn(
        `[formation] ${name}: layer ${layerNo} has ${count} circles but ${entries} entries of data (layers.json members / circles.json / cross.json).` +
          (entries < count
            ? " Missing entries render as empty placeholders."
            : " Extra entries are ignored."),
      );
    }

    // threads: false in layers.json switches the thread pattern off for that layer only
    const ring = {
      key: `${pre}${layerNo}`, // unique across the whole cross; `layer` below is the number inside its group
      group: id,
      layer: layerNo,
      name: cfg.name || `Layer ${layerNo}`,
      description: toArray(cfg.description),
      cx,
      cy,
      R,
      r,
      count,
      rotation,
      threads: cfg.threads !== false,
      slot: newSlot(r),
      nodes: [],
    };

    for (let i = 0; i < count; i++) {
      const deg = -90 + rotation + step * i;
      const rad = (deg * Math.PI) / 180;
      // sweep = clockwise position from 12 o'clock in [0, 1), used to stagger the intro
      const sweep = ((((deg + 90) % 360) + 360) % 360) / 360;
      const node = {
        id: `${pre}${layerNo}-${i}`,
        group: id,
        ring: ring.key,
        layer: layerNo,
        index: i,
        count,
        x: cx + R * Math.cos(rad),
        y: cy + R * Math.sin(rad),
        r,
        angle: deg,
        sweep,
        lag,
        slot: ring.slot,
        data: normalise(
          dataFor(i),
          `Untitled ${layerNo}.${i + 1}`,
          themeColor(layerNo, i),
        ),
      };
      nodes.push(node);
      ring.nodes.push(node);
    }

    rings.push(ring);
    prevR = R;
    prevNodeR = r;
    prevAngles = ring.nodes.map((n) => n.angle);
  });

  // The name of a layer is written on a curved line in the free band between that layer and the
  // next one (or just outside the last layer), centred at 12 o'clock.
  rings.forEach((ring, i) => {
    const next = rings[i + 1];
    const inner = ring.R + ring.r;
    const band = next ? Math.max(0, next.R - next.r - inner) : RING_GAP;
    const arcLen = Math.PI * (inner + band / 2) * 0.9; // text must fit on the top half circle
    const fs = Math.max(
      NAME_FS_MIN,
      Math.min(
        clamp(band * 0.42, 7, NAME_FS_MAX),
        arcLen / (Math.max(1, ring.name.length) * 0.8),
      ),
    );
    ring.label = { r: inner + Math.max(1.5, (band - fs * 0.72) / 2), fs, band };
  });

  const outer = rings.length ? rings[rings.length - 1] : null;
  // space for the curved labels under the outermost circles and the name of the last layer
  const extent = outer
    ? Math.max(outer.R + outer.r * 1.85, outer.label.r + outer.label.fs)
    : centerR * 1.9;

  // Sacred-geometry threads, one for every circle of every layer, whatever the circle count.
  // Each thread is a circle centred on a node that passes exactly through that node's predecessor:
  // the centre for layer 1 (same pattern as before), the closest circle of the layer before for
  // layer 2, 3, 4 … so every new layer is woven into the layers inside it.
  const guides = [];
  rings.forEach((ring, ri) => {
    if (!ring.threads) return;
    const anchors = ri === 0 ? [nodes[0]] : rings[ri - 1].nodes;
    // crowded layers get fainter threads so a 72-circle layer doesn't turn into a black disc
    const alpha = clamp(Math.sqrt(12 / ring.count), 0.28, 1);
    for (const n of ring.nodes) {
      let parent = anchors[0];
      let reach = Infinity;
      for (const a of anchors) {
        const d = Math.hypot(n.x - a.x, n.y - a.y);
        if (d < reach - 1e-6) {
          reach = d;
          parent = a;
        }
      }
      guides.push({
        id: `g-${n.id}`,
        group: id,
        ring: ring.key,
        layer: ring.layer,
        from: parent.id,
        x: n.x,
        y: n.y,
        r: reach,
        sweep: n.sweep,
        alpha,
        // layer 1 keeps its original timing (420 / 540 / 660 ms); later layers draw in after it
        delay: lag + 420 + (ring.layer - 1) * 260 + n.sweep * 360,
      });
    }
  });

  // Threads from outer layers reach past the last ring, so they fade out between the outermost
  // circles and the edge of the group instead of running off into empty space.
  const fade = outer
    ? { from: Math.min(outer.R + outer.r * 1.1, extent * 0.97), to: extent }
    : { from: extent * 0.9, to: extent };

  return { id, dir, name, cx, cy, lag, nodes, rings, guides, extent, fade };
}

// A straight line from the centre of one group to the centre of another. It is cut around every
// circle it passes (`nodeIds`), so it runs through the gaps like the other hairlines.
function buildLink(a, b, lag) {
  const x1 = a.cx;
  const y1 = a.cy;
  const x2 = b.cx;
  const y2 = b.cy;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const nodeIds = [];
  for (const n of [...a.nodes, ...b.nodes]) {
    const along = (n.x - x1) * ux + (n.y - y1) * uy;
    const across = Math.abs((n.x - x1) * uy - (n.y - y1) * ux);
    // 1.7 × radius also covers the curved label that sits under a circle
    if (along > -n.r && along < len + n.r && across < n.r * 1.7 + LINK_PAD)
      nodeIds.push(n.id);
  }
  return { id: `${a.id}-${b.id}`, from: a.id, to: b.id, x1, y1, x2, y2, len, nodeIds, lag };
}

/**
 * The whole formation: the centre group, plus (when `cross` is given) one circle straight above, below,
 * left and right of it, each linked to the centre by a straight line.
 *
 * Every arm sits at the same distance, `centre extent × (1 + gap) + arm extent`, so the cross stays
 * symmetrical and grows or shrinks together with the centre group's pattern: add a layer to the centre
 * and all four arms move out by exactly as much as is needed. The same goes for an arm that gets layers
 * of its own: the cross opens up just enough to make room for it.
 *
 * Each arm has the same shape as the middle circle: a centre circle, then layers, each layer saying how many
 * circles it has and the details of each one. An arm whose layers are empty stays a single circle.
 *
 * cross = { gap?: number, size?: number, arms?: { top|right|bottom|left: { name?, size?, center?, layers? } } }
 *   gap     free space between two groups' rims, as a multiple of the centre group's extent (default 0.5)
 *   size    radius of an arm's centre circle as a fraction of the middle circle's (default 0.7); an arm may set its own
 *   center  the arm's centre circle, same fields as `center` in circles.json
 *   layers  the arm's layers, same format as layers.json: [{ name, circles, description, members: [details of each circle] }]
 */
export function buildFormation(layersConfig = [], circleData = {}, cross = null) {
  const slots = [];
  const main = buildGroup(layersConfig, circleData, {
    id: "c",
    dir: "centre",
    name: "Centre",
    centerTitle: "Centre",
    cx: 0,
    cy: 0,
    lag: 0,
    slots,
  });
  const groups = [main];
  const links = [];

  if (cross) {
    const specs = ARMS.map((a) => {
      const own = cross.arms?.[a.dir] ?? {};
      const name = own.name || a.name;
      // "size" is a fraction of the middle circle's radius; an arm can have its own, otherwise the shared one
      const size = Number(own.size ?? cross.size ?? ARM_SIZE);
      return {
        ...a,
        name,
        centerR: CENTER_R * (size > 0 ? size : ARM_SIZE),
        centerTitle: `${name} centre`,
        layers: Array.isArray(own.layers) ? own.layers : [],
        data: { center: own.center, layers: [] },
      };
    });
    const build = (a, at, slotList, quiet = false) =>
      buildGroup(a.layers, a.data, {
        id: a.id,
        dir: a.dir,
        name: a.name,
        centerTitle: a.centerTitle,
        centerR: a.centerR,
        cx: at.cx,
        cy: at.cy,
        lag: at.lag,
        slots: slotList,
        quiet,
      });

    // measure the arms first (their size does not depend on where they sit), then place them all
    // at one distance, the one the biggest arm needs, so the cross is perfectly symmetrical
    const armExtent = Math.max(
      ...specs.map((a) => build(a, { cx: 0, cy: 0, lag: 0 }, [], true).extent),
    );
    const gap = Math.max(0, Number(cross.gap ?? CROSS_GAP));
    const distance = main.extent * (1 + (Number.isFinite(gap) ? gap : CROSS_GAP)) + armExtent;

    specs.forEach((a, i) => {
      const lag = ARM_LAG + i * ARM_STAGGER;
      const g = build(a, { cx: a.dx * distance, cy: a.dy * distance, lag }, slots);
      groups.push(g);
      links.push(buildLink(main, g, 350 + i * 90));
    });
  }

  const nodes = groups.flatMap((g) => g.nodes);
  const rings = groups.flatMap((g) => g.rings);
  const guides = groups.flatMap((g) => g.guides);

  // world-space box around everything, and the distance from the middle to its furthest edge
  const bounds = {
    minX: Math.min(...groups.map((g) => g.cx - g.extent)),
    maxX: Math.max(...groups.map((g) => g.cx + g.extent)),
    minY: Math.min(...groups.map((g) => g.cy - g.extent)),
    maxY: Math.max(...groups.map((g) => g.cy + g.extent)),
  };
  const extent = Math.max(
    Math.abs(bounds.minX),
    Math.abs(bounds.maxX),
    Math.abs(bounds.minY),
    Math.abs(bounds.maxY),
  );

  return {
    groups,
    nodes,
    rings,
    guides,
    links,
    slots,
    bounds,
    extent,
    ringByKey: new Map(rings.map((r) => [r.key, r])),
    groupById: new Map(groups.map((g) => [g.id, g])),
  };
}

// ───────── Search ─────────
const fold = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Finds circles (and layer groups) matching every word of `query`.
 * Looks at title, subtitle, description and details; titles rank first.
 * Returns [{ kind: "node" | "layer", id?, layer?, title, meta, score }] best match first.
 */
export function searchFormation(formation, query, limit = 8) {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const whole = tokens.join(" ");
  const hits = [];

  const score = (fields, title) => {
    let total = 0;
    for (const t of tokens) {
      let best = 0;
      for (const f of fields)
        if (f.text.includes(t) && f.weight > best) best = f.weight;
      if (!best) return 0;
      total += best;
    }
    if (title === whole) total += 40;
    else if (title.startsWith(whole)) total += 20;
    return total;
  };

  // which arm of the cross a result lives in (nothing is added for the centre group)
  const armOf = (id) =>
    id === "c" ? "" : (formation.groupById.get(id)?.name ?? "");

  formation.rings.forEach((ring, ri) => {
    const title = fold(ring.name);
    const s = score(
      [
        { text: title, weight: 10 },
        { text: fold(ring.description.join(" ")), weight: 3 },
      ],
      title,
    );
    if (s)
      hits.push({
        kind: "layer",
        layer: ring.key,
        title: ring.name,
        meta: [`Group · Layer ${ring.layer}`, armOf(ring.group)]
          .filter(Boolean)
          .join(" · "),
        score: s - 0.5,
        order: ri,
      });
  });

  formation.nodes.forEach((n, i) => {
    if (n.data.isPlaceholder) return;
    const d = n.data;
    const title = fold(d.title);
    const s = score(
      [
        { text: title, weight: 10 },
        { text: fold(d.subtitle), weight: 6 },
        { text: fold(d.description.join(" ")), weight: 3 },
        {
          text: fold(d.details.map((x) => `${x.label} ${x.value}`).join(" ")),
          weight: 2,
        },
      ],
      title,
    );
    if (!s) return;
    const group = n.ring ? formation.ringByKey.get(n.ring)?.name : "Centre";
    hits.push({
      kind: "node",
      id: n.id,
      title: d.title,
      meta: [d.subtitle, group, armOf(n.group)].filter(Boolean).join(" · "),
      score: s,
      order: 1000 + i,
    });
  });

  hits.sort((a, b) => b.score - a.score || a.order - b.order);
  return hits.slice(0, limit);
}
