"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { getButtonClassName, type ButtonSize, type ButtonVariant } from "./Button";

type ButtonLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "className"> & {
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export default function ButtonLink({
  className = "",
  variant = "primary",
  size = "md",
  ...props
}: ButtonLinkProps) {
  return <Link className={getButtonClassName({ variant, size, className })} {...props} />;
}
