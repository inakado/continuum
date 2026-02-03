"use client";

import DashboardShell from "@/components/DashboardShell";
import styles from "./student-dashboard.module.css";

export default function StudentDashboardScreen() {
  const navItems = [
    {
      label: "Курсы",
      href: "/student",
      active: true,
    },
  ];

  return (
    <DashboardShell title="Ученик" subtitle="Панель" navItems={navItems}>
      <div className={styles.content}>
        <h1 className={styles.title}>Панель ученика</h1>
        <p className={styles.subtitle}>Откройте Курсы слева</p>
      </div>
    </DashboardShell>
  );
}
