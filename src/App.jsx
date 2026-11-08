import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Formation from "./components/Formation";
import Panel from "./components/Panel";
import Rail from "./components/Rail";
import { buildFormation, randomHighlight } from "./lib/formation";
import layers from "./data/layers.json";
import circles from "./data/circles.json";
import site from "./data/site.json";

const MOBILE = "(max-width: 767px)";
const COLLAPSED_W = 44; // matches --collapsed-w in index.css

function useStage(railRef, panelRef, collapsed, immersive) {
  const [stage, setStage] = useState(() => ({
    x: 0,
    y: 0,
    w: window.innerWidth,
    h: window.innerHeight,
  }));

  const measure = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panel = panelRef.current;
    let next;
    if (immersive) {
      // full screen mode: the sidebar is gone, the formation gets the whole window
      next = { x: 0, y: 0, w: vw, h: vh };
    } else if (window.matchMedia(MOBILE).matches) {
      const head = panel?.querySelector(".panel-head")?.offsetHeight ?? 48;
      const sheet = collapsed ? head : (panel?.offsetHeight ?? vh * 0.45);
      next = { x: 0, y: 0, w: vw, h: Math.max(160, vh - sheet) };
    } else {
      const left =
        (railRef.current?.offsetWidth ?? 0) +
        (collapsed ? COLLAPSED_W : (panel?.offsetWidth ?? 0));
      next = { x: left, y: 0, w: Math.max(200, vw - left), h: vh };
    }
    setStage((s) =>
      s.x === next.x && s.y === next.y && s.w === next.w && s.h === next.h
        ? s
        : next,
    );
  }, [railRef, panelRef, collapsed, immersive]);

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
  const rings = formation.rings;
  const [selectedId, setSelectedId] = useState(null);
  const [selectedLayer, setSelectedLayer] = useState(null); // layer number (1…n) whose string is lit
  const [layerColor, setLayerColor] = useState(null); // random highlight colour, only set while a layer is selected
  const [hoveredId, setHoveredId] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [introKey, setIntroKey] = useState(0);
  const railRef = useRef(null);
  const panelRef = useRef(null);
  const stage = useStage(railRef, panelRef, collapsed, immersive);

  const selected = order.find((n) => n.id === selectedId) || null;
  const layer =
    !selected && selectedLayer ? rings[selectedLayer - 1] || null : null;
  const pos = selected ? order.indexOf(selected) : -1;
  const prev = order[(pos <= 0 ? order.length : pos) - 1];
  const next = order[(pos + 1) % order.length];
  const ringName =
    selected && selected.layer > 0
      ? formation.rings[selected.layer - 1].name
      : "";
  const layerPos = layer ? rings.indexOf(layer) : -1;
  const prevLayer = layer
    ? rings[(layerPos - 1 + rings.length) % rings.length]
    : null;
  const nextLayer = layer ? rings[(layerPos + 1) % rings.length] : null;

  // picking a circle clears any lit layer; picking a layer clears the circle and rolls a new colour
  const select = useCallback((id) => {
    setSelectedLayer(null);
    setLayerColor(null);
    setSelectedId(id);
  }, []);
  const selectLayer = useCallback((n) => {
    setSelectedId(null);
    setSelectedLayer(n);
    setLayerColor((c) => randomHighlight(c));
  }, []);
  const overview = useCallback(() => {
    setSelectedId(null);
    setSelectedLayer(null);
    setLayerColor(null);
  }, []);

  // Full screen: the sidebar disappears completely and the browser goes full screen too
  const toggleFullscreen = useCallback(() => {
    const on = !immersive;
    setImmersive(on);
    if (on) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement)
      document.exitFullscreen?.().catch(() => {});
  }, [immersive]);

  // leaving browser full screen (Esc, F11 …) also leaves full screen mode
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setImmersive(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // typing in the search box must not move the formation
      if (
        e.target?.closest?.("input, textarea, select, [contenteditable='true']")
      )
        return;
      const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
      const backward = e.key === "ArrowLeft" || e.key === "ArrowUp";
      if (forward || backward) {
        e.preventDefault();
        if (layer) selectLayer((forward ? nextLayer : prevLayer).layer);
        else setSelectedId((forward ? next : prev).id);
      } else if (e.key === "Escape") {
        if (immersive) toggleFullscreen();
        else overview();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    next,
    prev,
    layer,
    nextLayer,
    prevLayer,
    immersive,
    selectLayer,
    toggleFullscreen,
    overview,
  ]);

  useEffect(() => {
    const title = selected
      ? selected.data.title
      : layer
        ? layer.name
        : site.collectionTitle;
    document.title = `${title} · ${site.brand}`;
  }, [selected, layer]);

  return (
    <div
      className={`app${hoveredId ? " is-hovering" : ""}${immersive ? " is-immersive" : ""}`}
    >
      <Formation
        key={introKey}
        formation={formation}
        stage={stage}
        selectedId={selectedId}
        hoveredId={hoveredId}
        activeLayer={layer ? layer.layer : null}
        activeColor={layer ? layerColor : null}
        onHover={setHoveredId}
        onSelect={select}
        onSelectLayer={selectLayer}
        onBackground={overview}
      />

      <div ref={railRef} className="rail-slot">
        <Rail
          brand={site.brand}
          formation={formation}
          selected={selected}
          selectedLayer={layer ? layer.layer : null}
          onSelect={select}
          onOverview={overview}
          onReplay={() => {
            overview();
            setIntroKey((k) => k + 1);
          }}
          onFullscreen={toggleFullscreen}
        />
      </div>

      <div
        ref={panelRef}
        className={`panel-slot${collapsed ? " is-collapsed" : ""}`}
      >
        <Panel
          site={site}
          formation={formation}
          selected={selected}
          layer={layer}
          layerColor={layer ? layerColor : null}
          ringName={ringName}
          prev={prev}
          next={next}
          prevLayer={prevLayer}
          nextLayer={nextLayer}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          onSelect={select}
          onSelectLayer={selectLayer}
          onOverview={overview}
        />
      </div>

      <button
        type="button"
        className="fs-btn"
        onClick={toggleFullscreen}
        aria-label={immersive ? "Exit full screen" : "Enter full screen"}
        aria-pressed={immersive}
      >
        {immersive ? (
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M5 1v4H1M15 5h-4V1M11 15v-4h4M1 11h4v4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M1 5V1h4M11 1h4v4M15 11v4h-4M5 15H1v-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        )}
      </button>

      <p className="hint" aria-hidden="true">
        {immersive
          ? selected || layer
            ? "← → to move · esc to exit full screen"
            : "hover to read · click to enter · esc to exit full screen"
          : layer
            ? "← → to change group · esc to return"
            : selected
              ? "← → to move · esc to return"
              : "hover to read · click to enter"}
      </p>
    </div>
  );
}
