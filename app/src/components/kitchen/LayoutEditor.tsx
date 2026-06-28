import { useState } from "react";
import { Icon } from "../Icon";
import {
  type KitchenLayout,
  type StorageUnit,
  type UnitType,
  type Arrangement,
  createUnit,
  addUnit,
  removeUnit,
  renameUnit,
  addColumn,
  removeColumn,
  addShelf,
  renameShelf,
  removeShelf,
  unitTypeLabel,
  arrangementLabel,
  MAX_COLUMNS,
} from "../../domain/kitchen";

const UNIT_TYPES: UnitType[] = ["fridge", "fridge_freezer", "chest_freezer", "pantry"];
const ARRANGEMENTS: Arrangement[] = ["fridge_top", "freezer_top", "side_by_side"];

// Structural editor: add storage units (fridge, fridge/freezer with a chosen
// arrangement, chest freezer, pantry — multiple of each), then add/rename/remove
// columns and shelves. Pantries can hold up to MAX_COLUMNS side-by-side columns.
export function LayoutEditor({
  layout,
  onChange,
}: {
  layout: KitchenLayout;
  onChange: (next: KitchenLayout) => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      {layout.units.length === 0 && !adding && (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="muted sm">
            No storage yet. Add your fridge, freezer, or pantry to start building the map.
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {layout.units.map((unit) => (
          <UnitCard
            key={unit.id}
            unit={unit}
            onRename={(name) => onChange(renameUnit(layout, unit.id, name))}
            onRemove={() => onChange(removeUnit(layout, unit.id))}
            onAddColumn={(compId) => onChange(addColumn(layout, unit.id, compId))}
            onRemoveColumn={(compId, columnId) =>
              onChange(removeColumn(layout, unit.id, compId, columnId))
            }
            onAddShelf={(compId, columnId) => onChange(addShelf(layout, unit.id, compId, columnId))}
            onRenameShelf={(compId, columnId, shelfId, label) =>
              onChange(renameShelf(layout, unit.id, compId, columnId, shelfId, label))
            }
            onRemoveShelf={(compId, columnId, shelfId) =>
              onChange(removeShelf(layout, unit.id, compId, columnId, shelfId))
            }
          />
        ))}
      </div>

      {adding ? (
        <AddUnitForm
          onAdd={(unit) => {
            onChange(addUnit(layout, unit));
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          className="button button--primary"
          style={{ marginTop: 12 }}
          onClick={() => setAdding(true)}
        >
          <Icon name="plus" size={16} /> Add storage
        </button>
      )}
    </div>
  );
}

function AddUnitForm({
  onAdd,
  onCancel,
}: {
  onAdd: (unit: StorageUnit) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<UnitType>("fridge");
  const [arrangement, setArrangement] = useState<Arrangement>("fridge_top");
  const [name, setName] = useState("");

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <p className="card__title">Add storage</p>

      <p className="label">Type</p>
      <div className="chips" style={{ marginBottom: 12 }}>
        {UNIT_TYPES.map((t) => (
          <button
            key={t}
            className={`chip ${type === t ? "chip--on" : ""}`}
            onClick={() => setType(t)}
          >
            {unitTypeLabel(t)}
          </button>
        ))}
      </div>

      {type === "fridge_freezer" && (
        <>
          <p className="label">Arrangement</p>
          <div className="chips" style={{ marginBottom: 12 }}>
            {ARRANGEMENTS.map((a) => (
              <button
                key={a}
                className={`chip ${arrangement === a ? "chip--on" : ""}`}
                onClick={() => setArrangement(a)}
              >
                {arrangementLabel(a)}
              </button>
            ))}
          </div>
        </>
      )}

      <p className="label">Name</p>
      <input
        className="input"
        placeholder={unitTypeLabel(type)}
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="button button--primary"
          onClick={() => onAdd(createUnit(type, { name, arrangement }))}
        >
          Add
        </button>
        <button className="button button--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function UnitCard({
  unit,
  onRename,
  onRemove,
  onAddColumn,
  onRemoveColumn,
  onAddShelf,
  onRenameShelf,
  onRemoveShelf,
}: {
  unit: StorageUnit;
  onRename: (name: string) => void;
  onRemove: () => void;
  onAddColumn: (compId: string) => void;
  onRemoveColumn: (compId: string, columnId: string) => void;
  onAddShelf: (compId: string, columnId: string) => void;
  onRenameShelf: (compId: string, columnId: string, shelfId: string, label: string) => void;
  onRemoveShelf: (compId: string, columnId: string, shelfId: string) => void;
}) {
  // Stacked types render top→bottom; side-by-side renders left→right. Compartment
  // array order already encodes which is on top (see createUnit).
  const direction = unit.arrangement === "side_by_side" ? "row" : "column";

  return (
    <div className="card">
      <div className="k-unit-head">
        <input
          className="input k-unit-name"
          value={unit.name}
          onChange={(e) => onRename(e.target.value)}
          aria-label="Unit name"
        />
        <span className="muted xxs k-unit-meta">
          {unitTypeLabel(unit.type)}
          {unit.arrangement ? ` · ${arrangementLabel(unit.arrangement)}` : ""}
        </span>
        <button
          className="button button--ghost button--small"
          title="Remove unit"
          onClick={onRemove}
        >
          <Icon name="x" size={15} />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: direction, gap: 8 }}>
        {unit.compartments.map((c) => {
          const multiCol = c.columns.length > 1;
          return (
            <div key={c.id} className={`k-compartment k-compartment--${c.kind}`}>
              <div className="k-compartment-head">
                <span>{c.label}</span>
                <span className="k-comp-actions">
                  {c.pausesExpiry && (
                    <span className="xxs" title="Freezer pauses the expiry clock">
                      ❄ no clock
                    </span>
                  )}
                  <button
                    className="button button--ghost k-add-col"
                    onClick={() => onAddColumn(c.id)}
                    disabled={c.columns.length >= MAX_COLUMNS}
                    title={
                      c.columns.length >= MAX_COLUMNS ? `Up to ${MAX_COLUMNS} columns` : "Add a column"
                    }
                  >
                    <Icon name="plus" size={12} />{" "}
                    {c.columns.length >= MAX_COLUMNS ? `max ${MAX_COLUMNS}` : "column"}
                  </button>
                </span>
              </div>

              <div className="k-columns">
                {c.columns.map((col, i) => (
                  <div key={col.id} className="k-column">
                    {multiCol && (
                      <div className="k-column-head">
                        <span className="muted xxs">Column {i + 1}</span>
                        <button
                          className="button button--ghost button--small"
                          title="Remove column"
                          onClick={() => onRemoveColumn(c.id, col.id)}
                        >
                          <Icon name="x" size={12} />
                        </button>
                      </div>
                    )}

                    {col.shelves.map((s) => (
                      <div key={s.id} className="k-shelf-row">
                        <input
                          className="input k-shelf"
                          value={s.label}
                          onChange={(e) => onRenameShelf(c.id, col.id, s.id, e.target.value)}
                          aria-label="Shelf label"
                        />
                        <button
                          className="button button--ghost button--small"
                          title="Remove shelf"
                          onClick={() => onRemoveShelf(c.id, col.id, s.id)}
                        >
                          <Icon name="x" size={13} />
                        </button>
                      </div>
                    ))}

                    <button
                      className="button button--ghost button--small k-add-shelf"
                      onClick={() => onAddShelf(c.id, col.id)}
                    >
                      <Icon name="plus" size={13} /> shelf
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
