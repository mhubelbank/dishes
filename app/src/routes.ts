import type { NavPage } from "./components/NavBar";

// Single source of truth for the History-API routes. Kept in its own module so
// both App (the router) and link components can share it without a cycle.
export const NAV_PAGES: NavPage[] = ["today", "plan", "kitchen", "recipes", "settings"];

export const pathForPage = (p: NavPage): string => `/${p}`;

// First path segment → page, if it's a known page (else null).
export function pageFromPath(path: string): NavPage | null {
  const seg = path.replace(/^\/+/, "").split("/")[0] ?? "";
  return (NAV_PAGES as string[]).includes(seg) ? (seg as NavPage) : null;
}
