import { useCallback, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { FiMenu } from "react-icons/fi";
import { Sidebar } from "./Sidebar";
import { SCHOOL_NAME } from "../constant/navigation";
import { useSchoolInfo } from "../hooks/useSchoolInfo";
import "../style/materLayout.css";

export default function MasterLayout() {
  const { pathname } = useLocation();
  const { schoolName } = useSchoolInfo();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Close the mobile drawer whenever the route changes. State is adjusted
  // during render (React's documented pattern) instead of in an effect, so the
  // layout re-renders before committing the new route.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileSidebarOpen(false);
  }

  const rawTitle = pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "Dashboard";
  const pageTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);

  return (
    <main className="layout">
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={closeMobileSidebar}
      />

      {/* Backdrop behind the mobile drawer */}
      {mobileSidebarOpen && (
        <div
          className="sidebar__backdrop"
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      <section className="layout__main">
        <header className="layout__header">
          <div className="layout__header-left">
            {/* Hidden while the drawer is open so it doesn't overlay the school logo */}
            {!mobileSidebarOpen && (
              <button
                type="button"
                className="layout__menu"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={false}
                aria-controls="sidebar-navigation"
              >
                <FiMenu aria-hidden="true" />
              </button>
            )}
            <div className="layout__heading">
              <h1 className="layout__title">{pageTitle}</h1>
              <p className="layout__subtitle">{schoolName || SCHOOL_NAME}</p>
            </div>
          </div>
          <span className="layout__date">{today}</span>
        </header>

        <div className="layout__content">
          <Outlet />
        </div>
      </section>
    </main>
  );
}
