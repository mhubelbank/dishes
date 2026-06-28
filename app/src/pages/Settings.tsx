import { useState, type ReactNode } from "react";
import { storage, StorageKeys } from "../clients/storage";
import { loadThemePref, setThemePref, type ThemePref } from "../clients/theme";

// Settings (requirements §7.12). Also the home of the BYO-key + data-repo
// connection that powers the git-as-DB datastore (see architecture.md).
export function Settings() {
  return (
    <div className="shell">
      <h1 className="page-title">Settings</h1>

      <AppearanceSection />


      <div className="card" style={{ marginTop: 16 }}>
        <p className="card__title">Connections</p>
        <p className="muted sm">
          Bring-your-own keys live in this browser only (localStorage), never on a server. The
          household data lives in a private <code>dishes-data</code> GitHub repo, read and written
          via the GitHub API.
        </p>
        <ul className="muted sm" style={{ margin: "10px 0 0", paddingLeft: 18 }}>
          <li>Anthropic API key — language tasks (auto-tag, receipt OCR, “why”, mood)</li>
          <li>GitHub token + data repo — the git-as-DB datastore</li>
        </ul>
        <AnthropicKeyRow />
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <p className="card__title">Household</p>
        <p className="muted sm">
          Stores (ranked + specialty), allergies (hard filter), meal windows, body &amp; nutrition
          targets, and the kitchen-zone layout the Map renders from.
        </p>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <p className="card__title">Diagnostics</p>
        <p className="muted sm">
          Recent on-device errors (scrubbed of secrets) and last-sync freshness. Nothing leaves
          the device on its own.
        </p>
      </div>

      <ResetSection />
    </div>
  );
}

// Stores the Anthropic key in this browser only (localStorage). Used by the app's
// future runtime language features. The batch cookbook-tagging pass is a CLI script
// and reads ANTHROPIC_API_KEY from the environment instead — see scripts/llm-enrich.
function AnthropicKeyRow() {
  const [key, setKey] = useState(() => storage.get(StorageKeys.anthropicApiKey) ?? "");
  const [saved, setSaved] = useState(false);

  function save(): void {
    const trimmed = key.trim();
    if (trimmed) storage.set(StorageKeys.anthropicApiKey, trimmed);
    else storage.remove(StorageKeys.anthropicApiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
      <input
        className="input"
        type="password"
        autoComplete="off"
        placeholder="sk-ant-…"
        value={key}
        onChange={(event) => setKey(event.target.value)}
        style={{ flex: 1 }}
        aria-label="Anthropic API key"
      />
      <button className="button button--small" onClick={save} type="button">
        Save
      </button>
      {saved ? <span className="muted xs">Saved</span> : null}
    </div>
  );
}

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function AppearanceSection() {
  const [pref, setPref] = useState<ThemePref>(() => loadThemePref());

  function choose(value: ThemePref): void {
    setThemePref(value);
    setPref(value);
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <p className="card__title">Appearance</p>
      <p className="muted sm">
        Theme for this browser. <strong>System</strong> follows your OS and switches live when it does.
      </p>
      <div role="group" aria-label="Theme" style={{ display: "flex", gap: 6, marginTop: 10 }}>
        {THEME_OPTIONS.map((option) => (
          <button
            aria-pressed={pref === option.value}
            className={`button button--small${pref === option.value ? " button--primary" : ""}`}
            key={option.value}
            onClick={() => choose(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResetSection() {
  const [confirming, setConfirming] = useState(false);

  function clearLocalData(): void {
    storage.clear();
    window.location.reload();
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <p className="card__title">Reset</p>
      <ResetRow
        title="Clear local data"
        description="Removes this app's local recipes, inventory, layout, keys, preferences, and learned rules from this browser."
        action={
          confirming ? (
            <div style={{ display: "flex", gap: 6 }}>
              <button className="button button--small" onClick={() => setConfirming(false)} type="button">
                Cancel
              </button>
              <button className="button button--small" onClick={clearLocalData} type="button">
                Confirm
              </button>
            </div>
          ) : (
            <button className="button button--small" onClick={() => setConfirming(true)} type="button">
              Clear
            </button>
          )
        }
      />
    </div>
  );
}

function ResetRow({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description: ReactNode;
  action: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        padding: "10px 0 0",
        borderTop: "0.5px solid var(--color-border-tertiary)",
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 500 }}>{title}</p>
        <p className="muted xs" style={{ marginTop: 4 }}>
          {description}
        </p>
      </div>
      <div style={{ flexShrink: 0 }}>{action}</div>
    </div>
  );
}
