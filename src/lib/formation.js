// Builds the radial formation: one fixed centre circle plus N concentric layers.
// All values are in "world units"; the camera maps them to screen pixels.

export const CENTER_R = 64; // radius of the centre circle
export const NODE_R = 38; // default radius of every layer circle
const FIRST_GAP = 64; // gap between the centre circle edge and layer 1 circle edges
const RING_GAP = 40; // gap between the circle edges of two neighbouring layers
const MIN_SPACING = 1.3; // neighbours on one ring keep at least 1.3 × diameter apart (centre to centre)

const toArray = (v) => (Array.isArray(v) ? v : v == null || v === "" ? [] : [v]);

function normalise(raw, fallbackTitle) {
  const d = raw && typeof raw === "object" ? raw : null;
  return {
    title: d?.title || fallbackTitle,
    subtitle: d?.subtitle || "",
    subtitleLabel: d?.subtitleLabel,
    image: d?.image || null,
    color: d?.color || null,
    description: toArray(d?.description),
    details: Array.isArray(d?.details) ? d.details : [],
    isPlaceholder: !d,
  };
}

/**
 * @param {Array<{circles:number, name?:string, rotation?:number, size?:number, radius?:number}>} layersConfig
 * @param {{center?: object, layers?: Array<Array<object>>}} circleData
 */
export function buildFormation(layersConfig = [], circleData = {}) {
  const nodes = [];
  const rings = [];

  nodes.push({
    id: "c",
    layer: 0,
    index: 0,
    count: 1,
    x: 0,
    y: 0,
    r: CENTER_R,
    angle: -90,
    sweep: 0,
    data: normalise(circleData.center, "Centre"),
  });

  let prevR = 0;
  let prevNodeR = CENTER_R;

  layersConfig.forEach((cfg, li) => {
    const count = Math.max(0, Math.floor(Number(cfg?.circles ?? cfg?.count ?? 0)));
    if (!count) return;

    const layerNo = rings.length + 1;
    const r = Number(cfg.size) > 0 ? Number(cfg.size) : NODE_R;
    const gap = layerNo === 1 ? FIRST_GAP : RING_GAP;
    const byNeighbour = prevR + prevNodeR + gap + r;
    const bySpacing = count > 1 ? (r * MIN_SPACING) / Math.sin(Math.PI / count) : 0;
    const R = Number(cfg.radius) > 0 ? Number(cfg.radius) : Math.max(byNeighbour, bySpacing);
    const rotation = Number(cfg.rotation) || 0;
    const layerData = Array.isArray(circleData.layers?.[li]) ? circleData.layers[li] : [];

    if (import.meta.env?.DEV && layerData.length !== count) {
      console.warn(
        `[formation] Layer ${layerNo} has ${count} circles in layers.json but ${layerData.length} entries in circles.json.` +
          (layerData.length < count ? " Missing entries render as empty placeholders." : " Extra entries are ignored."),
      );
    }

    const ring = { layer: layerNo, name: cfg.name || `Layer ${layerNo}`, R, r, count, nodes: [] };

    for (let i = 0; i < count; i++) {
      const deg = -90 + rotation + (360 / count) * i;
      const rad = (deg * Math.PI) / 180;
      // sweep = clockwise position from 12 o'clock in [0, 1), used to stagger the intro
      const sweep = ((((deg + 90) % 360) + 360) % 360) / 360;
      const node = {
        id: `${layerNo}-${i}`,
        layer: layerNo,
        index: i,
        count,
        x: R * Math.cos(rad),
        y: R * Math.sin(rad),
        r,
        angle: deg,
        sweep,
        data: normalise(layerData[i], `Untitled ${layerNo}.${i + 1}`),
      };
      nodes.push(node);
      ring.nodes.push(node);
    }

    rings.push(ring);
    prevR = R;
    prevNodeR = r;
  });

  const outer = rings.length ? rings[rings.length - 1] : null;
  // space for the curved labels under the outermost circles
  const extent = outer ? outer.R + outer.r * 1.85 : CENTER_R * 1.9;

  // Sacred-geometry guides: circles centred on each layer-1 node that pass through the centre.
  const guides = [];
  if (rings[0] && rings[0].count <= 6) {
    for (const n of rings[0].nodes) guides.push({ id: `g-${n.id}`, x: n.x, y: n.y, r: rings[0].R, sweep: n.sweep });
  }

  return { nodes, rings, guides, extent };
}
