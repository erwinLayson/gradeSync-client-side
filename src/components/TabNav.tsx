import React, {
  useCallback,
  useRef,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export interface TabItem<T extends string = string> {
  /** Unique key identifying the tab. */
  id: T;
  /** Primary label displayed inside the tab. */
  label: ReactNode;
  /** Optional icon displayed before the label (React element or Lucide/Feather icon component). */
  icon?:
  | ReactNode
  | ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  /** Optional badge count number or short string. */
  count?: number | string;
  /** Optional custom badge node (overrides count pill). */
  badge?: ReactNode;
  /** Whether the tab is disabled. */
  disabled?: boolean;
}

export interface TabNavProps<T extends string = string> {
  /** Array of tab definitions. */
  tabs: TabItem<T>[];
  /** Currently selected tab id. */
  activeTab: T;
  /** Callback fired when a tab is selected. */
  onChange: (tabId: T) => void;
  /** Accessible label describing the purpose of the tab group. */
  ariaLabel?: string;
  /** Optional extra classes for the outer container. */
  className?: string;
  /** Size variant: "sm" (compact) or "md" (standard default). */
  size?: "sm" | "md";
  /** If true, the container spans 100% width and tabs expand equally. */
  fullWidth?: boolean;
  /** Optional extra classes for each tab button. */
  tabClassName?: string;
}

function renderTabIcon(
  icon: TabItem["icon"],
  isActive: boolean
): ReactNode {
  if (!icon) return null;
  if (React.isValidElement(icon)) {
    return (
      <span className="shrink-0" aria-hidden="true">
        {icon}
      </span>
    );
  }
  if (typeof icon === "function" || typeof icon === "object") {
    const IconComponent = icon as ComponentType<{
      className?: string;
      "aria-hidden"?: boolean | "true" | "false";
    }>;
    return (
      <IconComponent
        className={`h-4 w-4 shrink-0 transition-colors ${isActive
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200"
          }`}
        aria-hidden="true"
      />
    );
  }
  return null;
}

/**
 * TabNav — Universal tab links component serving as the single source of truth
 * for tab navigation across the entire system.
 *
 * Enforces a consistent segmented capsule design matching the GradeSync / Abang-Suizo
 * design system (primary emerald accents, raised white active pill, subtle neutral container).
 * Fully keyboard-accessible per WAI-ARIA tab pattern (Left/Right arrows, Home, End).
 */
  export function TabNav<T extends string> ({
    tabs,
    activeTab,
    onChange,
    ariaLabel = "Navigation Tabs",
    className = "",
    size = "md",
    fullWidth = false,
    tabClassName = "",
  }: TabNavProps<T>) {
  const tablistRef = useRef<HTMLDivElement>(null);

  // WAI-ARIA roving tabindex keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      const enabledTabs = tabs.filter((t) => !t.disabled);
      if (enabledTabs.length === 0) return;

      let nextIndex = -1;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % tabs.length;
        while (tabs[nextIndex]?.disabled) {
          nextIndex = (nextIndex + 1) % tabs.length;
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        while (tabs[nextIndex]?.disabled) {
          nextIndex = (nextIndex - 1 + tabs.length) % tabs.length;
        }
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIndex = tabs.findIndex((t) => !t.disabled);
      } else if (e.key === "End") {
        e.preventDefault();
        for (let i = tabs.length - 1; i >= 0; i--) {
          if (!tabs[i]?.disabled) {
            nextIndex = i;
            break;
          }
        }
      }

      if (nextIndex >= 0 && nextIndex < tabs.length && tabs[nextIndex]) {
        const nextTab = tabs[nextIndex];
        onChange(nextTab.id);
        const button = tablistRef.current?.querySelector<HTMLButtonElement>(
          `[data-tab-id="${nextTab.id}"]`
        );
        button?.focus();
      }
    },
    [tabs, onChange]
  );

  const sizeClasses =
    size === "sm"
      ? "px-3 py-1.5 text-xs"
      : "px-4 py-2 text-xs md:text-[0.8125rem]";

  return (
    <div
      ref={tablistRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`${fullWidth ? "flex w-full" : "inline-flex"
        } items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/80 p-1.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60 ${className}`}
    >
      {tabs.map((tab, idx) => {
        const isActive = activeTab === tab.id;
        const iconNode = renderTabIcon(tab.icon, isActive);

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            data-tab-id={tab.id}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => {
              if (!tab.disabled) onChange(tab.id);
            }}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`group inline-flex items-center gap-2 rounded-lg font-bold transition-all duration-150 ease-in-out select-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed ${fullWidth ? "flex-1 justify-center" : ""
              } ${sizeClasses} ${isActive
                ? "border border-slate-200/80 bg-white text-emerald-800 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-emerald-400"
                : "border border-transparent text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-white"
              } ${tabClassName}`}
          >
            {iconNode}
            <span className="truncate">{tab.label}</span>

            {/* Custom badge or count pill */}
            {tab.badge ? (
              tab.badge
            ) : tab.count !== undefined && tab.count !== null ? (
              <span
                className={`ml-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums transition-colors ${isActive
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                    : "bg-slate-200/70 text-slate-600 group-hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                  }`}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default TabNav;

