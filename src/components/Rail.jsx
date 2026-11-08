// Left navigation rail: brand mark, layer timeline and utility links.

function Mark() {
  // Original mark: the formation itself, a centre with two rings of heirs.
  const ring = (R, n, rot, r) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((rot + (360 / n) * i - 90) * Math.PI) / 180;
      return <circle key={`${R}-${i}`} cx={R * Math.cos(a)} cy={R * Math.sin(a)} r={r} />;
    });
  return (
    <svg viewBox="-40 -40 80 80" className="mark" aria-hidden="true">
      <circle r="37" className="mark-line" />
      <circle r="22" className="mark-line" />
      <circle r="9" className="mark-solid" />
      <g className="mark-solid">
        {ring(22, 3, 0, 5)}
        {ring(37, 6, 30, 3.6)}
      </g>
    </svg>
  );
}

export default function Rail({ brand, formation, selected, onSelect, onOverview, onReplay, onFullscreen }) {
  const activeLayer = selected ? selected.layer : null;
  const chapters = [
    { layer: 0, label: "Centre", nodes: [formation.nodes[0]] },
    ...formation.rings.map((r) => ({ layer: r.layer, label: r.name, nodes: r.nodes })),
  ];

  return (
    <nav className="rail" data-panel aria-label="Formation layers">
      <button type="button" className="rail-brand" onClick={onOverview} aria-label={`${brand}, overview`}>
        <Mark />
        <h1 className="brand-name">{brand}</h1>
      </button>

      <ol className="chapters">
        {chapters.map((c) => {
          const active = c.layer === activeLayer;
          return (
            <li key={c.layer} className={`chapter${active ? " is-active" : ""}`}>
              <button type="button" className="chapter-btn" onClick={() => onSelect(c.nodes[0].id)}>
                <span className="chapter-dot" />
                <span className="chapter-num">{c.layer}</span>
                <span className="chapter-name">{c.label}</span>
              </button>
              {active && c.nodes.length > 1 && (
                <ul className="chapter-items">
                  {c.nodes.slice(0, 8).map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={`chapter-item${n.id === selected?.id ? " is-current" : ""}`}
                        onClick={() => onSelect(n.id)}
                      >
                        {n.data.title}
                      </button>
                    </li>
                  ))}
                  {c.nodes.length > 8 && <li className="chapter-more">+{c.nodes.length - 8}</li>}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      <div className="rail-links">
        <button type="button" onClick={onOverview}>
          Overview
        </button>
        <button type="button" onClick={onReplay}>
          Replay
        </button>
        <button type="button" onClick={onFullscreen}>
          Fullscreen
        </button>
      </div>
      <span className="rail-end" aria-hidden="true" />
    </nav>
  );
}
