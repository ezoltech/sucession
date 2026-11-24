import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ease } from "../lib/easing";
import { NODE_R } from "../lib/formation";
import { optimizedImageUrl } from "../lib/images";

const TITLE_K = 1.3; // title baseline radius (× node radius)
const SUB_K = 1.52; // subtitle baseline radius
const TITLE_FS = 0.19; // font sizes (× node radius)
const SUB_FS = 0.125;
const HALO_K = 1.42; // decorative halo around the centre and layer 1
const SELECT_K = 1.09; // selection ring
const LABEL_ZOOM_PX = 62; // node radius on screen above which every label shows
const LABEL_FIT = 0.97; // a label may use at most this much of one full turn around its circle
const NO_FIT = { t: 1, s: 1 }; // font scale of a label that needs no shrinking

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// A full circle that starts at the top and runs counter-clockwise (top → left → bottom → right → top).
// A label centred on its middle sits at the bottom reading upright, and as it gets longer it grows up
// both sides and can go all the way round the circle.
const labelCircle = (x, y, R) =>
  `M ${x} ${y - R} A ${R} ${R} 0 0 0 ${x} ${y + R} A ${R} ${R} 0 0 0 ${x} ${y - R}`;
const circlePath = ({ x, y, r }) =>
  `M${x - r} ${y} A${r} ${r} 0 1 0 ${x + r} ${y} A${r} ${r} 0 1 0 ${x - r} ${y}`;
