import { useState, type ReactNode } from "react";
import { loadInventory } from "../../clients/inventoryStore";
import { loadLayout } from "../../clients/kitchenStore";
import {
  type InventoryItem,
  expiryBuckets,
  daysUntil,
  quantityLabel,
} from "../../domain/inventory";
import { shelfLocations, type ShelfLocation } from "../../domain/kitchen";

// Kitchen › Expiry (requirements §7.5): the other lens on the same inventory —
// sorted by what needs eating. Reads the saved inventory (not the Stock draft).
export function ExpiryList() {
  const inventory = loadInventory();
  const locations = shelfLocations(loadLayout());
  const b = expiryBuckets(inventory.items);

  const dated = b.now.length + b.soon.length + b.week.length + b.later.length;
  if (inventory.items.length === 0) {
    return (
      <div className="card">
        <p className="muted sm">Nothing stocked yet — add items in the Map segment.</p>
      </div>
    );
  }

  return (
    <div>
      {dated === 0 && (
        <div className="banner banner--info" style={{ marginBottom: 12 }}>
          No expiry dates set yet — add a “best by” to items in the Map to see them here.
        </div>
      )}

      <Section title="Use now" tone="danger" items={b.now} locations={locations} />
      <Section title="Use in 3 days" tone="warning" items={b.soon} locations={locations} />
      <Section title="Use this week" items={b.week} locations={locations} />
      <Collapsible title={`Later · ${b.later.length}`} hidden={b.later.length === 0}>
        {b.later.map((i) => (
          <ExpRow key={i.id} item={i} location={locations[i.shelfId]} />
        ))}
      </Collapsible>
      <Collapsible title={`No date · ${b.undated.length}`} hidden={b.undated.length === 0}>
        {b.undated.map((i) => (
          <ExpRow key={i.id} item={i} location={locations[i.shelfId]} />
        ))}
      </Collapsible>
    </div>
  );
}

function Section({
  title,
  tone,
  items,
  locations,
}: {
  title: string;
  tone?: "danger" | "warning";
  items: InventoryItem[];
  locations: Record<string, ShelfLocation>;
}) {
  if (items.length === 0) return null;
  const color =
    tone === "danger"
      ? "var(--color-text-danger)"
      : tone === "warning"
        ? "var(--color-text-warning)"
        : "var(--color-text-secondary)";
  return (
    <div className="k-exp-section">
      <p className="k-exp-head" style={{ color }}>
        {title}
      </p>
      {items.map((i) => (
        <ExpRow key={i.id} item={i} location={locations[i.shelfId]} />
      ))}
    </div>
  );
}

function Collapsible({
  title,
  hidden,
  children,
}: {
  title: string;
  hidden?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (hidden) return null;
  return (
    <div>
      <button className="k-exp-collapse" onClick={() => setOpen((o) => !o)}>
        <span className="k-caret">{open ? "▾" : "▸"}</span> {title}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function ExpRow({ item, location }: { item: InventoryItem; location?: ShelfLocation }) {
  const d = item.expiresAt ? daysUntil(item.expiresAt) : null;
  const badge =
    d === null ? "" : d < 0 ? `${-d}d ago` : d === 0 ? "today" : `${d}d`;
  const badgeClass = d === null ? "muted" : d < 0 ? "k-red" : d <= 3 ? "k-amber" : "muted";

  const amount =
    item.measure === "count" ? `×${item.count ?? 1}` : quantityLabel(item.quantity);
  const size = item.size ? ` · ${item.size.amount} ${item.size.unit}` : "";
  const where = location ? `${location.compartment} · ${location.shelf}` : "—";

  return (
    <div className="k-exp-row">
      <span className="k-exp-main">
        {item.color && <span className="k-dot-color" style={{ background: item.color }} />}
        <span style={{ minWidth: 0 }}>
          <span className="sm" style={{ display: "block" }}>
            {item.name}
          </span>
          <span className="muted xxs">{where}</span>
        </span>
      </span>
      <span className="k-exp-meta">
        <span className="muted xxs">
          {amount}
          {size}
        </span>
        {badge && <span className={`xxs ${badgeClass}`}>{badge}</span>}
      </span>
    </div>
  );
}
