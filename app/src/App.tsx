import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { NavBar, type NavPage } from "./components/NavBar";
import { NAV_PAGES, pageFromPath, pathForPage } from "./routes";
import { storage, StorageKeys } from "./clients/storage";
import { Today } from "./pages/Today";
import { Plan } from "./pages/Plan";
import { Kitchen } from "./pages/Kitchen";
import { Recipes } from "./pages/Recipes";
import { Settings } from "./pages/Settings";

// State-driven page selection backed by the History API: each tab maps to a path
// (/today, /plan, …) so Back/Forward move between tabs and a refresh stays put.

function loadStoredPage(): NavPage {
  const v = storage.get(StorageKeys.page);
  return v && (NAV_PAGES as string[]).includes(v) ? (v as NavPage) : "today";
}

// Prefer the URL on load (deep link / refresh), falling back to the last stored tab.
function initialPage(): NavPage {
  return pageFromPath(window.location.pathname) ?? loadStoredPage();
}

export function App() {
  const [page, setPage] = useState<NavPage>(initialPage);

  // Reset scroll on page change — it's a single document, so window scroll would
  // otherwise carry over between screens.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  // Remember the current tab so a refresh lands on the same page.
  useEffect(() => {
    storage.set(StorageKeys.page, page);
  }, [page]);

  // Browser Back/Forward → page. Registered once on mount; seeds history state so
  // the first Back has somewhere to return to.
  const pageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    window.history.replaceState(
      { page: pageRef.current },
      "",
      window.location.pathname + window.location.search,
    );
    const onPop = () => setPage(pageFromPath(window.location.pathname) ?? "today");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Switch page and push a history entry so Back returns here. Guard against a
  // matching path to avoid stacking duplicate entries.
  const nav = useCallback((p: NavPage) => {
    setPage(p);
    if (pageFromPath(window.location.pathname) !== p) {
      window.history.pushState({ page: p }, "", pathForPage(p));
    }
  }, []);

  let content: ReactNode;
  switch (page) {
    case "plan":
      content = <Plan />;
      break;
    case "kitchen":
      content = <Kitchen />;
      break;
    case "recipes":
      content = <Recipes />;
      break;
    case "settings":
      content = <Settings />;
      break;
    default:
      content = <Today onNavigate={nav} />;
  }

  return (
    <>
      <div className="app-main">{content}</div>
      <NavBar current={page} onNavigate={nav} />
    </>
  );
}
