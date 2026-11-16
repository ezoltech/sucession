// // Left navigation rail: brand mark, layer timeline and utility links.

// function Mark() {
//   // Original mark: the formation itself, a centre with two rings of heirs.
//   const ring = (R, n, rot, r) =>
//     Array.from({ length: n }, (_, i) => {
//       const a = ((rot + (360 / n) * i - 90) * Math.PI) / 180;
//       return <circle key={`${R}-${i}`} cx={R * Math.cos(a)} cy={R * Math.sin(a)} r={r} />;
//     });
//   return (
//     <svg viewBox="-40 -40 80 80" className="mark" aria-hidden="true">
//       <circle r="37" className="mark-line" />
//       <circle r="22" className="mark-line" />
//       <circle r="9" className="mark-solid" />
//       <g className="mark-solid">
//         {ring(22, 3, 0, 5)}
//         {ring(37, 6, 30, 3.6)}
//       </g>
//     </svg>
//   );
// }

// export default function Rail({ brand, formation, selected, onSelect, onOverview, onReplay, onFullscreen }) {
//   const activeLayer = selected ? selected.layer : null;
//   const chapters = [
//     { layer: 0, label: "Centre", nodes: [formation.nodes[0]] },
//     ...formation.rings.map((r) => ({ layer: r.layer, label: r.name, nodes: r.nodes })),
//   ];

//   return (
//     <nav className="rail" data-panel aria-label="Formation layers">
//       <button type="button" className="rail-brand" onClick={onOverview} aria-label={`${brand}, overview`}>
//         <Mark />
//         <h1 className="brand-name">{brand}</h1>
//       </button>

//       <ol className="chapters">
//         {chapters.map((c) => {
//           const active = c.layer === activeLayer;
//           return (
//             <li key={c.layer} className={`chapter${active ? " is-active" : ""}`}>
//               <button type="button" className="chapter-btn" onClick={() => onSelect(c.nodes[0].id)}>
//                 <span className="chapter-dot" />
//                 <span className="chapter-num">{c.layer}</span>
//                 <span className="chapter-name">{c.label}</span>
//               </button>
//               {active && c.nodes.length > 1 && (
//                 <ul className="chapter-items">
//                   {c.nodes.slice(0, 8).map((n) => (
//                     <li key={n.id}>
//                       <button
//                         type="button"
//                         className={`chapter-item${n.id === selected?.id ? " is-current" : ""}`}
//                         onClick={() => onSelect(n.id)}
//                       >
//                         {n.data.title}
//                       </button>
//                     </li>
//                   ))}
//                   {c.nodes.length > 8 && <li className="chapter-more">+{c.nodes.length - 8}</li>}
//                 </ul>
//               )}
//             </li>
//           );
//         })}
//       </ol>

//       <div className="rail-links">
//         <button type="button" onClick={onOverview}>
//           Overview
//         </button>
//         <button type="button" onClick={onReplay}>
//           Replay
//         </button>
//         <button type="button" onClick={onFullscreen}>
//           Fullscreen
//         </button>
//       </div>
//       <span className="rail-end" aria-hidden="true" />
//     </nav>
//   );
// }

// Left navigation rail: brand mark, layer timeline and utility links.

function Mark() {
  // Original mark: the formation itself, a centre with two rings of heirs.
  const ring = (R, n, rot, r) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((rot + (360 / n) * i - 90) * Math.PI) / 180;
      return (
        <circle
          key={`${R}-${i}`}
          cx={R * Math.cos(a)}
          cy={R * Math.sin(a)}
          r={r}
        />
      );
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

// Where each group sits in the little cross that switches between them
const GROUP_CELL = {
  c: [2, 2],
  t: [1, 2],
  r: [2, 3],
  b: [3, 2],
  l: [2, 1],
};

export default function Rail({
  brand,
  formation,
  selected,
  selectedLayer = null,
  activeGroup = "c",
  onSelect,
  onOverview,
  onReplay,
  onFullscreen,
}) {
  // the chapters list the layers of one group at a time: the one you are in
  const group = formation.groupById.get(activeGroup) ?? formation.groups[0];
  // a selected circle lights up its layer; so does a selected layer string
  const activeChapter = selected ? (selected.ring ?? "centre") : selectedLayer;
  const chapters = [
    { key: "centre", num: 0, label: "Centre", nodes: [group.nodes[0]] },
    ...group.rings.map((r) => ({
      key: r.key,
      num: r.layer,
      label: r.name,
      nodes: r.nodes,
    })),
  ];

  return (
    <nav className="rail" data-panel aria-label="Formation layers">
      <button
        type="button"
        className="rail-brand"
        onClick={onOverview}
        aria-label={`${brand}, overview`}
      >
        <Mark />
        <h1 className="brand-name">{brand}</h1>
      </button>

      {formation.groups.length > 1 && (
        <div className="rail-groups" role="group" aria-label="Groups">
          {formation.groups.map((g) => {
            const [row, col] = GROUP_CELL[g.id] ?? [2, 2];
            const here = g.id === group.id;
            return (
              <button
                key={g.id}
                type="button"
                className={`rail-group${here ? " is-active" : ""}`}
                style={{ gridRow: row, gridColumn: col }}
                onClick={() => onSelect(g.nodes[0].id)}
                aria-label={g.id === "c" ? "Centre group" : `${g.name} group`}
                aria-pressed={here}
                title={g.id === "c" ? "Centre" : g.name}
              />
            );
          })}
        </div>
      )}

      <ol className="chapters">
        {chapters.map((c) => {
          const active = c.key === activeChapter;
          return (
            <li
              key={c.key}
              className={`chapter${active ? " is-active" : ""}`}
            >
              <button
                type="button"
                className="chapter-btn"
                onClick={() => onSelect(c.nodes[0].id)}
              >
                <span className="chapter-dot" />
                <span className="chapter-num">{c.num}</span>
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
                  {c.nodes.length > 8 && (
                    <li className="chapter-more">+{c.nodes.length - 8}</li>
                  )}
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
