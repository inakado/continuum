"use client";

import Link from "next/link";
import { BarChart3, BookOpen, ClipboardCheck, FileText, LogOut, Settings, Users } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import ThemeToggle from "@/components/ThemeToggle";
import styles from "./student-dashboard-shell.module.css";
import themeStyles from "./student-dashboard-theme.module.css";

type DashboardNavItem = {
  label: string;
  href: string;
  active?: boolean;
};

export type StudentDashboardShellProps = {
  title: string;
  subtitle?: string;
  navItems: DashboardNavItem[];
  children: ReactNode;
  appearance?: "default" | "glass";
  onLogout?: () => void;
  settingsHref?: string;
};

type SidebarInnerProps = {
  title: string;
  subtitle?: string;
  navItems: DashboardNavItem[];
  onLogout?: () => void;
  settingsHref?: string;
  isSidebarOpen: boolean;
  onSidebarPointerEnter: () => void;
  onSidebarPointerLeave: () => void;
  onSidebarFocus: (event: ReactFocusEvent<HTMLElement>) => void;
  onSidebarBlur: (event: ReactFocusEvent<HTMLElement>) => void;
  onClose: () => void;
};

type ShellMainProps = {
  children: ReactNode;
};

const OPEN_DELAY_MS = 80;
const CLOSE_DELAY_MS = 140;
const LABEL_EASING: [number, number, number, number] = [0.16, 1, 0.3, 1];

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

const ShellMain = memo(function ShellMain({ children }: ShellMainProps) {
  return (
    <main id="dashboard-main" className={styles.main}>
      {children}
    </main>
  );
});

