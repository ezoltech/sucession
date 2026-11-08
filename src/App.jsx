import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Formation from "./components/Formation";
import Panel from "./components/Panel";
import Rail from "./components/Rail";
import { buildFormation } from "./lib/formation";
import layers from "./data/layers.json";
import circles from "./data/circles.json";
import site from "./data/site.json";

const MOBILE = "(max-width: 767px)";
const COLLAPSED_W = 44; // matches --collapsed-w in index.css

function useStage(railRef, panelRef, collapsed) {
  const [stage, setStage] = useState(() => ({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight }));

  const measure = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panel = panelRef.current;
    let next;
    if (window.matchMedia(MOBILE).matches) {
      const head = panel?.querySelector(".panel-head")?.offsetHeight ?? 48;
      const sheet = collapsed ? head : (panel?.offsetHeight ?? vh * 0.45);
      next = { x: 0, y: 0, w: vw, h: Math.max(160, vh - sheet) };
    } else {
      const left = (railRef.current?.offsetWidth ?? 0) + (collapsed ? COLLAPSED_W : (panel?.offsetWidth ?? 0));
      next = { x: left, y: 0, w: Math.max(200, vw - left), h: vh };
    }
    setStage((s) => (s.x === next.x && s.y === next.y && s.w === next.w && s.h === next.h ? s : next));
  }, [railRef, panelRef, collapsed]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    if (panelRef.current) ro.observe(panelRef.current);
    if (railRef.current) ro.observe(railRef.current);
    return () => {
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [measure, panelRef, railRef]);

  return stage;
}

export default function App() {
  const formation = useMemo(() => buildFormation(layers, circles), []);
  const order = formation.nodes;
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [introKey, setIntroKey] = useState(0);
  const railRef = useRef(null);
  const panelRef = useRef(null);
  const stage = useStage(railRef, panelRef, collapsed);

  const selected = order.find((n) => n.id === selectedId) || null;
  const pos = selected ? order.indexOf(selected) : -1;
  const prev = order[(pos - 1 + order.length) % order.length];
  const next = order[(pos + 1) % order.length];
  const ringName = selected && selected.layer > 0 ? formation.rings[selected.layer - 1].name : "";

  const select = useCallback((id) => setSelectedId(id), []);
  const overview = useCallback(() => setSelectedId(null), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedId(next.id);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedId(prev.id);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  useEffect(() => {
    document.title = selected ? `${selected.data.title} · ${site.brand}` : `${site.collectionTitle} · ${site.brand}`;
  }, [selected]);

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className={`app${hoveredId ? " is-hovering" : ""}`}>
      <Formation
        key={introKey}
        formation={formation}
        stage={stage}
        selectedId={selectedId}
        hoveredId={hoveredId}
        onHover={setHoveredId}
        onSelect={select}
        onBackground={overview}
      />

      <div ref={railRef} className="rail-slot">
        <Rail
          brand={site.brand}
          formation={formation}
          selected={selected}
          onSelect={select}
          onOverview={overview}
          onReplay={() => {
            setSelectedId(null);
            setIntroKey((k) => k + 1);
          }}
          onFullscreen={fullscreen}
        />
      </div>

      <div ref={panelRef} className={`panel-slot${collapsed ? " is-collapsed" : ""}`}>
        <Panel
          site={site}
          formation={formation}
          selected={selected}
          ringName={ringName}
          prev={prev}
          next={next}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          onSelect={select}
          onOverview={overview}
        />
      </div>

      <button type="button" className="fs-btn" onClick={fullscreen} aria-label="Toggle fullscreen">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M1 5V1h4M11 1h4v4M15 11v4h-4M5 15H1v-4" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>

      <p className="hint" aria-hidden="true">
        {selected ? "← → to move · esc to return" : "hover to read · click to enter"}
      </p>
    </div>
  );
}
