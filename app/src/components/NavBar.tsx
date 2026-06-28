import { Icon, type IconName } from "./Icon";
import { AppLink } from "./AppLink";
import { pathForPage } from "../routes";

// Four bottom tabs + Settings (mockups.html#shell). The settings gear also lives
// in the Today header; both routes land on the same page.
export type NavPage = "today" | "plan" | "kitchen" | "recipes" | "settings";

const TABS: Array<{ id: NavPage; label: string; icon: IconName }> = [
  { id: "today", label: "Today", icon: "home" },
  { id: "plan", label: "Plan", icon: "calendar" },
  { id: "kitchen", label: "Kitchen", icon: "fridge" },
  { id: "recipes", label: "Recipes", icon: "book" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export function NavBar({
  current,
  onNavigate,
}: {
  current: NavPage;
  onNavigate: (p: NavPage) => void;
}) {
  return (
    <nav className="navbar">
      <div className="navbar__inner">
        {TABS.map((tab) => {
          const active = tab.id === current;
          return (
            <AppLink
              key={tab.id}
              href={pathForPage(tab.id)}
              onActivate={() => onNavigate(tab.id)}
              className="navbar__item"
              style={{
                color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                fontWeight: active ? 600 : 400,
              }}
            >
              <Icon name={tab.icon} size={22} />
              <span>{tab.label}</span>
            </AppLink>
          );
        })}
      </div>
    </nav>
  );
}
