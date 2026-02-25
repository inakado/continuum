"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import styles from "./select.module.css";

const EMPTY_OPTION_VALUE = "__continuum_empty_select_option__";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  section?: string;
  disabled?: boolean;
};

type SelectProps<T extends string = string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
};

export default function Select<T extends string = string>({
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  className = "",
  triggerClassName = "",
  contentClassName = "",
}: SelectProps<T>) {
  const toRadixValue = (next: string) => (next === "" ? EMPTY_OPTION_VALUE : next);
  const fromRadixValue = (next: string) => (next === EMPTY_OPTION_VALUE ? "" : next);
  const hasSections = options.some((option) => Boolean(option.section));

  const sectionOrder: string[] = [];
  const optionsBySection = new Map<string, SelectOption<T>[]>();
  for (const option of options) {
    const key = option.section?.trim() || "__default_section__";
    if (!optionsBySection.has(key)) {
      sectionOrder.push(key);
      optionsBySection.set(key, []);
    }
    optionsBySection.get(key)?.push(option);
  }

  return (
    <SelectPrimitive.Root
      value={toRadixValue(value)}
      onValueChange={(next: string) => onValueChange(fromRadixValue(next) as T)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger className={`${styles.trigger} ${triggerClassName}`} aria-label={placeholder}>
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className={styles.icon}>
          <ChevronDown size={16} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className={`${styles.content} ${contentClassName}`} position="popper">
          <SelectPrimitive.Viewport className={`${styles.viewport} ${className}`}>
            {sectionOrder.map((sectionKey, sectionIndex) => {
              const sectionOptions = optionsBySection.get(sectionKey) ?? [];
              const isDefaultSection = sectionKey === "__default_section__";

              return (
                <SelectPrimitive.Group key={sectionKey} className={styles.section}>
                  {hasSections && sectionIndex > 0 ? <SelectPrimitive.Separator className={styles.separator} /> : null}
                  {hasSections && !isDefaultSection ? (
                    <SelectPrimitive.Label className={styles.sectionLabel}>
                      {sectionKey}
                    </SelectPrimitive.Label>
                  ) : null}
                  {sectionOptions.map((option) => (
                    <SelectPrimitive.Item
                      key={`${sectionKey}-${option.value}`}
                      value={toRadixValue(option.value)}
                      disabled={option.disabled}
                      className={styles.item}
                    >
                      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                      <SelectPrimitive.ItemIndicator className={styles.itemIndicator}>
                        <Check size={14} />
                      </SelectPrimitive.ItemIndicator>
                    </SelectPrimitive.Item>
                  ))}
                </SelectPrimitive.Group>
              );
            })}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
