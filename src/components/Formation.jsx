import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ease } from "../lib/easing";
import { NODE_R } from "../lib/formation";

const TITLE_K = 1.3; // title baseline radius (× node radius)
const SUB_K = 1.52; // subtitle baseline radius
const TITLE_FS = 0.19; // font sizes (× node radius)
const SUB_FS = 0.125;
const HALO_K = 1.42; // decorative halo around the centre and layer 1
const SELECT_K = 1.09; // selection ring
const LABEL_ZOOM_PX = 62; // node radius on screen above which every label shows

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Semicircle through the bottom of a circle, left → right, so text reads upright.
const bottomArc = (x, y, R) => `M ${x - R} ${y} A ${R} ${R} 0 0 0 ${x + R} ${y}`;

function sector(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(r1, a0);
  const [x1, y1] = p(r1, a1);
  const [x2, y2] = p(r0, a1);
  const [x3, y3] = p(r0, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
}

// Half-width (degrees) of the gap cut into the guide lines beneath a label.
function labelHalfAngle(n) {
  const titleLen = n.data.title.length * n.r * TITLE_FS * 0.56;
  const subLen = n.data.subtitle.length * n.r * SUB_FS * 0.78;
  const len = Math.max(titleLen, subLen) + n.r * 0.3;
  return clamp(((len / (n.r * TITLE_K)) * 180) / Math.PI / 2, 22, 88);
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Formation({ formation, stage, selectedId, hoveredId, onHover, onSelect, onBackground }) {
  const { nodes, rings, guides, extent } = formation;
  const svgRef = useRef(null);
  const camGroupRef = useRef(null);
  const cam = useRef({ x: 0, y: 0, s: 1 });
  const stageRef = useRef(stage);
  const flight = useRef(0);
  const blur = useRef(0);
  const dragged = useRef(false);
  const initialised = useRef(false);
  const [labelsOn, setLabelsOn] = useState(false);
  const labelsOnRef = useRef(false);

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) || null, [nodes, selectedId]);

  const fitScale = useCallback(
    (st) => clamp((Math.min(st.w, st.h) * 0.92) / (2 * extent), 0.05, 20),
    [extent],
  );

  const targetFor = useCallback(
    (node, st) => {
      if (!node) return { x: 0, y: 0, s: fitScale(st) };
      const s = (Math.min(st.w, st.h) * 0.19) / node.r;
      return { x: node.x, y: node.y + node.r * 0.2, s: Math.max(s, fitScale(st) * 1.4) };
    },
    [fitScale],
  );

  const apply = useCallback(() => {
    const g = camGroupRef.current;
    if (!g) return;
    const st = stageRef.current;
    const { x, y, s } = cam.current;
    g.setAttribute("transform", `translate(${st.x + st.w / 2} ${st.y + st.h / 2}) scale(${s}) translate(${-x} ${-y})`);
    g.style.setProperty("--px", `${1 / s}px`);
    const on = s * NODE_R > LABEL_ZOOM_PX;
    if (on !== labelsOnRef.current) {
      labelsOnRef.current = on;
      setLabelsOn(on);
    }
  }, []);

  const setBlur = useCallback((v) => {
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
        const move = Math.hypot(x * s - prev.x * prev.s, y * s - prev.y * prev.s) + Math.abs(Math.log(s / prev.s)) * 420;
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

  // Camera follows the selection and the free stage area
  useLayoutEffect(() => {
    stageRef.current = stage;
    const target = targetFor(selected, stage);
    if (!initialised.current) {
      initialised.current = true;
      cam.current = target;
      apply();
      return;
    }
    flyTo(target, 1000);
  }, [stage, selected, targetFor, flyTo, apply]);

  useEffect(() => () => cancelAnimationFrame(flight.current), []);

  // Drag to pan, wheel to zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let start = null;

    const down = (e) => {
      if (e.button !== 0) return;
      cancelAnimationFrame(flight.current);
      setBlur(0);
      start = { px: e.clientX, py: e.clientY, x: cam.current.x, y: cam.current.y, id: e.pointerId };
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
        cam.current = { ...cam.current, x: start.x - dx / cam.current.s, y: start.y - dy / cam.current.s };
        apply();
      }
    };
    const up = (e) => {
      if (!start || e.pointerId !== start.id) return;
      start = null;
      svg.classList.remove("is-grabbing");
      if (svg.hasPointerCapture?.(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    };
    const wheel = (e) => {
      e.preventDefault();
      cancelAnimationFrame(flight.current);
      setBlur(0);
      const st = stageRef.current;
      const { x, y, s } = cam.current;
      const min = fitScale(st) * 0.6;
      const max = (Math.min(st.w, st.h) * 0.5) / NODE_R;
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
  }, [apply, fitScale, setBlur]);

  const handleBackgroundClick = (e) => {
    if (dragged.current) return;
    if (e.target.closest?.("[data-node]")) return;
    onBackground?.();
  };

  const nodeDelay = (n) => (n.layer === 0 ? 120 : 220 + n.sweep * 560 + (n.layer - 1) * 70);
  const big = extent * 4;

  return (
    <div className="stage" aria-label="Formation">
      <svg ref={svgRef} className="formation" onClick={handleBackgroundClick} role="presentation">
        <defs>
          <clipPath id="circle-clip" clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.5" />
          </clipPath>

          {/* Cuts the hairlines around every circle and beneath visible labels */}
          <mask id="line-mask" maskUnits="userSpaceOnUse" x={-big} y={-big} width={big * 2} height={big * 2}>
            <rect x={-big} y={-big} width={big * 2} height={big * 2} fill="white" />
            {nodes.map((n) => (
              <circle key={n.id} cx={n.x} cy={n.y} r={n.r * 1.2} fill="black" />
            ))}
            {nodes.map((n) => {
              const half = labelHalfAngle(n);
              const visible = labelsOn || n.id === hoveredId || n.id === selectedId;
              return (
                <path
                  key={`gap-${n.id}`}
                  className="label-gap"
                  style={{ opacity: visible ? 1 : 0 }}
                  d={sector(n.x, n.y, n.r * 1.12, n.r * 1.64, 90 - half, 90 + half)}
                  fill="black"
                />
              );
            })}
          </mask>

          {nodes.map((n) => (
            <g key={`arcs-${n.id}`}>
              <path id={`arc-t-${n.id}`} d={bottomArc(n.x, n.y, n.r * TITLE_K)} />
              <path id={`arc-s-${n.id}`} d={bottomArc(n.x, n.y, n.r * SUB_K)} />
            </g>
          ))}
        </defs>

        <g ref={camGroupRef} className="camera">
          <g className="lines" mask="url(#line-mask)">
            {guides.map((g, i) => (
              <DrawCircle key={g.id} className="hair guide" cx={g.x} cy={g.y} r={g.r} delay={420 + i * 120} duration={1300} />
            ))}
            {rings.map((ring, i) => (
              <DrawCircle key={`orbit-${ring.layer}`} className="hair orbit" cx={0} cy={0} r={ring.R} delay={i * 110} duration={1000} />
            ))}
            {nodes
              .filter((n) => n.layer <= 1)
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

          {nodes.map((n) => (
            <Node
              key={n.id}
              node={n}
              delay={nodeDelay(n)}
              hovered={n.id === hoveredId}
              selected={n.id === selectedId}
              labelVisible={labelsOn || n.id === hoveredId || n.id === selectedId}
              onHover={onHover}
              onSelect={(id) => {
                if (!dragged.current) onSelect(id);
              }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

function DrawCircle({ className, cx, cy, r, delay, duration }) {
  const len = 2 * Math.PI * r;
  return (
    <circle
      className={`${className} draw`}
      cx={cx}
      cy={cy}
      r={r}
      transform={`rotate(-90 ${cx} ${cy})`}
      style={{ "--len": len, "--delay": `${delay}ms`, "--dur": `${duration}ms` }}
    />
  );
}

function Node({ node: n, delay, hovered, selected, labelVisible, onHover, onSelect }) {
  const { data } = n;
  const origin = { transformOrigin: `${n.x}px ${n.y}px` };
  const tfs = n.r * TITLE_FS;
  const sfs = n.r * SUB_FS;

  return (
    <g
      className={`node${hovered ? " is-hover" : ""}${selected ? " is-selected" : ""}${data.isPlaceholder ? " is-empty" : ""}`}
      data-node={n.id}
      onPointerEnter={() => onHover(n.id)}
      onPointerLeave={() => onHover(null)}
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
          <circle className="node-fill" cx={n.x} cy={n.y} r={n.r} style={data.color ? { fill: data.color } : undefined} />
          {data.image && (
            <image
              href={data.image}
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

      <g className={`label${labelVisible ? " is-on" : ""}`} aria-hidden="true">
        <text className="label-title" style={{ fontSize: tfs, letterSpacing: tfs * 0.01 }}>
          <textPath href={`#arc-t-${n.id}`} startOffset="50%" textAnchor="middle">
            {data.title}
          </textPath>
        </text>
        {data.subtitle && (
          <text className="label-sub" style={{ fontSize: sfs, letterSpacing: sfs * 0.14 }}>
            <textPath href={`#arc-s-${n.id}`} startOffset="50%" textAnchor="middle">
              {data.subtitle}
            </textPath>
          </text>
        )}
      </g>
    </g>
  );
}
