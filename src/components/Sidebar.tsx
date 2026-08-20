import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FiChevronsLeft, FiChevronsRight, FiLogOut } from "react-icons/fi";
import { DASHBOARD_LINKS, SCHOOL_NAME } from "../constant/navigation";
import { useUser } from "../hooks/useUser";
import { useSchoolInfo } from "../hooks/useSchoolInfo";
import { ConfirmDialog } from "./ConfirmDialog";
import "../style/sidebar.css";

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const navigate = useNavigate();
  const { user, loading, logout } = useUser();
  const { schoolName } = useSchoolInfo();
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutTriggerRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const toggleCollapse = () => setCollapsed((prev) => !prev);

  // The mobile drawer always renders fully expanded; the desktop collapsed
  // preference still applies once back on wide screens.
  const effectiveCollapsed = collapsed && !mobileOpen;

  // Move keyboard focus into the drawer when it opens.
  useEffect(() => {
    if (mobileOpen) {
      navRef.current?.querySelector<HTMLElement>("a")?.focus();
    }
  }, [mobileOpen]);

  // Close the mobile drawer with the Escape key.
  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onMobileClose?.();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, onMobileClose]);

  const closeConfirm = () => setConfirmOpen(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    const success = await logout();
    setLoggingOut(false);
    if (success) {
      navigate("/login", { replace: true });
    }
  }

  const navGroups = user ? DASHBOARD_LINKS[user.role] : DASHBOARD_LINKS.admin;
  const roleLabel = user ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "";
  const initials = user ? (user.email.charAt(0) || "?").toUpperCase() : "";

  return (
    <aside
      id="sidebar-navigation"
      aria-label="Sidebar navigation"
      className={`sidebar ${effectiveCollapsed ? "sidebar--collapsed" : ""} ${mobileOpen ? "sidebar--mobile-open" : ""}`}
    >
      {/* Decorative glows */}
      <div className="sidebar__glow sidebar__glow--accent" aria-hidden="true" />
      <div className="sidebar__glow sidebar__glow--leaf" aria-hidden="true" />

      {/* ===== Header ===== */}
      <header className="sidebar__header">
        <div className="sidebar__logo-wrap">
          <div className="sidebar__logo">
            <img
              src="https://depedtacurong.org/wp-content/uploads/2024/02/241134825_394178255747167_6128050800374409151_n-1024x1024.jpg"
              alt="School Logo"
            />
          </div>
          <span className="sidebar__status-dot" aria-hidden="true" />
        </div>

        <div className="sidebar__brand">
          <h1 className="sidebar__brand-name">Grade-sync</h1>
          <p className="sidebar__brand-sub">{schoolName || SCHOOL_NAME}</p>
        </div>

        <button
          type="button"
          onClick={toggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="sidebar__toggle"
        >
          {collapsed ? <FiChevronsRight /> : <FiChevronsLeft />}
        </button>
      </header>

      {/* Divider */}
      <div className="sidebar__divider" />

      {/* ===== Navigation ===== */}
      <nav ref={navRef} aria-label="Primary" className="sidebar__nav">
        {loading ? (
          <div className="sidebar__skeleton" aria-hidden="true">
            <div className="sidebar__skeleton-bar" />
            <div className="sidebar__skeleton-bar" />
            <div className="sidebar__skeleton-bar" />
          </div>
        ) : (
          navGroups.map((group) => (
            <div key={group.title} className="sidebar__group">
              <h2 className="sidebar__group-title">{group.title}</h2>
              <ul className="sidebar__list">
                {group.sections.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.label}>
                      <NavLink
                        key={item.label}
                        to={item.path}
                        end
                        onClick={() => onMobileClose?.()}
                        title={effectiveCollapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
                        }
                      >
                        <span className="sidebar__indicator" aria-hidden="true" />
                        <Icon className="sidebar__icon" aria-hidden="true" />
                        <span className="sidebar__label">{item.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </nav>

      {/* ===== Footer ===== */}
      <footer className="sidebar__footer">
        {user && (
          <div className="sidebar__user" title={effectiveCollapsed ? `${user.email} · ${roleLabel}` : undefined}>
            <span className="sidebar__user-avatar">{initials}</span>
            <div className="sidebar__user-info">
              <span className="sidebar__user-email">{user.email}</span>
              <span className="sidebar__user-role">{roleLabel}</span>
            </div>
          </div>
        )}

        <button
          ref={logoutTriggerRef}
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="sidebar__logout"
          title={effectiveCollapsed ? "Logout" : undefined}
        >
          <FiLogOut className="sidebar__logout-icon" aria-hidden="true" />
          <span className="sidebar__logout-label">Logout</span>
        </button>

        {effectiveCollapsed ? (
          <p className="sidebar__copyright">©</p>
        ) : (
          <p className="sidebar__copyright">
            © {new Date().getFullYear()} Grade-sync · All rights reserved
          </p>
        )}
      </footer>

      {/* ===== Logout confirmation dialog ===== */}
      <ConfirmDialog
        open={confirmOpen}
        title="Log out of Grade-sync?"
        description="You will need to sign in again to access your account."
        confirmLabel="Logout"
        confirmIcon={<FiLogOut aria-hidden="true" />}
        pending={loggingOut}
        pendingLabel="Logging out…"
        tone="danger"
        onConfirm={handleLogout}
        onClose={closeConfirm}
        triggerRef={logoutTriggerRef}
      />
    </aside>
  );
}
