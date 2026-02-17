"use client";

import Link from "next/link";
import { BarChart3, BookOpen, ClipboardCheck, FileText, LogOut, Users } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import styles from "./dashboard-shell.module.css";

type DashboardNavItem = {
  label: string;
  href: string;
  active?: boolean;
};

type DashboardShellProps = {
  title: string;
  subtitle?: string;
  navItems: DashboardNavItem[];
  children: ReactNode;
  appearance?: "default" | "glass";
  onLogout?: () => void;
};

const SIDEBAR_DIMENSIONS = {
  collapsed: {
    width: 72,
    padX: 12,
    padY: 14,
  },
  expanded: {
    width: 288,
    padX: 28,
    padY: 26,
  },
};

const OPEN_DURATION = 0.6;
const CLOSE_DURATION = 0.6;
const OPEN_EASING: [number, number, number, number] = [0.16, 1, 0.3, 1];
const CLOSE_EASING: [number, number, number, number] = [0.33, 0, 0.67, 1];
const OPEN_EASING_BEZIER = "cubic-bezier(0.16, 1, 0.3, 1)";
const CLOSE_EASING_BEZIER = "cubic-bezier(0.33, 0, 0.67, 1)";
const SIDEBAR_SQUEEZE = {
  collapsed: 0.96,
  expanded: 1,
};
const SIDEBAR_SHELL_SQUEEZE = {
  collapsed: 0.985,
  expanded: 1,
};
const MAIN_SHELL_SQUEEZE = {
  collapsed: 1,
  expanded: 1,
};

const resolveNavIcon = (label: string, href: string) => {
  const normalized = label.toLowerCase();
  if (href.startsWith("/student")) {
    return <BookOpen className={styles.navIcon} aria-hidden="true" strokeWidth={1.7} />;
  }
  if (normalized.includes("учен")) {
    return <Users className={styles.navIcon} aria-hidden="true" strokeWidth={1.7} />;
  }
  if (normalized.includes("проверк")) {
    return <ClipboardCheck className={styles.navIcon} aria-hidden="true" strokeWidth={1.7} />;
  }
  if (normalized.includes("аналит")) {
    return <BarChart3 className={styles.navIcon} aria-hidden="true" strokeWidth={1.7} />;
  }
  return <FileText className={styles.navIcon} aria-hidden="true" strokeWidth={1.7} />;
};