function SidebarInner({
  title,
  subtitle,
  navItems,
  onLogout,
  settingsHref,
  isSidebarOpen,
  onSidebarPointerEnter,
  onSidebarPointerLeave,
  onSidebarFocus,
  onSidebarBlur,
  onClose,
}: SidebarInnerProps) {
  const prefersReducedMotion = useReducedMotion();

  const enterFromX = prefersReducedMotion ? 0 : -8;
  const exitToX = prefersReducedMotion ? 0 : -6;

  const getEnterTransition = (index: number) =>
    prefersReducedMotion
      ? { duration: 0 }
      : { delay: index * 0.035, duration: 0.28, ease: LABEL_EASING };

  const getExitTransition = () =>
    prefersReducedMotion ? { duration: 0 } : { duration: 0.16, ease: LABEL_EASING };

  return (
    <aside
      className={styles.sidebar}
      onPointerEnter={onSidebarPointerEnter}
      onPointerLeave={onSidebarPointerLeave}
      onFocus={onSidebarFocus}
      onBlur={onSidebarBlur}
      aria-expanded={isSidebarOpen}
    >
      <div className={styles.sidebarInner}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarHeaderText}>
            <div className={styles.kicker}>Континуум</div>
            <div className={styles.sidebarTitle}>{title}</div>
          </div>
          <div className={styles.sidebarHeaderActions}>
            {settingsHref ? (
              <Link
                href={settingsHref}
                className={styles.sidebarIconAction}
                aria-label="Настройки преподавателя"
                title="Настройки преподавателя"
              >
                <Settings className={styles.navIcon} aria-hidden="true" strokeWidth={1.7} />
              </Link>
            ) : null}
            <ThemeToggle compact />
          </div>
        </div>

        {subtitle ? <div className={styles.sidebarSubtitle}>{subtitle}</div> : null}

        <LazyMotion features={domAnimation}>
          <nav className={styles.nav} aria-label="Разделы">
            {navItems.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${item.active ? styles.navLinkActive : ""}`}
                aria-current={item.active ? "page" : undefined}
                onClick={onClose}
                title={item.label}
              >
                <div className={styles.navIconWrapper}>{resolveNavIcon(item.label, item.href)}</div>
                <AnimatePresence initial={false}>
                  {isSidebarOpen ? (
                    <m.span
                      className={styles.navLabelMotion}
                      initial={{ opacity: 0, x: enterFromX }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        transition: getEnterTransition(index),
                      }}
                      exit={{ opacity: 0, x: exitToX, transition: getExitTransition() }}
                    >
                      {item.label}
                    </m.span>
                  ) : null}
                </AnimatePresence>
              </Link>
            ))}
          </nav>

          {onLogout ? (
            <div className={styles.sidebarFooter}>
              <button type="button" className={styles.navLink} onClick={onLogout} aria-label="Выйти">
                <div className={styles.navIconWrapper}>
                  <LogOut className={styles.navIcon} aria-hidden="true" strokeWidth={1.7} />
                </div>
                <AnimatePresence initial={false}>
                  {isSidebarOpen ? (
                    <m.span
                      className={styles.navLabelMotion}
                      initial={{ opacity: 0, x: enterFromX }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        transition: getEnterTransition(navItems.length),
                      }}
                      exit={{ opacity: 0, x: exitToX, transition: getExitTransition() }}
                    >
                      Выйти
                    </m.span>
                  ) : null}
                </AnimatePresence>
              </button>
            </div>
          ) : null}
        </LazyMotion>
      </div>
    </aside>
  );
}

export default function StudentDashboardShell({
  title,
  subtitle,
  navItems,
  children,
  appearance = "default",
  onLogout,
  settingsHref,
}: StudentDashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHoverCapable, setIsHoverCapable] = useState(true);
  const closeTimer = useRef<number | null>(null);
  const openTimer = useRef<number | null>(null);
  const hoverRef = useRef(false);
  const focusRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (openTimer.current) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openSidebar = useCallback(() => {
    if (!isHoverCapable) return;
    clearTimers();
    setIsSidebarOpen(true);
  }, [clearTimers, isHoverCapable]);

  const scheduleOpen = useCallback(() => {
    if (!isHoverCapable || isSidebarOpen) return;
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
    }, OPEN_DELAY_MS);
  }, [isHoverCapable, isSidebarOpen]);

  const scheduleClose = useCallback(() => {
    if (!isHoverCapable) return;
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
    }, CLOSE_DELAY_MS);
  }, [isHoverCapable]);

  const closeSidebar = useCallback(() => {
    if (!isHoverCapable) return;
    clearTimers();
    setIsSidebarOpen(false);
  }, [clearTimers, isHoverCapable]);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => {
      setIsHoverCapable(media.matches);
    };
    update();
    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    return clearTimers;
  }, [clearTimers]);

  useEffect(() => {
    if (isHoverCapable) return;
    hoverRef.current = false;
    focusRef.current = false;
    clearTimers();
    setIsSidebarOpen(false);
  }, [clearTimers, isHoverCapable]);

  const handleSidebarPointerEnter = useCallback(() => {
    if (!isHoverCapable) return;
    hoverRef.current = true;
    scheduleOpen();
  }, [isHoverCapable, scheduleOpen]);

  const handleSidebarPointerLeave = useCallback(() => {
    if (!isHoverCapable) return;
    hoverRef.current = false;
    scheduleClose();
  }, [isHoverCapable, scheduleClose]);

  const handleSidebarFocus = useCallback((event: ReactFocusEvent<HTMLElement>) => {
    if (!isHoverCapable) return;
    const target = event.target as HTMLElement | null;
    const keyboardFocus = target?.matches?.(":focus-visible") ?? false;
    focusRef.current = keyboardFocus;
    if (keyboardFocus) {
      openSidebar();
    }
  }, [isHoverCapable, openSidebar]);

  const handleSidebarBlur = useCallback(
    (event: ReactFocusEvent<HTMLElement>) => {
      if (!isHoverCapable) return;
      const nextTarget = event.relatedTarget as Node | null;
      if (nextTarget && event.currentTarget.contains(nextTarget)) return;
      focusRef.current = false;
      scheduleClose();
    },
    [isHoverCapable, scheduleClose],
  );

  const isSidebarExpanded = isHoverCapable ? isSidebarOpen : true;

  return (
    <div
      className={`${styles.page} ${themeStyles.theme} ${appearance === "glass" ? "glass-scope" : ""}`}
      data-dashboard-role="student"
    >
      <div className={styles.container}>
        <a className={styles.skipLink} href="#dashboard-main">
          Перейти к содержимому
        </a>
        <div
          className={`${styles.shell} ${settingsHref ? styles.shellWithSettings : ""}`}
          data-sidebar-open={isSidebarExpanded ? "true" : "false"}
        >
          <SidebarInner
            title={title}
            subtitle={subtitle}
            navItems={navItems}
            onLogout={onLogout}
            settingsHref={settingsHref}
            isSidebarOpen={isSidebarExpanded}
            onSidebarPointerEnter={handleSidebarPointerEnter}
            onSidebarPointerLeave={handleSidebarPointerLeave}
            onSidebarFocus={handleSidebarFocus}
            onSidebarBlur={handleSidebarBlur}
            onClose={closeSidebar}
          />
          <ShellMain>{children}</ShellMain>
        </div>
      </div>
    </div>
  );
}
