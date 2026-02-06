"use client";

import type React from "react";
import { useId } from "react";
import styles from "./tabs.module.css";

export type TabItem<T extends string> = {
  key: T;
  label: string;
};

type TabsProps<T extends string> = {
  tabs: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  ariaLabel: string;
  idBase?: string;
  className?: string;
};

export default function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  idBase,
  className = "",
}: TabsProps<T>) {
  const generatedId = useId();
  const baseId = idBase ?? generatedId;

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.key === active),
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (tabs.length === 0) return;

    const key = event.key;
    const isPrev = key === "ArrowLeft";
    const isNext = key === "ArrowRight";
    if (!isPrev && !isNext) return;

    event.preventDefault();

    const nextIndex = isPrev
      ? (activeIndex - 1 + tabs.length) % tabs.length
      : (activeIndex + 1) % tabs.length;

    onChange(tabs[nextIndex].key);
  };

  return (
    <div
      className={`${styles.tabs} ${className}`}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        const id = `${baseId}-${tab.key}`;
        const panelId = `${id}-panel`;
        return (
          <button
            key={tab.key}
            id={id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            className={`${styles.tab} ${selected ? styles.tabActive : ""}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