export default function DashboardShell({
  title,
  subtitle,
  navItems,
  children,
  appearance = "default",
  onLogout,
}: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const openTimer = useRef<number | null>(null);
  const hoverRef = useRef(false);
  const focusRef = useRef(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useRef(false);

  const readShellNumber = (element: HTMLElement, name: string, fallback: number) => {
    const raw = getComputedStyle(element).getPropertyValue(name).trim();
    if (!raw) return fallback;
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : fallback;
  };

  const getSidebarDimensions = (element: HTMLElement) => ({
    collapsed: {
      width: readShellNumber(element, "--sidebar-collapsed", SIDEBAR_DIMENSIONS.collapsed.width),
      padX: readShellNumber(element, "--sidebar-pad-x-collapsed", SIDEBAR_DIMENSIONS.collapsed.padX),
      padY: readShellNumber(element, "--sidebar-pad-y-collapsed", SIDEBAR_DIMENSIONS.collapsed.padY),
    },
    expanded: {
      width: readShellNumber(element, "--sidebar-expanded", SIDEBAR_DIMENSIONS.expanded.width),
      padX: readShellNumber(element, "--sidebar-pad-x-expanded", SIDEBAR_DIMENSIONS.expanded.padX),
      padY: readShellNumber(element, "--sidebar-pad-y-expanded", SIDEBAR_DIMENSIONS.expanded.padY),
    },
  });

  const openSidebar = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (openTimer.current) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    setIsSidebarOpen(true);
  }, []);

  const scheduleOpen = useCallback(() => {
    if (isSidebarOpen) return;
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (openTimer.current) {
      window.clearTimeout(openTimer.current);
    }
    openTimer.current = window.setTimeout(() => {
      if (!hoverRef.current && !focusRef.current) return;
      setIsSidebarOpen(true);
    }, 90);
  }, [isSidebarOpen]);

  const scheduleClose = useCallback(() => {
    if (openTimer.current) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
    }
    closeTimer.current = window.setTimeout(() => {
      if (hoverRef.current || focusRef.current) return;
      setIsSidebarOpen(false);
    }, 0);
  }, []);

  const closeSidebar = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (openTimer.current) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    setIsSidebarOpen(false);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      prefersReducedMotion.current = media.matches;
    };
    update();
    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useLayoutEffect(() => {
    if (!shellRef.current) return;
    const element = shellRef.current;
    const dimensions = getSidebarDimensions(element);
    const { width, padX, padY } = dimensions.collapsed;
    element.style.setProperty("--sidebar-width", `${width}px`);
    element.style.setProperty("--sidebar-pad-x", `${padX}px`);
    element.style.setProperty("--sidebar-pad-y", `${padY}px`);
    element.style.setProperty("--sidebar-squeeze", `${SIDEBAR_SQUEEZE.collapsed}`);
    element.style.setProperty("--sidebar-shell-squeeze", `${SIDEBAR_SHELL_SQUEEZE.collapsed}`);
    element.style.setProperty("--main-shell-squeeze", `${MAIN_SHELL_SQUEEZE.collapsed}`);
    element.style.setProperty("--sidebar-motion-ease", CLOSE_EASING_BEZIER);
  }, []);

  useEffect(() => {
    if (!shellRef.current) return;
    const element = shellRef.current;
    const duration = prefersReducedMotion.current
      ? 0
      : isSidebarOpen
        ? OPEN_DURATION
        : CLOSE_DURATION;
    const dimensions = getSidebarDimensions(element);
    const target = isSidebarOpen ? dimensions.expanded : dimensions.collapsed;
    const targetWidth = `${target.width}px`;
    const targetPadX = `${target.padX}px`;
    const targetPadY = `${target.padY}px`;
    const targetSqueeze = `${isSidebarOpen ? SIDEBAR_SQUEEZE.expanded : SIDEBAR_SQUEEZE.collapsed}`;
    const targetSidebarShellSqueeze = `${
      isSidebarOpen ? SIDEBAR_SHELL_SQUEEZE.expanded : SIDEBAR_SHELL_SQUEEZE.collapsed
    }`;
    const targetMainShellSqueeze = `${
      isSidebarOpen ? MAIN_SHELL_SQUEEZE.expanded : MAIN_SHELL_SQUEEZE.collapsed
    }`;

    element.style.setProperty("--sidebar-motion-duration", `${duration}s`);
    element.style.setProperty(
      "--sidebar-motion-ease",
      isSidebarOpen ? OPEN_EASING_BEZIER : CLOSE_EASING_BEZIER,
    );
    element.style.setProperty("--sidebar-width", targetWidth);
    element.style.setProperty("--sidebar-pad-x", targetPadX);
    element.style.setProperty("--sidebar-pad-y", targetPadY);
    element.style.setProperty("--sidebar-squeeze", targetSqueeze);
    element.style.setProperty("--sidebar-shell-squeeze", targetSidebarShellSqueeze);
    element.style.setProperty("--main-shell-squeeze", targetMainShellSqueeze);
  }, [isSidebarOpen]);

  return (
    <div className={`${styles.page} ${appearance === "glass" ? "glass-scope" : ""}`}>
      <div className={styles.container}>
        <a className={styles.skipLink} href="#dashboard-main">
          Перейти к содержимому
        </a>
        <div
          className={styles.shell}
          data-sidebar-open={isSidebarOpen ? "true" : "false"}
          ref={shellRef}
        >
          <aside
            className={styles.sidebar}
            onPointerEnter={() => {
              hoverRef.current = true;
              scheduleOpen();
            }}
            onPointerLeave={() => {
              hoverRef.current = false;
              scheduleClose();
            }}
            onFocus={() => {
              focusRef.current = true;
              openSidebar();
            }}
            onBlur={(event) => {
              const nextTarget = event.relatedTarget as Node | null;
              if (nextTarget && event.currentTarget.contains(nextTarget)) return;
              focusRef.current = false;
              scheduleClose();
            }}
            aria-expanded={isSidebarOpen}
          >
            <div className={styles.sidebarInner}>
              <div className={styles.sidebarHeader}>
                <div>
                  <div className={styles.kicker}>Континуум</div>
                  <div className={styles.sidebarTitle}>{title}</div>
                </div>
                <ThemeToggle compact />
              </div>
              {subtitle ? <div className={styles.sidebarSubtitle}>{subtitle}</div> : null}
              <nav className={styles.nav} aria-label="Разделы">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.navLink} ${item.active ? styles.navLinkActive : ""}`}
                    aria-current={item.active ? "page" : undefined}
                    onClick={closeSidebar}
                    onFocus={openSidebar}
                    title={item.label}
                  >
                    {resolveNavIcon(item.label, item.href)}
                    <span className={styles.navLabel}>{item.label}</span>
                  </Link>
                ))}
              </nav>
              {onLogout ? (
                <div className={styles.sidebarFooter}>
                  <button
                    type="button"
                    className={styles.navLink}
                    onClick={onLogout}
                    aria-label="Выйти"
                  >
                    <LogOut className={styles.navIcon} aria-hidden="true" strokeWidth={1.7} />
                    <span className={styles.navLabel}>Выйти</span>
                  </button>
                </div>
              ) : null}
            </div>
          </aside>
          <main id="dashboard-main" className={styles.main}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
