import { useState } from "react";
import { KitchenMap } from "../components/kitchen/KitchenMap";
import { ExpiryList } from "../components/kitchen/ExpiryList";

// Three segments over one inventory (requirements §7.4–§7.6 · mockups #kitchen,
// #inventory, #garden): spatial Map, urgency-sorted Expiry, and the Garden page.
type Segment = "map" | "expiry" | "garden";

const SEGMENTS: Array<{ id: Segment; label: string }> = [
  { id: "map", label: "Map" },
  { id: "expiry", label: "Expiry" },
  { id: "garden", label: "Garden" },
];

export function Kitchen() {
  const [seg, setSeg] = useState<Segment>("map");

  return (
    <div className="shell">
      <h1 className="page-title">Kitchen</h1>
      <div className="chips" style={{ margin: "10px 0 16px" }}>
        {SEGMENTS.map((s) => (
          <button
            key={s.id}
            className={`chip ${seg === s.id ? "chip--on" : ""}`}
            onClick={() => setSeg(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {seg === "map" && <KitchenMap />}
      {seg === "expiry" && <ExpiryList />}
      {seg === "garden" && (
        <div className="card">
          <p className="muted sm">The single garden surface, scope-fenced (§8).</p>
        </div>
      )}
    </div>
  );
}
