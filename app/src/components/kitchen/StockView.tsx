import { useState, useEffect, useId, type KeyboardEvent } from "react";
import { Icon } from "../Icon";
import type { KitchenLayout, Shelf } from "../../domain/kitchen";
import {
  type Inventory,
  type InventoryItem,
  type QuantityState,
  type MeasureMode,
  type UnitKind,
  type ItemSize,
  type SortBy,
  QUANTITY_STATES,
  quantityLabel,
  itemsForShelf,
  daysUntil,
} from "../../domain/inventory";
import { categorize } from "../../domain/categories";
import { normalizeName } from "../../domain/normalize";
import { suggestItems } from "../../domain/suggest";

// A small palette for tagging items by color. Mid-saturation so it reads on both
// the light and dark themes.
const ITEM_COLORS = [
  "#d98b8b", // red
  "#e0a96d", // orange
  "#e6c86e", // yellow
  "#9ccb7a", // green
  "#7ac0a8", // teal
  "#c2a98a", // tan
  "#ece0bf", // cream
  "#9aa0a6", // gray
];

interface ItemInput {
  name: string;
  quantity: QuantityState;
  expiresAt?: string;
}

interface Handlers {
  onAdd: (shelfId: string, input: ItemInput) => void;
  onSetQuantity: (id: string, q: QuantityState) => void;
  onRename: (id: string, name: string) => void;
  onSetExpiry: (id: string, expiresAt?: string) => void;
  onSetCategory: (id: string, category?: string) => void;
  onSetColor: (id: string, color?: string) => void;
  onSetMeasure: (id: string, measure: MeasureMode) => void;
  onSetCount: (id: string, count: number) => void;
  onSetSize: (id: string, size?: ItemSize) => void;
  onRemove: (id: string) => void;
}

