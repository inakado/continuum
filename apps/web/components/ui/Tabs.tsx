"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
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

  return (
    <TabsPrimitive.Root value={active} onValueChange={(value: string) => onChange(value as T)}>
      <TabsPrimitive.List className={`${styles.tabs} ${className}`} aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const id = `${baseId}-${tab.key}`;
          const panelId = `${id}-panel`;
          return (
            <TabsPrimitive.Trigger
              key={tab.key}
              id={id}
              value={tab.key}
              aria-controls={panelId}
              className={styles.tab}
            >
              {tab.label}
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}
