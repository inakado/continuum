"use client";

import { useState } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import Link from "next/link";
import { useAuthLogout } from "@/features/auth/useAuthLogout";
import { useAuthSession } from "@/features/auth/useAuthSession";
import styles from "./continuum-header.module.css";

export default function ContinuumHeader({ homeHref }: { homeHref: string }) {
  const session = useAuthSession();
  const logout = useAuthLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = session.data?.user.name || session.data?.user.login || "Профиль";

  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <Link className={styles.brand} href={homeHref}>
          Континуум
        </Link>
        <span className={styles.divider} aria-hidden="true" />
        <span className={styles.subject}>Физика</span>
      </div>
      <div className={styles.profile}>
        <button
          aria-label={`Профиль: ${displayName}`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className={styles.profileButton}
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          <UserRound aria-hidden="true" size={24} strokeWidth={1.6} />
          <span>{displayName}</span>
          <ChevronDown aria-hidden="true" size={20} strokeWidth={1.6} />
        </button>
        {menuOpen ? (
          <div className={styles.menu} role="menu">
            <button onClick={() => void logout()} role="menuitem" type="button">
              Выйти
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