// The "30-second glance audit" surface (requirements §7.4): collapse/expand each
// shelf, sort by name or expiry, and edit what's on it. Items lay out in a 3-wide
// grid of compact cards.
export function StockView({
  layout,
  inventory,
  categories,
  rules,
  sortBy,
  onSortChange,
  learnedNames,
  onForget,
  ...handlers
}: {
  layout: KitchenLayout;
  inventory: Inventory;
  categories: string[];
  rules: Record<string, string>;
  sortBy: SortBy;
  onSortChange: (by: SortBy) => void;
  learnedNames: Set<string>;
  onForget: (name: string) => void;
} & Handlers) {
  const [openShelves, setOpenShelves] = useState<Set<string>>(new Set());

  const toggleShelf = (id: string) =>
    setOpenShelves((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Items that will still lack a category after a save (no manual one, no rule).
  const needs = inventory.items.filter(
    (i) => !i.category?.trim() && !categorize(i.name, rules),
  ).length;

  // Autocomplete vocabulary: every known item name (rule keys = seed + learned)
  // plus whatever is already in inventory.
  const vocab = (() => {
    const byNorm = new Map<string, string>();
    for (const k of Object.keys(rules)) byNorm.set(k, k);
    for (const it of inventory.items) {
      const n = it.name.trim().toLowerCase();
      if (n) byNorm.set(n, it.name.trim());
    }
    return [...byNorm.values()];
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Shared option list backing every category typeahead. */}
      <datalist id="dishes-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {needs > 0 && (
        <div className="banner banner--warning">
          {needs} item{needs > 1 ? "s" : ""} will need a category — type one (new names are added).
        </div>
      )}

      <div className="row" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
        <span className="muted xxs">Sort on save</span>
        <div className="chips">
          <button
            className={`chip ${sortBy === "name" ? "chip--on" : ""}`}
            onClick={() => onSortChange("name")}
          >
            Name
          </button>
          <button
            className={`chip ${sortBy === "expiry" ? "chip--on" : ""}`}
            onClick={() => onSortChange("expiry")}
          >
            Expiry
          </button>
        </div>
      </div>

      {layout.units.map((unit) => (
        <div key={unit.id} className="card">
          <p className="card__title">{unit.name}</p>

          {unit.compartments.map((c) => (
            <div key={c.id} className="k-stock-comp">
              <div className="k-compartment-head">
                <span>{c.label}</span>
                {c.pausesExpiry && (
                  <span className="xxs" title="Freezer pauses the expiry clock">
                    ❄ no clock
                  </span>
                )}
              </div>

              {c.columns.map((col, ci) => (
                <div key={col.id}>
                  {c.columns.length > 1 && <p className="muted xxs k-col-sub">Column {ci + 1}</p>}
                  {col.shelves.map((s) => (
                    <ShelfRow
                      key={s.id}
                      shelf={s}
                      pausesExpiry={c.pausesExpiry}
                      items={itemsForShelf(inventory, s.id)}
                      open={openShelves.has(s.id)}
                      onToggle={() => toggleShelf(s.id)}
                      rules={rules}
                      vocab={vocab}
                      learnedNames={learnedNames}
                      onForget={onForget}
                      {...handlers}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ShelfRow({
  shelf,
  pausesExpiry,
  items,
  open,
  onToggle,
  rules,
  vocab,
  learnedNames,
  onForget,
  onAdd,
  ...handlers
}: {
  shelf: Shelf;
  pausesExpiry: boolean;
  items: InventoryItem[];
  open: boolean;
  onToggle: () => void;
  rules: Record<string, string>;
  vocab: string[];
  learnedNames: Set<string>;
  onForget: (name: string) => void;
} & Handlers) {
  const expiring = items.some((i) => i.expiresAt && daysUntil(i.expiresAt) <= 3);

  return (
    <div>
      <button className="k-stock-shelf" onClick={onToggle}>
        <span className="k-stock-shelf-label">
          <span className="k-caret">{open ? "▾" : "▸"}</span> {shelf.label}
        </span>
        <span className="muted xxs">
          {items.length === 0 ? "empty" : `${items.length} item${items.length > 1 ? "s" : ""}`}
          {expiring && (
            <span className="k-dot-amber" title="something expiring soon">
              {" "}
              ●
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="k-stock-items">
          {items.length > 0 && (
            <div className="k-items-grid">
              {items.map((it) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  pausesExpiry={pausesExpiry}
                  rules={rules}
                  {...handlers}
                />
              ))}
            </div>
          )}
          <AddItemForm
            pausesExpiry={pausesExpiry}
            vocab={vocab}
            learnedNames={learnedNames}
            onForget={onForget}
            onAdd={(input) => onAdd(shelf.id, input)}
          />
        </div>
      )}
    </div>
  );
}

function ItemCard({
  item,
  pausesExpiry,
  rules,
  onSetQuantity,
  onRename,
  onSetExpiry,
  onSetCategory,
  onSetColor,
  onSetMeasure,
  onSetCount,
  onSetSize,
  onRemove,
}: {
  item: InventoryItem;
  pausesExpiry: boolean;
  rules: Record<string, string>;
} & Omit<Handlers, "onAdd">) {
  const [showColors, setShowColors] = useState(false);
  const d = item.expiresAt ? daysUntil(item.expiresAt) : null;
  const measure: MeasureMode = item.measure === "count" ? "count" : "level";

  const predicted = item.category?.trim() ? null : categorize(item.name, rules);
  const missingCat = !item.category?.trim() && !predicted;

  return (
    <div className="k-item-card">
      <div className="k-item-top">
        <button
          className="k-swatch"
          style={item.color ? { background: item.color, borderColor: item.color } : undefined}
          title="Color"
          aria-label="Pick color"
          onClick={() => setShowColors((s) => !s)}
        />
        <input
          className="input k-item-name"
          value={item.name}
          onChange={(e) => onRename(item.id, e.target.value)}
          aria-label="Item name"
        />
        <button className="k-item-x" title="Remove item" onClick={() => onRemove(item.id)}>
          <Icon name="x" size={13} />
        </button>
      </div>

      {showColors && (
        <div className="k-color-grid">
          {ITEM_COLORS.map((c) => (
            <button
              key={c}
              className={`k-color ${item.color === c ? "k-color--on" : ""}`}
              style={{ background: c }}
              title={c}
              onClick={() => {
                onSetColor(item.id, c);
                setShowColors(false);
              }}
            />
          ))}
          <button
            className="k-color k-color--none"
            title="No color"
            onClick={() => {
              onSetColor(item.id, undefined);
              setShowColors(false);
            }}
          >
            <Icon name="x" size={11} />
          </button>
        </div>
      )}

      <div className="k-qty">
        {measure === "count" ? (
          <CountStepper value={item.count ?? 1} onChange={(n) => onSetCount(item.id, n)} />
        ) : (
          <QuantityChips value={item.quantity} onChange={(q) => onSetQuantity(item.id, q)} />
        )}
        <button
          className="k-measure-toggle"
          title={measure === "count" ? "Switch to full/½/low" : "Switch to a count"}
          onClick={() => onSetMeasure(item.id, measure === "count" ? "level" : "count")}
        >
          {measure === "count" ? "≈" : "#"}
        </button>
      </div>

      <SizeControl size={item.size} onChange={(s) => onSetSize(item.id, s)} />

      <input
        className={`input k-cat ${missingCat ? "k-cat--missing" : ""}`}
        list="dishes-categories"
        value={item.category ?? ""}
        placeholder={missingCat ? "needs category" : predicted ? `auto: ${predicted}` : "category"}
        onChange={(e) => onSetCategory(item.id, e.target.value || undefined)}
        aria-label="Category"
      />

      {pausesExpiry ? (
        <span className="muted xxs">❄ frozen</span>
      ) : (
        <div className="k-exp">
          <span className="muted xxs k-exp-label">Exp.</span>
          <input
            type="date"
            className="input k-date"
            value={item.expiresAt ?? ""}
            onChange={(e) => onSetExpiry(item.id, e.target.value || undefined)}
            aria-label="Best by"
          />
          {d !== null && (
            <span className={`xxs ${d <= 3 ? "k-amber" : "muted"}`}>
              {d < 0 ? "expired" : `${d}d`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function AddItemForm({
  pausesExpiry,
  vocab,
  learnedNames,
  onForget,
  onAdd,
}: {
  pausesExpiry: boolean;
  vocab: string[];
  learnedNames: Set<string>;
  onForget: (name: string) => void;
  onAdd: (input: ItemInput) => void;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState<QuantityState>("full");
  const [expiresAt, setExpiresAt] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1); // highlighted suggestion; -1 = the text box
  const listId = useId();

  const suggestions = focused ? suggestItems(name, vocab) : [];

  // Keep the highlighted option scrolled into view while arrowing through.
  useEffect(() => {
    if (active >= 0) {
      document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [active, listId]);

  function submit() {
    const n = name.trim();
    if (!n) return;
    onAdd({ name: n, quantity, ...(expiresAt ? { expiresAt } : {}) });
    setName("");
    setQuantity("full");
    setExpiresAt("");
    setActive(-1);
  }

  function pick(s: string) {
    setName(s);
    setFocused(false);
    setActive(-1);
  }

  function onNameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      const chosen = active >= 0 ? suggestions[active] : undefined;
      if (chosen) {
        e.preventDefault();
        pick(chosen);
      } else {
        submit();
      }
    } else if (e.key === "Escape") {
      setFocused(false);
      setActive(-1);
    }
  }

  return (
    <div className="k-add-item">
      <div className="k-name-wrap">
        <input
          className="input"
          placeholder="Add an item…"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setActive(-1);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onNameKeyDown}
          aria-label="New item name"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        />
        {suggestions.length > 0 && (
          <div className="k-suggest" id={listId} role="listbox">
            {suggestions.map((s, i) => {
              const key = normalizeName(s);
              const learned = learnedNames.has(key);
              return (
                <div
                  key={s}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`k-suggest-row ${i === active ? "k-suggest-row--active" : ""}`}
                  onMouseEnter={() => setActive(i)}
                >
                  <button
                    type="button"
                    className="k-suggest-pick"
                    // mousedown fires before blur — keep focus so the click registers.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(s)}
                  >
                    {s}
                  </button>
                  {learned && (
                    <button
                      type="button"
                      className="k-suggest-forget"
                      title={`Forget “${s}”`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onForget(key)}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="k-add-item-row">
        <QuantityChips value={quantity} onChange={setQuantity} />
        {!pausesExpiry && (
          <input
            type="date"
            className="input k-date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            aria-label="Best by"
          />
        )}
        <button className="button button--primary button--small" onClick={submit} disabled={!name.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}

function CountStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  // Local text so the field can be cleared and retyped (up to 3 digits).
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  function edit(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 3);
    setText(digits);
    if (digits) onChange(parseInt(digits, 10));
  }

  return (
    <span className="k-count">
      <button className="k-step" title="Less" disabled={value <= 1} onClick={() => onChange(value - 1)}>
        −
      </button>
      <input
        className="input k-count-input"
        inputMode="numeric"
        value={text}
        onChange={(e) => edit(e.target.value)}
        onBlur={() => {
          if (!text) setText(String(value));
        }}
        aria-label="Count"
      />
      <button className="k-step" title="More" onClick={() => onChange(value + 1)}>
        ＋
      </button>
    </span>
  );
}

// Independent package/each size — a number + unit, learned as a default per name.
// Blank amount clears the size.
function SizeControl({ size, onChange }: { size?: ItemSize; onChange: (size?: ItemSize) => void }) {
  const [text, setText] = useState(size ? String(size.amount) : "");
  useEffect(() => setText(size ? String(size.amount) : ""), [size?.amount]);
  const unit: UnitKind = size?.unit ?? "unit";

  function editAmount(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 3);
    setText(digits);
    onChange(digits ? { amount: parseInt(digits, 10), unit } : undefined);
  }

  function editUnit(u: UnitKind) {
    const amt = text ? parseInt(text, 10) : size?.amount;
    if (amt) onChange({ amount: amt, unit: u });
  }

  return (
    <div className="k-size">
      <span className="muted xxs k-size-label">Size</span>
      <input
        className="input k-size-amt"
        inputMode="numeric"
        value={text}
        placeholder="—"
        onChange={(e) => editAmount(e.target.value)}
        aria-label="Size amount"
      />
      <select
        className="k-unit-select"
        value={unit}
        onChange={(e) => editUnit(e.target.value as UnitKind)}
        aria-label="Size unit"
      >
        <option value="unit">unit</option>
        <option value="oz">oz</option>
        <option value="lb">lb</option>
      </select>
    </div>
  );
}

function QuantityChips({
  value,
  onChange,
}: {
  value: QuantityState;
  onChange: (q: QuantityState) => void;
}) {
  return (
    <span className="qchips">
      {QUANTITY_STATES.map((q) => (
        <button
          key={q}
          type="button"
          className={`qchip ${value === q ? "qchip--on" : ""}`}
          onClick={() => onChange(q)}
          title={q}
        >
          {quantityLabel(q)}
        </button>
      ))}
    </span>
  );
}
