"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import type { ComponentPropsWithoutRef } from "react";
import styles from "./switch.module.css";

type SwitchProps = ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & {
  label?: string;
  className?: string;
};

export default function Switch({ label, className = "", ...props }: SwitchProps) {
  return (
    <label className={`${styles.wrapper} ${className}`}>
      <SwitchPrimitive.Root className={styles.root} {...props}>
        <SwitchPrimitive.Thumb className={styles.thumb} />
      </SwitchPrimitive.Root>
      {label ? <span className={styles.label}>{label}</span> : null}
    </label>
  );
}
