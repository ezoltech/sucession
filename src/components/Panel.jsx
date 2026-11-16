import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { searchFormation } from "../lib/formation";

const enter = {
  initial: { opacity: 0, y: 8, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -6, filter: "blur(4px)" },
  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
};

function Chevron({ dir = "left" }) {
  return (
    <svg
      width="7"
      height="10"
      viewBox="0 0 7 10"
      aria-hidden="true"
      className="chev"
    >
      <path
        d={dir === "left" ? "M5.5 1 1.5 5l4 4" : "M1.5 1l4 4-4 4"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      aria-hidden="true"
      className="search-icon"
    >
      <circle
        cx="5.4"
        cy="5.4"
        r="4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M8.6 8.6 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function MiniMap({
  formation,
  selectedId,
  activeLayer,
  activeColor,
  onSelect,
}) {
  const { nodes, rings, extent } = formation;
  const k = 34 / extent;
  // the plain formation keeps its big dots; in the cross everything is smaller, so the dots are too
  const minDot = formation.groups.length > 1 ? 0.45 : 1.6;
  return (
    <svg viewBox="-40 -40 80 80" className="minimap" aria-hidden="true">
      {rings.map((r) => {
        const lit = r.key === activeLayer;
        return (
          <circle
            key={r.key}
            cx={r.cx * k}
            cy={r.cy * k}
            r={r.R * k}
            className={`minimap-orbit${lit ? " is-lit" : ""}`}
            style={lit && activeColor ? { stroke: activeColor } : undefined}
          />
        );
      })}
      {nodes.map((n) => (
        <circle
          key={n.id}
          cx={n.x * k}
          cy={n.y * k}
          r={Math.max(minDot, n.r * k * 0.8)}
          className={`minimap-dot${n.id === selectedId ? " is-active" : ""}${n.ring === activeLayer ? " is-lit" : ""}`}
          style={
            n.ring === activeLayer && activeColor
              ? { fill: activeColor }
              : undefined
          }
          onClick={(e) => {
            e.stopPropagation();
            onSelect(n.id);
          }}
        />
      ))}
    </svg>
  );
}

// Search box: Enter (or the Search button) jumps to the best match; Enter again goes to the next match.
function Search({ formation, onSelect, onSelectLayer }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef(null);
  const q = query.trim();
  const results = useMemo(
    () => searchFormation(formation, q, 8),
    [formation, q],
  );

  const go = (res, idx) => {
    if (!res) return;
    if (res.kind === "layer") onSelectLayer(res.layer);
    else onSelect(res.id);
    setOpen(false);
    setCursor(results.length ? (idx + 1) % results.length : 0);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!q) return;
    setSubmitted(true);
    if (!results.length) {
      setOpen(true);
      return;
    }
    const idx = Math.min(cursor, results.length - 1);
    go(results[idx], idx);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!results.length) return;
      e.preventDefault();
      setOpen(true);
      const d = e.key === "ArrowDown" ? 1 : -1;
      setCursor(
        (c) =>
          (Math.min(c, results.length - 1) + d + results.length) %
          results.length,
      );
    } else if (e.key === "Escape") {
      if (open) setOpen(false);
      else if (query) setQuery("");
      else inputRef.current?.blur();
    }
  };

  const showList = open && q && (results.length > 0 || submitted);

  return (
    <form
      className="search"
      role="search"
      onSubmit={submit}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <div className="search-field">
        <SearchIcon />
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          value={query}
          placeholder="Search circles and groups"
          aria-label="Search circles and groups"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
            setSubmitted(false);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setOpen(false);
              inputRef.current?.focus();
            }}
          >
            ×
          </button>
        )}
        <button type="submit" className="search-go">
          Search
        </button>
      </div>

      {showList && (
        <ul
          className="search-results"
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
        >
          {results.map((res, i) => (
            <li
              key={`${res.kind}-${res.id ?? res.layer}`}
              role="option"
              aria-selected={i === cursor}
            >
              <button
                type="button"
                className={`search-item${i === cursor ? " is-cursor" : ""}`}
                onClick={() => go(res, i)}
                onMouseEnter={() => setCursor(i)}
              >
                <span className="search-item-title">{res.title}</span>
                {res.meta && (
                  <span className="search-item-meta">{res.meta}</span>
                )}
              </button>
            </li>
          ))}
          {!results.length && (
            <li className="search-empty">No match for “{q}”</li>
          )}
        </ul>
      )}
    </form>
  );
}

