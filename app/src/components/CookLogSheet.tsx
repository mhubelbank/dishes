import { useState } from "react";
import { Icon } from "./Icon";
import type { CookOutcome } from "../domain/cook";
import { REACTIONS, type CookReactions, type Reaction } from "../domain/cookLog";
import type { LeftoverLocation } from "../domain/leftovers";
import type { Recipe } from "../domain/recipes";

const REACTION_LABEL: Record<Reaction, string> = { loved: "Loved", fine: "Fine", meh: "Meh" };

// Time chips anchored to the recipe's claim (§7.9): "About right (N)", a couple of
// runs-longer presets, and a custom "Way off" entry.
function timeOptions(base: number): number[] {
  const round5 = (n: number) => Math.round(n / 5) * 5;
  return [...new Set([base, round5(base + 15), round5(base + 30)])].sort((a, b) => a - b);
}

// Done cooking sheet (requirements §7.9). Captures actual time, leftovers, a note,
// and per-palate reactions; the caller applies the side effects (deduct
// ingredients, create leftover, update your-time, mark the slot cooked).
export function CookLogSheet({
  recipe,
  baseMinutes,
  onSave,
  onClose,
}: {
  recipe: Recipe;
  baseMinutes: number;
  onSave: (result: CookOutcome) => void;
  onClose: () => void;
}) {
  const presets = timeOptions(baseMinutes);
  const [minutes, setMinutes] = useState(baseMinutes);
  const [custom, setCustom] = useState(false);
  const [leftover, setLeftover] = useState<LeftoverLocation | "none">("none");
  const [portions, setPortions] = useState(2);
  const [note, setNote] = useState("");
  const [reactions, setReactions] = useState<CookReactions>({});

  function toggleReaction(who: keyof CookReactions, value: Reaction): void {
    setReactions((prev) => ({ ...prev, [who]: prev[who] === value ? undefined : value }));
  }

  function save(): void {
    onSave({ actualMinutes: minutes, leftover, portions, note: note.trim(), reactions });
  }

  const sideEffects = [
    "deducts ingredients",
    "updates your time",
    leftover === "fridge" ? "saves fridge leftovers" : leftover === "freezer" ? "saves a freezer meal" : null,
  ].filter(Boolean);

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className="cooklog-sheet"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="cooklog-sheet__head">
          <div>
            <h2>Done cooking</h2>
            <p className="muted xs">{recipe.title}</p>
          </div>
          <button className="button button--ghost button--small" onClick={onClose} type="button">
            Cancel
          </button>
        </header>

        <div className="cooklog-field">
          <h3 className="cooklog-field__label">Your time</h3>
          <div className="chips" aria-label="Actual active time">
            {presets.map((option, index) => (
              <button
                className={`chip${!custom && minutes === option ? " chip--on" : ""}`}
                key={option}
                onClick={() => {
                  setCustom(false);
                  setMinutes(option);
                }}
                type="button"
              >
                {index === 0 ? `About right (${option})` : `~${option}`}
              </button>
            ))}
            <button
              className={`chip${custom ? " chip--on" : ""}`}
              onClick={() => setCustom(true)}
              type="button"
            >
              Way off
            </button>
            {custom ? (
              <label className="cooklog-custom">
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={minutes}
                  onChange={(event) => setMinutes(Number(event.target.value) || 1)}
                />
                <span className="muted xs">min active</span>
              </label>
            ) : null}
          </div>
        </div>

        <div className="cooklog-field">
          <h3 className="cooklog-field__label">Leftovers</h3>
          <div className="chips" aria-label="Leftovers">
            {(["none", "fridge", "freezer"] as const).map((option) => (
              <button
                className={`chip${leftover === option ? " chip--on" : ""}`}
                key={option}
                onClick={() => setLeftover(option)}
                type="button"
              >
                {option === "none" ? "None" : option === "fridge" ? "Fridge" : "Freezer"}
              </button>
            ))}
          </div>
          {leftover === "fridge" ? (
            <div className="cooklog-portions">
              <button
                className="button button--ghost button--small"
                onClick={() => setPortions((p) => Math.max(1, p - 1))}
                type="button"
                aria-label="Fewer portions"
              >
                –
              </button>
              <span>{portions} portions</span>
              <button
                className="button button--ghost button--small"
                onClick={() => setPortions((p) => Math.min(20, p + 1))}
                type="button"
                aria-label="More portions"
              >
                +
              </button>
              <span className="muted xs">eat within 3 days</span>
            </div>
          ) : leftover === "freezer" ? (
            <p className="muted xs">No clock — joins the freezer-meal pool.</p>
          ) : null}
        </div>

        <div className="cooklog-field">
          <h3 className="cooklog-field__label">Note</h3>
          <input
            className="cooklog-note"
            type="text"
            placeholder="A line for next time (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        <div className="cooklog-field">
          <h3 className="cooklog-field__label">Reactions</h3>
          {(["self", "partner"] as const).map((who) => (
            <div className="cooklog-reaction" key={who}>
              <span className="cooklog-reaction__who">{who === "self" ? "You" : "Partner"}</span>
              <div className="chips">
                {REACTIONS.map((value) => (
                  <button
                    className={`chip${reactions[who] === value ? " chip--herb" : ""}`}
                    key={value}
                    onClick={() => toggleReaction(who, value)}
                    type="button"
                  >
                    {REACTION_LABEL[value]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <footer className="cooklog-sheet__actions">
          <p className="muted xs cooklog-effects">Saving {sideEffects.join(" · ")}.</p>
          <button className="button button--success" onClick={save} type="button">
            <Icon name="check" size={16} />
            Save
          </button>
        </footer>
      </section>
    </div>
  );
}