const guidePath = (guides) => guides.map(circlePath).join(" ");
// Semicircle through the top of a circle, left → right, so layer names read upright.
const topArc = (cx, cy, R) =>
  `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
// ids like "t:1-0" are not safe inside every url(#…), so DOM ids use only letters, digits, - and _
const dom = (id) => String(id).replace(/[^\w-]/g, "_");

function sector(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [
    cx + r * Math.cos((a * Math.PI) / 180),
    cy + r * Math.sin((a * Math.PI) / 180),
  ];
  // a (nearly) full turn has no start and end to join: draw the whole ring instead
  if (a1 - a0 >= 359)
    return `M${cx + r1} ${cy} A${r1} ${r1} 0 1 1 ${cx - r1} ${cy} A${r1} ${r1} 0 1 1 ${cx + r1} ${cy} Z M${cx + r0} ${cy} A${r0} ${r0} 0 1 0 ${cx - r0} ${cy} A${r0} ${r0} 0 1 0 ${cx + r0} ${cy} Z`;
  const [x0, y0] = p(r1, a0);
  const [x1, y1] = p(r1, a1);
  const [x2, y2] = p(r0, a1);
  const [x3, y3] = p(r0, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
}

// Half-width (degrees) of the gap cut into the guide lines beneath a label. It follows the label all the
// way round the circle (180° = a full ring). `fit` holds the real text widths once the browser has
// measured them; until then the width is estimated from the number of characters.
function labelHalfAngle(n, fit) {
  const titleLen = fit
    ? fit.wt * fit.t
    : n.data.title.length * n.r * TITLE_FS * 0.56;
  const subLen = fit
    ? fit.ws * fit.s
    : n.data.subtitle.length * n.r * SUB_FS * 0.78;
  const pad = n.r * 0.3;
  const turn = Math.max(
    (titleLen + pad) / (n.r * TITLE_K),
    n.data.subtitle ? (subLen + pad) / (n.r * SUB_K) : 0,
  ); // radians the label spans
  return clamp((turn * 180) / Math.PI / 2, 22, 180);
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Gaps cut into the hairlines beneath labels that are currently visible.
const Gaps = memo(function Gaps({ geo }) {
  return geo.map((g) => (
    <path
      key={`gap-${g.id}`}
      className="label-gap"
      d={g.d}
      fill="black"
    />
  ));
});

// The circles every label is written on
const Arcs = memo(function Arcs({ nodes }) {
  return nodes.map((n) => (
    <g key={`arcs-${n.id}`}>
      <path
        id={`arc-t-${dom(n.id)}`}
        d={labelCircle(n.x, n.y, n.r * TITLE_K)}
      />
      {n.data.subtitle && (
        <path
          id={`arc-s-${dom(n.id)}`}
          d={labelCircle(n.x, n.y, n.r * SUB_K)}
        />
      )}
    </g>
  ));
});

// One compound path per ring holds the thread circle for every member.
const Threads = memo(function Threads({ rings, activeLayer }) {
  return rings.map(
    (ring) =>
      ring.guides.length > 0 && (
        <path
          key={`guides-${ring.key}`}
          className={`hair guide guide-l${ring.layer}${ring.key === activeLayer ? " is-active" : ""}`}
          d={guidePath(ring.guides)}
          style={{
            "--ga": ring.guides[0].alpha ?? 1,
            "--delay": `${ring.guides[0].delay}ms`,
          }}
        />
      ),
  );
});

// Invisible, fatter copies of the strings and threads so they are easy to click
const Hits = memo(function Hits({ group, onPick, onHover }) {
  return (
    <>
      {group.rings.map((ring) => (
        <circle
          key={`hit-${ring.key}`}
          className="hit hit-orbit"
          cx={ring.cx}
          cy={ring.cy}
          r={ring.R}
          role="button"
          aria-label={`Select ${ring.name}`}
          onClick={(e) => onPick(ring.key, e)}
          onPointerEnter={(e) => {
            if (e.pointerType !== "touch") onHover(ring.key);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType !== "touch") onHover(null);
          }}
        />
      ))}
      {group.rings.map(
        (ring) =>
          ring.guides.length > 0 && (
            <path
              key={`hit-guides-${ring.key}`}
              className="hit hit-guide"
              d={guidePath(ring.guides)}
              role="button"
              aria-label={`Select ${ring.name}`}
              onClick={(e) => onPick(ring.key, e)}
              onPointerEnter={(e) => {
                if (e.pointerType !== "touch") onHover(ring.key);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType !== "touch") onHover(null);
              }}
            />
          ),
      )}
    </>
  );
});

export default function Formation({
  formation,
  stage,
  selectedId,
  hoveredId,
  activeLayer = null,
  activeColor = null,
  onHover,
  onSelect,
  onSelectLayer,
  onBackground,
}) {
  const { nodes, rings, groups, links, slots, extent } = formation;
  const svgRef = useRef(null);
  const camGroupRef = useRef(null);
  const cam = useRef({ x: 0, y: 0, s: 1 });
  const stageRef = useRef(stage);
  const flight = useRef(0);
  const blur = useRef(0);
  const dragged = useRef(false);
  const initialised = useRef(false);
  const initialView = useRef(true);
  // One "1"/"0" per slot (a centre circle or a layer of any group): do its circle labels show at this zoom?
  const [labelKey, setLabelKey] = useState("");
  const labelKeyRef = useRef("");
  const [imageHrefs, setImageHrefs] = useState(() => new Map());
  const imageHrefsRef = useRef(imageHrefs);
  const seenImageIds = useRef(new Set());
  const imageSyncTimer = useRef(0);
  const panFrame = useRef(0);
  const pendingCamera = useRef(null);
  // How wide each label really is (measured in the browser) and how much its font has to shrink,
  // if at all, to fit once around its circle. id → { wt, ws, t, s }
  const [fits, setFits] = useState(() => new Map());
  const fitsRef = useRef(fits);
  const [hoverLayer, setHoverLayer] = useState(null);

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) || null,
    [nodes, selectedId],
  );
  const active = useMemo(
    () => (activeLayer ? rings.find((r) => r.key === activeLayer) || null : null),
    [rings, activeLayer],
  );
  const imageNodes = useMemo(() => nodes.filter((n) => n.data.image), [nodes]);
  const firstRing = useMemo(
    () => rings.find((ring) => ring.group === "c") ?? null,
    [rings],
  );
  const initialRings = useMemo(
    () => rings.filter((ring) => ring.group === "c" && ring.layer <= 3),
    [rings],
  );
  const initialRingKeys = useMemo(
    () => new Set(initialRings.map((ring) => ring.key)),
    [initialRings],
  );
  const initialImageIds = useMemo(
    () =>
      new Set(
        imageNodes
          .filter(
            (node) => node.id === "c" || initialRingKeys.has(node.ring),
          )
          .map((node) => node.id),
      ),
    [imageNodes, initialRingKeys],
  );
  const centerRadius = nodes.find((node) => node.id === "c")?.r ?? 0;
  const initialExtent = initialRings.length
    ? Math.max(centerRadius, ...initialRings.map((ring) => ring.R + ring.r))
    : (centerRadius || extent);
  // Circle radius (world units) that decides when a layer's labels appear. Capped at NODE_R, so
  // layers with normal-sized circles behave exactly as before; small circles just need more zoom.
  const labelBase = useMemo(() => slots.map((s) => s.base), [slots]);
  const minR = useMemo(
    () => Math.min(NODE_R, ...rings.map((r) => r.r)),
    [rings],
  );

  const fitScale = useCallback(
    (st) => clamp((Math.min(st.w, st.h) * 0.92) / (2 * extent), 0.05, 20),
    [extent],
  );
  const initialScale = useCallback(
    (st) =>
      clamp((Math.min(st.w, st.h) * 0.92) / (2 * initialExtent), 0.05, 20),
    [initialExtent],
  );

  const targetFor = useCallback(
    (node, st, layer) => {
      if (!node && layer) {
        // a whole layer is selected: frame its string and its name
        const reach = layer.label.r + layer.label.fs * 1.6;
        const s = clamp((Math.min(st.w, st.h) * 0.92) / (2 * reach), 0.05, 20);
        return { x: layer.cx, y: layer.cy, s: Math.max(s, fitScale(st)) };
      }
      if (!node) return { x: 0, y: 0, s: fitScale(st) };
      const s = (Math.min(st.w, st.h) * 0.19) / node.r;
      return {
        x: node.x,
        y: node.y + node.r * 0.2,
        s: Math.max(s, fitScale(st) * 1.4),
      };
    },
    [fitScale],
  );

  const syncImages = useCallback(() => {
    clearTimeout(imageSyncTimer.current);
    imageSyncTimer.current = 0;
    const st = stageRef.current;
    const { x, y, s } = cam.current;
    const nextImages = new Map();
    const screenX = st.x + st.w / 2;
    const screenY = st.y + st.h / 2;
    for (const n of imageNodes) {
      const radius = n.r * s;
      const sx = screenX + (n.x - x) * s;
      const sy = screenY + (n.y - y) * s;
      const visible =
        sx + radius >= st.x &&
        sx - radius <= st.x + st.w &&
        sy + radius >= st.y &&
        sy - radius <= st.y + st.h;
      const initialImage =
        initialView.current && initialImageIds.has(n.id);
      const fullSize =
        !initialView.current && (n.id === selectedId || radius * 2 >= 48);
      if (visible && (fullSize || initialImage))
        seenImageIds.current.add(n.id);
      if (visible && seenImageIds.current.has(n.id))
        nextImages.set(
          n.id,
          optimizedImageUrl(n.data.image, fullSize ? 1024 : 256),
        );
    }

    const previousImages = imageHrefsRef.current;
    const sameImages =
      nextImages.size === previousImages.size &&
      [...nextImages].every(([id, src]) => previousImages.get(id) === src);
    if (!sameImages) {
      imageHrefsRef.current = nextImages;
      setImageHrefs(nextImages);
    }
  }, [imageNodes, initialImageIds, selectedId]);

  const scheduleImageSync = useCallback(() => {
    if (imageSyncTimer.current) clearTimeout(imageSyncTimer.current);
    imageSyncTimer.current = window.setTimeout(() => {
      imageSyncTimer.current = 0;
      syncImages();
    }, 120);
  }, [syncImages]);

  const apply = useCallback(() => {
    const g = camGroupRef.current;
    if (!g) return;
    const st = stageRef.current;
    const { x, y, s } = cam.current;
    g.setAttribute(
      "transform",
      `translate(${st.x + st.w / 2} ${st.y + st.h / 2}) scale(${s}) translate(${-x} ${-y})`,
    );
    g.style.setProperty("--px", `${1 / s}px`);
    const key = labelBase
      .map((b) => (s * b > LABEL_ZOOM_PX ? "1" : "0"))
      .join("");
    if (key !== labelKeyRef.current) {
      labelKeyRef.current = key;
      setLabelKey(key);
    }

    if (st.w <= 767) scheduleImageSync();
    else syncImages();
  }, [labelBase, scheduleImageSync, syncImages]);

  const setBlur = useCallback((v) => {
    if (
      window.matchMedia?.("(max-width: 767px), (pointer: coarse)").matches
    ) {
      blur.current = 0;
      const svg = svgRef.current;
      if (svg) {
        svg.style.filter = "";
        svg.style.opacity = "";
      }
      return;
    }
    blur.current = v;
    const svg = svgRef.current;
    if (!svg) return;
    svg.style.filter = v > 0.2 ? `blur(${v.toFixed(2)}px)` : "";
    svg.style.opacity = v > 0.2 ? String(1 - Math.min(0.22, v * 0.035)) : "";
  }, []);

  const flyTo = useCallback(
    (target, duration = 1000) => {
      cancelAnimationFrame(flight.current);
      if (prefersReducedMotion() || duration <= 0) {
        cam.current = { ...target };
        apply();
        setBlur(0);
        return;
      }
      const from = { ...cam.current };
      const ls0 = Math.log(from.s);
      const ls1 = Math.log(target.s);
      // screen offset of the destination point at the start; it travels linearly to the stage centre
      const spx = (target.x - from.x) * from.s;
      const spy = (target.y - from.y) * from.s;
      const t0 = performance.now();
      let prev = { ...from, t: t0 };

      const step = (now) => {
        const k = Math.min(1, (now - t0) / duration);
        const e = ease.unveil(k);
        const s = Math.exp(lerp(ls0, ls1, e));
        const x = target.x - ((1 - e) * spx) / s;
        const y = target.y - ((1 - e) * spy) / s;
        cam.current = { x, y, s };
        apply();

        // motion blur proportional to on-screen speed, like the reference's WebGL smear
        const dt = Math.max(8, now - prev.t);
        const move =
          Math.hypot(x * s - prev.x * prev.s, y * s - prev.y * prev.s) +
          Math.abs(Math.log(s / prev.s)) * 420;
        const speed = (move * 16) / dt;
        const want = k < 1 ? clamp((speed - 3) * 0.11, 0, 7) : 0;
        setBlur(lerp(blur.current, want, 0.45));
        prev = { x, y, s, t: now };

        if (k < 1) flight.current = requestAnimationFrame(step);
        else setBlur(0);
      };
      flight.current = requestAnimationFrame(step);
    },
    [apply, setBlur],
  );

  // Camera follows the selection (a circle or a whole layer) and the free stage area
  useLayoutEffect(() => {
    stageRef.current = stage;
    if (selected || active) initialView.current = false;
    const target = initialView.current
      ? { x: firstRing?.cx ?? 0, y: firstRing?.cy ?? 0, s: initialScale(stage) }
      : targetFor(selected, stage, active);
    if (!initialised.current) {
      initialised.current = true;
      cam.current = target;
      apply();
      return;
    }
    flyTo(target, 1000);
  }, [
    stage,
    selected,
    active,
    firstRing,
    initialScale,
    targetFor,
    flyTo,
    apply,
  ]);

  useEffect(
    () => () => {
      cancelAnimationFrame(flight.current);
      cancelAnimationFrame(panFrame.current);
      clearTimeout(imageSyncTimer.current);
    },
    [],
  );

  // Drag to pan, wheel to zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let start = null;

    const down = (e) => {
      if (e.button !== 0) return;
      initialView.current = false;
      cancelAnimationFrame(flight.current);
      cancelAnimationFrame(panFrame.current);
      pendingCamera.current = null;
      setBlur(0);
      start = {
        px: e.clientX,
        py: e.clientY,
        x: cam.current.x,
        y: cam.current.y,
        id: e.pointerId,
      };
      dragged.current = false;
    };
    const move = (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.px;
      const dy = e.clientY - start.py;
      if (!dragged.current && Math.hypot(dx, dy) > 4) {
        dragged.current = true;
        svg.setPointerCapture?.(e.pointerId);
        svg.classList.add("is-grabbing");
      }
      if (dragged.current) {
        pendingCamera.current = {
          ...cam.current,
          x: start.x - dx / cam.current.s,
          y: start.y - dy / cam.current.s,
        };
        if (!panFrame.current) {
          panFrame.current = requestAnimationFrame(() => {
            panFrame.current = 0;
            if (!pendingCamera.current) return;
            cam.current = pendingCamera.current;
            pendingCamera.current = null;
            apply();
          });
        }
      }
    };
    const up = (e) => {
      if (!start || e.pointerId !== start.id) return;
      start = null;
      svg.classList.remove("is-grabbing");
      if (svg.hasPointerCapture?.(e.pointerId))
        svg.releasePointerCapture(e.pointerId);
    };
    const wheel = (e) => {
      e.preventDefault();
      initialView.current = false;
      cancelAnimationFrame(flight.current);
      setBlur(0);
      const st = stageRef.current;
      const { x, y, s } = cam.current;
      const min = fitScale(st) * 0.6;
      const max = (Math.min(st.w, st.h) * 0.5) / minR;
      const ns = clamp(s * Math.exp(-e.deltaY * 0.0016), min, max);
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left - (st.x + st.w / 2);
      const my = e.clientY - rect.top - (st.y + st.h / 2);
      // keep the world point under the cursor fixed
      const wx = x + mx / s;
      const wy = y + my / s;
      cam.current = { x: wx - mx / ns, y: wy - my / ns, s: ns };
      apply();
    };

    svg.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => {
      svg.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      svg.removeEventListener("wheel", wheel);
    };
  }, [apply, fitScale, setBlur, minR]);

  // Measure every label with the real font. A name that is longer than one full turn around its circle
  // gets a smaller font so that all of it stays visible; anything shorter is left exactly as it was.
  const measureLabels = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const old = fitsRef.current;
    const next = new Map();
    let changed = false;
    for (const title of svg.querySelectorAll(".label-title")) {
      const el = title.closest("g.node[data-node]");
      const id = el?.getAttribute("data-node");
      const n = byId.get(id);
      if (!n || !el) continue;
      const sub = el.querySelector(".label-sub");
      const was = old.get(id) ?? { ...NO_FIT, wt: 0, ws: 0 };
      // widths at the normal font size. Text width is proportional to the font size, so scale by the
      // font size the element has right now (read from the page, not from state: React may not have
      // applied the latest shrink yet when this runs).
      const atNormal = (el, normalFs) =>
        el.getComputedTextLength() *
        (normalFs / (parseFloat(el.style.fontSize) || normalFs));
      const wt = atNormal(title, n.r * TITLE_FS);
      const ws = sub ? atNormal(sub, n.r * SUB_FS) : 0;
      const fitTo = (w, k) =>
        w > 0 ? Math.min(1, (LABEL_FIT * 2 * Math.PI * n.r * k) / w) : 1;
      const t = fitTo(wt, TITLE_K);
      const s = fitTo(ws, SUB_K);
      const same =
        old.has(id) &&
        Math.abs(was.t - t) < 0.01 &&
        Math.abs(was.s - s) < 0.01 &&
        Math.abs(was.wt - wt) <= wt * 0.01 &&
        Math.abs(was.ws - ws) <= ws * 0.01;
      if (!same) changed = true;
      next.set(id, same ? was : { wt, ws, t, s });
    }
    if (changed) {
      fitsRef.current = next;
      setFits(next);
    }
  }, [nodes]);

  // once the labels are in the page (before it is painted), and again when a web font finishes loading
  useLayoutEffect(() => {
    measureLabels();
    const fonts = document.fonts;
    fonts?.ready?.then(measureLabels);
    fonts?.addEventListener?.("loadingdone", measureLabels);
    return () => fonts?.removeEventListener?.("loadingdone", measureLabels);
  }, [measureLabels, labelKey, selectedId, hoveredId]);

  const handleBackgroundClick = (e) => {
    if (dragged.current) return;
    if (e.target.closest?.("[data-node]")) return;
    onBackground?.();
  };

  // clicking a layer string, one of its threads, or its name selects that layer (by its unique key)
  const pickLayer = useCallback(
    (key, e) => {
      e.stopPropagation();
      if (!dragged.current) onSelectLayer?.(key);
    },
    [onSelectLayer],
  );

  const nodeDelay = (n) =>
    n.lag + (n.layer === 0 ? 120 : 220 + n.sweep * 560 + (n.layer - 1) * 70);

  const anyLabels = labelKey.includes("1");
  const nodeLabelVisible = useCallback(
    (n) =>
      (stage.w > 767 && labelKey[n.slot] === "1") ||
      n.id === hoveredId ||
      n.id === selectedId,
    [stage.w, labelKey, hoveredId, selectedId],
  );
  const visibleLabelNodes = useMemo(
    () => nodes.filter(nodeLabelVisible),
    [nodes, nodeLabelVisible],
  );

  // Label masks contain only labels currently visible; node fills cover lines underneath them.
  const parts = useMemo(() => {
    const gapFor = (n) => {
      const half = labelHalfAngle(n, fits.get(n.id));
      return {
        id: n.id,
        slot: n.slot,
        d: sector(n.x, n.y, n.r * 1.12, n.r * 1.64, 90 - half, 90 + half),
      };
    };
    const gapById = new Map(visibleLabelNodes.map((n) => [n.id, gapFor(n)]));
    return {
      groups: groups.map((g) => ({
        g,
        big: g.extent * 4,
        geo: g.nodes.flatMap((n) => {
          const gap = gapById.get(n.id);
          return gap ? [gap] : [];
        }),
        fadeTo: g.fade.to,
        fadeFrom: Math.min(g.fade.from, g.fade.to * 0.999),
        fadeIn: g.fade.inner ?? null,
      })),
      links: links.map((l) => {
        const nodeIds = new Set(l.nodeIds);
        return {
          l,
          x: Math.min(l.x1, l.x2) - 24,
          y: Math.min(l.y1, l.y2) - 24,
          w: Math.abs(l.x2 - l.x1) + 48,
          h: Math.abs(l.y2 - l.y1) + 48,
          geo: visibleLabelNodes.flatMap((n) =>
            nodeIds.has(n.id) ? [gapById.get(n.id)] : [],
          ),
        };
      }),
    };
  }, [groups, links, visibleLabelNodes, fits]);

  const handleNodeSelect = useCallback(
    (id) => {
      if (!dragged.current) onSelect(id);
    },
    [onSelect],
  );

  return (
    <div className="stage" aria-label="Formation">
      <svg
        ref={svgRef}
        className="formation"
        onClick={handleBackgroundClick}
        role="presentation"
      >
        <defs>
          <clipPath id="circle-clip" clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.5" />
          </clipPath>

          {/* Dark mode paints every string and thread with this gold x silver sweep (see --thread-stroke) */}
          <linearGradient id="thread-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f2dc96" />
            <stop offset="0.3" stopColor="#c9a24e" />
            <stop offset="0.55" stopColor="#e7e4dc" />
            <stop offset="0.8" stopColor="#b8984f" />
            <stop offset="1" stopColor="#dcd8cf" />
          </linearGradient>

          {/* Same sweep, but in world space, for the straight links (a perfectly horizontal or vertical
              line has no bounding box, so the default object-relative gradient would not paint it) */}
          <linearGradient
            id="thread-metal-world"
            gradientUnits="userSpaceOnUse"
            x1={-extent}
            y1={-extent}
            x2={extent}
            y2={extent}
          >
            <stop offset="0" stopColor="#f2dc96" />
            <stop offset="0.3" stopColor="#c9a24e" />
            <stop offset="0.55" stopColor="#e7e4dc" />
            <stop offset="0.8" stopColor="#b8984f" />
            <stop offset="1" stopColor="#dcd8cf" />
          </linearGradient>

          {parts.groups.map(({ g, big, geo, fadeTo, fadeFrom, fadeIn }) => {
            const box = {
              maskUnits: "userSpaceOnUse",
              x: g.cx - big,
              y: g.cy - big,
              width: big * 2,
              height: big * 2,
            };
            const rect = { x: box.x, y: box.y, width: box.width, height: box.height };
            const gaps = <Gaps geo={geo} />;
            return (
              <g key={`masks-${g.id}`}>
                {/* Fades the group's thread pattern out around its outermost layer so it always fits */}
                <radialGradient
                  id={`thread-fade-grad-${g.id}`}
                  gradientUnits="userSpaceOnUse"
                  cx={g.cx}
                  cy={g.cy}
                  r={fadeTo}
                >
                  {/* a ring without a centre (the outer ring) also fades out on its inner side */}
                  {fadeIn ? (
                    <>
                      <stop offset="0" stopColor="black" />
                      <stop
                        offset={clamp(fadeIn.to / fadeTo, 0, 0.997)}
                        stopColor="black"
                      />
                      <stop
                        offset={clamp(fadeIn.from / fadeTo, 0, 0.998)}
                        stopColor="white"
                      />
                    </>
                  ) : (
                    <stop offset="0" stopColor="white" />
                  )}
                  <stop
                    offset={clamp(fadeFrom / fadeTo, 0, 0.999)}
                    stopColor="white"
                  />
                  <stop offset="1" stopColor="black" />
                </radialGradient>
                <mask id={`thread-fade-${g.id}`} {...box}>
                  <rect {...rect} fill={`url(#thread-fade-grad-${g.id})`} />
                </mask>

                {/* Labels need gaps; the opaque circles themselves cover lines underneath. */}
                <mask id={`line-mask-${g.id}`} {...box}>
                  <rect {...rect} fill="white" />
                  {gaps}
                </mask>

                {/* Same, but only beneath labels: the highlighted string runs behind the circles instead */}
                <mask id={`label-mask-${g.id}`} {...box}>
                  <rect {...rect} fill="white" />
                  {gaps}
                </mask>
              </g>
            );
          })}

          {parts.links.map(({ l, x, y, w, h, geo }) => (
            <mask
              key={`link-mask-${l.id}`}
              id={`link-mask-${l.id}`}
              maskUnits="userSpaceOnUse"
              x={x}
              y={y}
              width={w}
              height={h}
            >
              <rect x={x} y={y} width={w} height={h} fill="white" />
              <Gaps geo={geo} />
            </mask>
          ))}

          {visibleLabelNodes.length > 0 && <Arcs nodes={visibleLabelNodes} />}

          {/* Where each layer's name is written */}
          {rings.map((ring) => (
            <path
              key={`layer-arc-${ring.key}`}
              id={`layer-arc-${dom(ring.key)}`}
              d={topArc(ring.cx, ring.cy, ring.label.r)}
            />
          ))}
        </defs>

        <g
          ref={camGroupRef}
          className={`camera${nodes.length >= 200 ? " is-dense" : ""}`}
        >
          {/* One set of strings, halos and threads per group */}
          {parts.groups.map(({ g }) => (
            <g
              key={`lines-${g.id}`}
              className="lines"
              mask={`url(#line-mask-${g.id})`}
              style={{ "--hl": activeColor || undefined }}
            >
              <g className="threads" mask={`url(#thread-fade-${g.id})`}>
                <Threads
                  rings={g.rings}
                  activeLayer={active?.group === g.id ? activeLayer : null}
                />
              </g>
              {g.rings.map((ring, i) => (
                <DrawCircle
                  key={`orbit-${ring.key}`}
                  className={`hair orbit${hoverLayer === ring.key ? " is-hover" : ""}${ring.key === activeLayer ? " is-active" : ""}`}
                  cx={ring.cx}
                  cy={ring.cy}
                  r={ring.R}
                  delay={g.lag + i * 110}
                  duration={1000}
                />
              ))}
              {/* halos mark a centre and its first layer; the outer ring has no centre, so it gets none */}
              {g.nodes
                .filter((n) => g.center && n.layer <= 1)
                .map((n) => (
                  <DrawCircle
                    key={`halo-${n.id}`}
                    className="hair halo"
                    cx={n.x}
                    cy={n.y}
                    r={n.r * HALO_K}
                    delay={nodeDelay(n) + 160}
                    duration={900}
                  />
                ))}
            </g>
          ))}

          {/* Straight lines from the centre circle to the top, right, bottom and left circles */}
          {parts.links.length > 0 && (
            <g className="links">
              {parts.links.map(({ l }) => (
                <g key={`link-${l.id}`} mask={`url(#link-mask-${l.id})`}>
                  <line
                    className="link draw"
                    x1={l.x1}
                    y1={l.y1}
                    x2={l.x2}
                    y2={l.y2}
                    style={{
                      "--len": l.len,
                      "--delay": `${l.lag}ms`,
                      "--dur": "1200ms",
                    }}
                  />
                </g>
              ))}
            </g>
          )}

          {/* The clicked layer's string, lit in a random theme colour; it only exists while a layer is selected */}
          {active && activeColor && (
            <g
              className="string-hl"
              mask={`url(#label-mask-${active.group})`}
              style={{ "--hl": activeColor }}
            >
              <DrawCircle
                key={`hl-${active.key}-${activeColor}`}
                className="hair hl-orbit"
                cx={active.cx}
                cy={active.cy}
                r={active.R}
                delay={0}
                duration={900}
              />
            </g>
          )}

          {/* Invisible, fatter copies of the strings and threads so they are easy to click */}
          <g className="hits">
            {groups.map((g) => (
              <Hits
                key={`hits-${g.id}`}
                group={g}
                onPick={pickLayer}
                onHover={setHoverLayer}
              />
            ))}
          </g>

          {/* Layer names, written on a curve in the free band beside each layer's string */}
          <g className="layer-names">
            {rings.map((ring) => {
              const isActive = ring.key === activeLayer;
              const show = !anyLabels || isActive || hoverLayer === ring.key;
              return (
                <text
                  key={`name-${ring.key}`}
                  className={`layer-name${show ? " is-on" : ""}${isActive ? " is-active" : ""}`}
                  style={{
                    fontSize: ring.label.fs,
                    letterSpacing: ring.label.fs * 0.2,
                    "--hl": isActive ? activeColor || undefined : undefined,
                  }}
                  onClick={(e) => pickLayer(ring.key, e)}
                  onPointerEnter={(e) => {
                    if (e.pointerType !== "touch") setHoverLayer(ring.key);
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType !== "touch") setHoverLayer(null);
                  }}
                >
                  <textPath
                    href={`#layer-arc-${dom(ring.key)}`}
                    startOffset="50%"
                    textAnchor="middle"
                  >
                    {ring.name}
                  </textPath>
                </text>
              );
            })}
          </g>

          {nodes.map((n) => (
            <Node
              key={n.id}
              node={n}
              delay={nodeDelay(n)}
              hovered={n.id === hoveredId}
              selected={n.id === selectedId}
              labelVisible={nodeLabelVisible(n)}
              imageSrc={imageHrefs.get(n.id)}
              fit={fits.get(n.id) ?? NO_FIT}
              onHover={onHover}
              onSelect={handleNodeSelect}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

function DrawCircle({ className, cx, cy, r, delay, duration, style }) {
  const len = 2 * Math.PI * r;
  return (
    <circle
      className={`${className} draw`}
      cx={cx}
      cy={cy}
      r={r}
      transform={`rotate(-90 ${cx} ${cy})`}
      style={{
        "--len": len,
        "--delay": `${delay}ms`,
        "--dur": `${duration}ms`,
        ...style,
      }}
    />
  );
}

const Node = memo(function Node({
  node: n,
  delay,
  hovered,
  selected,
  labelVisible,
  imageSrc,
  fit,
  onHover,
  onSelect,
}) {
  const { data } = n;
  const origin = { transformOrigin: `${n.x}px ${n.y}px` };
  const tfs = n.r * TITLE_FS * fit.t;
  const sfs = n.r * SUB_FS * fit.s;

  return (
    <g
      className={`node${hovered ? " is-hover" : ""}${selected ? " is-selected" : ""}${data.isPlaceholder ? " is-empty" : ""}`}
      data-node={n.id}
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") onHover(n.id);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") onHover(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(n.id);
      }}
      role="button"
      tabIndex={-1}
      aria-label={`${data.title}${data.subtitle ? `, ${data.subtitle}` : ""}`}
    >
      <g className="node-in" style={{ ...origin, "--delay": `${delay}ms` }}>
        <circle className="select-ring" cx={n.x} cy={n.y} r={n.r * SELECT_K} />
        <g className="node-body" style={origin}>
          <circle
            className="node-fill"
            cx={n.x}
            cy={n.y}
            r={n.r}
            style={data.color ? { fill: data.color } : undefined}
          />
          {imageSrc && (
            <image
              href={imageSrc}
              x={n.x - n.r}
              y={n.y - n.r}
              width={n.r * 2}
              height={n.r * 2}
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#circle-clip)"
            />
          )}
          <circle className="node-edge" cx={n.x} cy={n.y} r={n.r} />
        </g>
      </g>

      {labelVisible && (
        <g className="label is-on" aria-hidden="true">
          <text
            className="label-title"
            style={{ fontSize: tfs, letterSpacing: tfs * 0.01 }}
          >
            <textPath
              href={`#arc-t-${dom(n.id)}`}
              startOffset="50%"
              textAnchor="middle"
            >
              {data.title}
            </textPath>
          </text>
          {data.subtitle && (
            <text
              className="label-sub"
              style={{ fontSize: sfs, letterSpacing: sfs * 0.14 }}
            >
              <textPath
                href={`#arc-s-${dom(n.id)}`}
                startOffset="50%"
                textAnchor="middle"
              >
                {data.subtitle}
              </textPath>
            </text>
          )}
        </g>
      )}
    </g>
  );
});
