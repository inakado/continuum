"use client";

import { memo, useRef, useState } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import Link from "next/link";
import { useAuthLogout } from "@/features/auth/useAuthLogout";
import { useAuthSession } from "@/features/auth/useAuthSession";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/DropdownMenu";
import styles from "./continuum-header.module.css";

export default memo(function ContinuumHeader({ homeHref, beforeLogout }: { homeHref: string; beforeLogout?: () => Promise<boolean> }) {
  const session = useAuthSession();
  const logout = useAuthLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const logoutPending = useRef(false);
  const displayName = session.data?.user.name || session.data?.user.login || "Профиль";
  async function requestLogout() {
    if (logoutPending.current) return;
    logoutPending.current = true;
    try { if (!beforeLogout || await beforeLogout()) await logout(); }
    finally { logoutPending.current = false; }
  }

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
        <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`Профиль: ${displayName}`}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className={styles.profileButton}
              type="button"
            >
              <UserRound aria-hidden="true" size={24} strokeWidth={1.6} />
              <span>{displayName}</span>
              <ChevronDown aria-hidden="true" size={20} strokeWidth={1.6} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={styles.menu}>
            {session.data?.user.role === 'teacher' && <DropdownMenuItem asChild className={styles.menuItem}><Link href="/teacher/reviewer-access">Подключение агента</Link></DropdownMenuItem>}
            <DropdownMenuItem className={styles.menuItem} onSelect={() => { void requestLogout(); }}>Выйти</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
});