export default function Panel({
  site,
  formation,
  selected,
  layer = null,
  layerColor = null,
  ringName,
  group,
  prev,
  next,
  prevLayer = null,
  nextLayer = null,
  collapsed,
  onToggle,
  onSelect,
  onSelectLayer,
  onOverview,
}) {
  const centre = formation.nodes[0];
  const isNode = !!selected;
  const isLayer = !isNode && !!layer;
  const d = selected?.data;

  const crossed = formation.groups.length > 1;
  // where a circle's own text lives, so the "no description yet" hint points at the right file
  const dataFile =
    group.id === "c"
      ? 'src/data/circles.json, or in its layer\'s "members" in src/data/layers.json'
      : selected?.layer === 0
        ? `src/data/cross.json (arms → ${group.dir} → center)`
        : `src/data/cross.json (arms → ${group.dir} → layers → members)`;

  const parent = isNode || isLayer ? site.collectionTitle : site.breadcrumb;
  const current = isNode
    ? selected.layer === 0
      ? group.id === "c"
        ? "Centre"
        : `${group.name} centre`
      : ringName
    : isLayer
      ? layer.name
      : site.collectionTitle;
  const groupTag = (g) => (g.id === "c" ? "Centre" : g.name);
  // groups that have layers of their own; a plain single-circle arm has nothing to list
  const layered = formation.groups.filter((g) => g.rings.length > 0);

  return (
    <aside className={`panel${collapsed ? " is-collapsed" : ""}`} data-panel>
      <header className="panel-head">
        <nav className="crumbs" aria-label="Breadcrumb">
          <button
            type="button"
            className="crumb crumb-back"
            onClick={onOverview}
          >
            <Chevron /> {parent}
          </button>
          <span className="crumb-sep">/</span>
          <span className="crumb crumb-current">{current}</span>
        </nav>
        <button
          type="button"
          className="collapse-btn"
          onClick={onToggle}
          aria-label={collapsed ? "Open panel" : "Collapse panel"}
        >
          {collapsed ? "‹›" : "›‹"}
        </button>
      </header>

      <Search
        formation={formation}
        onSelect={onSelect}
        onSelectLayer={onSelectLayer}
      />

      <div className="panel-scroll">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={
              selected?.id ?? (isLayer ? `layer-${layer.key}` : "overview")
            }
            {...enter}
            className="panel-body"
          >
            <h2 className="panel-title">
              {isNode ? d.title : isLayer ? layer.name : site.collectionTitle}
            </h2>
            <p className="owner">
              {isLayer ? (
                <>
                  <span className="owner-label">Group</span>{" "}
                  <span className="owner-name">
                    {crossed ? `${groupTag(group)} · ` : ""}Layer {layer.layer} ·{" "}
                    {layer.count} {layer.count === 1 ? "circle" : "circles"}
                  </span>
                </>
              ) : (
                <>
                  <span className="owner-label">
                    {isNode
                      ? d.subtitleLabel || site.ownerLabel
                      : site.ownerLabel}
                  </span>{" "}
                  <span className="owner-name">
                    {isNode ? d.subtitle || "Unassigned" : site.owner}
                  </span>
                </>
              )}
            </p>

            <div className="tokens">
              {isLayer ? (
                <div
                  className="token token-layer"
                  title={layer.name}
                  style={{ "--hl": layerColor || undefined }}
                >
                  <span className="layer-ring" />
                </div>
              ) : (
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
              )}
              <div
                className="token token-map"
                title="Position in the formation"
                style={{ "--hl": layerColor || undefined }}
              >
                <MiniMap
                  formation={formation}
                  selectedId={selected?.id}
                  activeLayer={isLayer ? layer.key : null}
                  activeColor={layerColor}
                  onSelect={onSelect}
                />
              </div>
            </div>

            {isNode ? (
              <>
                <section className="notes">
                  <h3 className="section-label">Notes</h3>
                  {d.description.length ? (
                    d.description.map((p, i) => <p key={i}>{p}</p>)
                  ) : (
                    <p className="muted">
                      No description yet. Add one for this circle in {dataFile}.
                    </p>
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
            ) : isLayer ? (
              <>
                <section className="notes">
                  <h3 className="section-label">About this group</h3>
                  {layer.description.length ? (
                    layer.description.map((p, i) => <p key={i}>{p}</p>)
                  ) : (
                    <p className="muted">
                      No group description yet. Add a "description" for this
                      layer in{" "}
                      {group.id === "c"
                        ? "src/data/layers.json"
                        : `src/data/cross.json (arms → ${group.dir} → layers)`}
                      .
                    </p>
                  )}
                </section>
                <dl className="details">
                  {crossed && (
                    <div className="detail-row">
                      <dt>Position</dt>
                      <dd>{groupTag(group)}</dd>
                    </div>
                  )}
                  <div className="detail-row">
                    <dt>Layer</dt>
                    <dd>{layer.layer}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Circles</dt>
                    <dd>{layer.count}</dd>
                  </div>
                </dl>
                <section className="members">
                  <h3 className="section-label">Circles in this group</h3>
                  <ul className="member-list">
                    {layer.nodes.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          className="member"
                          onClick={() => onSelect(n.id)}
                        >
                          <span
                            className="member-dot"
                            style={
                              n.data.color
                                ? { background: n.data.color }
                                : undefined
                            }
                          />
                          <span className="member-title">{n.data.title}</span>
                          {n.data.subtitle && (
                            <span className="member-sub">
                              {n.data.subtitle}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
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
                {formation.rings.length > 0 && (
                  <section className="members">
                    <h3 className="section-label">Groups</h3>
                    {layered.map((g) => (
                      <div key={g.id} className="member-set">
                        {layered.length > 1 && (
                          <button
                            type="button"
                            className="member-set-head"
                            onClick={() => onSelect(g.nodes[0].id)}
                          >
                            {groupTag(g)}
                          </button>
                        )}
                        <ul className="member-list">
                          {g.rings.map((r) => (
                            <li key={r.key}>
                              <button
                                type="button"
                                className="member"
                                onClick={() => onSelectLayer(r.key)}
                              >
                                <span className="member-num">{r.layer}</span>
                                <span className="member-title">{r.name}</span>
                                <span className="member-sub">{r.count}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </section>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="panel-foot">
        <div className="edition-row">
          <span>
            {isNode
              ? selected.layer === 0
                ? crossed
                  ? `${groupTag(group)}${group.id === "c" ? "" : " centre"}`
                  : "Centre"
                : `${crossed && group.id !== "c" ? `${group.name} · ` : ""}Layer ${selected.layer}${ringName && ringName !== `Layer ${selected.layer}` ? ` · ${ringName}` : ""}`
              : isLayer
                ? `Group · ${layer.name}`
                : "Circles"}
          </span>
          <span className="edition-count">
            {isNode
              ? `${selected.index + 1}/${selected.count}`
              : isLayer
                ? `${layer.layer}/${group.rings.length}`
                : crossed
                  ? `${formation.groups.length} groups · ${formation.nodes.length}`
                  : `1 + ${formation.rings.map((r) => r.count).join(" + ")}`}
          </span>
        </div>
        <div className="pager">
          {isLayer && prevLayer && nextLayer ? (
            <>
              <button
                type="button"
                onClick={() => onSelectLayer(prevLayer.key)}
                className="pager-btn"
              >
                <Chevron /> <span>{prevLayer.name}</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectLayer(nextLayer.key)}
                className="pager-btn pager-next"
              >
                <span>{nextLayer.name}</span> <Chevron dir="right" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onSelect(prev.id)}
                className="pager-btn"
              >
                <Chevron /> <span>{prev.data.title}</span>
              </button>
              <button
                type="button"
                onClick={() => onSelect(next.id)}
                className="pager-btn pager-next"
              >
                <span>{next.data.title}</span> <Chevron dir="right" />
              </button>
            </>
          )}
        </div>
      </footer>
    </aside>
  );
}
