import Link from "next/link";
import type { ReactNode } from "react";
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
};

export default function DashboardShell({ title, subtitle, navItems, children }: DashboardShellProps) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.shell}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <div>
                <div className={styles.kicker}>Континуум</div>
                <div className={styles.sidebarTitle}>{title}</div>
              </div>
              <ThemeToggle compact />
            </div>
            {subtitle ? <div className={styles.sidebarSubtitle}>{subtitle}</div> : null}
            <nav className={styles.nav}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navLink} ${item.active ? styles.navLinkActive : ""}`}
                  aria-current={item.active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className={styles.main}>{children}</main>
        </div>
      </div>
    </div>
  );
}
