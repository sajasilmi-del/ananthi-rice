import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cx } from "@/components/ui/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "whatsapp" | "cream";

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type={type} className={cx("btn", `btn-${variant}`, className)} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={cx("btn", `btn-${variant}`, className)} {...props} />;
}
