import { AnimatePresence, motion } from "framer-motion";

const enter = {
  initial: { opacity: 0, y: 8, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -6, filter: "blur(4px)" },
  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
};

function Chevron({ dir = "left" }) {
  return (
    <svg width="7" height="10" viewBox="0 0 7 10" aria-hidden="true" className="chev">
      <path d={dir === "left" ? "M5.5 1 1.5 5l4 4" : "M1.5 1l4 4-4 4"} fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function MiniMap({ formation, selectedId, onSelect }) {
  const { nodes, rings, extent } = formation;
  const k = 34 / extent;
  return (
    <svg viewBox="-40 -40 80 80" className="minimap" aria-hidden="true">
      {rings.map((r) => (
        <circle key={r.layer} r={r.R * k} className="minimap-orbit" />
      ))}
      {nodes.map((n) => (
        <circle
          key={n.id}
          cx={n.x * k}
          cy={n.y * k}
          r={Math.max(1.6, n.r * k * 0.8)}
          className={`minimap-dot${n.id === selectedId ? " is-active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(n.id);
          }}
        />
      ))}
    </svg>
  );
}

export default function Panel({
  site,
  formation,
  selected,
  ringName,
  prev,
  next,
  collapsed,
  onToggle,
  onSelect,
  onOverview,
}) {
  const centre = formation.nodes[0];
  const isNode = !!selected;
  const d = selected?.data;

  const parent = isNode ? site.collectionTitle : site.breadcrumb;
  const current = isNode ? (selected.layer === 0 ? "Centre" : ringName) : site.collectionTitle;

  return (
    <aside className={`panel${collapsed ? " is-collapsed" : ""}`} data-panel>
      <header className="panel-head">
        <nav className="crumbs" aria-label="Breadcrumb">
          <button type="button" className="crumb crumb-back" onClick={onOverview}>
            <Chevron /> {parent}
          </button>
          <span className="crumb-sep">/</span>
          <span className="crumb crumb-current">{current}</span>
        </nav>
        <button type="button" className="collapse-btn" onClick={onToggle} aria-label={collapsed ? "Open panel" : "Collapse panel"}>
          {collapsed ? "‹›" : "›‹"}
        </button>
      </header>

      <div className="panel-scroll">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={selected?.id ?? "overview"} {...enter} className="panel-body">
            <h2 className="panel-title">{isNode ? d.title : site.collectionTitle}</h2>
            <p className="owner">
              <span className="owner-label">{isNode ? d.subtitleLabel || site.ownerLabel : site.ownerLabel}</span>{" "}
              <span className="owner-name">{isNode ? d.subtitle || "Unassigned" : site.owner}</span>
            </p>

            <div className="tokens">
              <button
                type="button"
                className="token is-active"
                onClick={() => onSelect(isNode ? selected.id : centre.id)}
                aria-label={`Focus ${isNode ? d.title : centre.data.title}`}
              >
                {(isNode ? d.image : centre.data.image) ? (
                  <img src={isNode ? d.image : centre.data.image} alt="" />
                ) : (
                  <span className="token-empty" />
                )}
              </button>
              <div className="token token-map" title="Position in the formation">
                <MiniMap formation={formation} selectedId={selected?.id} onSelect={onSelect} />
              </div>
            </div>

            {isNode ? (
              <>
                <section className="notes">
                  <h3 className="section-label">Notes</h3>
                  {d.description.length ? (
                    d.description.map((p, i) => <p key={i}>{p}</p>)
                  ) : (
                    <p className="muted">No description yet. Add one for this circle in src/data/circles.json.</p>
                  )}
                </section>
                {d.details.length > 0 && (
                  <dl className="details">
                    {d.details.map((row, i) => (
                      <div key={i} className="detail-row">
                        <dt>{row.label}</dt>
                        <dd>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </>
            ) : (
              <>
                <section className="poem">
                  {site.intro.map((stanza, i) => (
                    <div key={i} className="stanza">
                      {stanza.map((line, j) => (
                        <p key={j}>{line}</p>
                      ))}
                    </div>
                  ))}
                </section>
                <section className="notes">
                  <h3 className="section-label">Notes</h3>
                  {site.notes.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </section>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="panel-foot">
        <div className="edition-row">
          <span>{isNode ? (selected.layer === 0 ? "Centre" : `Layer ${selected.layer} · ${ringName}`) : "Circles"}</span>
          <span className="edition-count">
            {isNode
              ? `${selected.index + 1}/${selected.count}`
              : `1 + ${formation.rings.map((r) => r.count).join(" + ")}`}
          </span>
        </div>
        <div className="pager">
          <button type="button" onClick={() => onSelect(prev.id)} className="pager-btn">
            <Chevron /> <span>{prev.data.title}</span>
          </button>
          <button type="button" onClick={() => onSelect(next.id)} className="pager-btn pager-next">
            <span>{next.data.title}</span> <Chevron dir="right" />
          </button>
        </div>
      </footer>
    </aside>
  );
}
