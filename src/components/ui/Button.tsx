import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "border-accent bg-accent text-accent-foreground hover:bg-accent-hover hover:border-accent-hover disabled:opacity-60",
  secondary:
    "border-border bg-surface text-foreground hover:bg-subtle disabled:opacity-60",
  ghost:
    "border-transparent bg-transparent text-foreground hover:bg-subtle disabled:opacity-60",
  danger:
    "border-danger bg-danger text-white hover:bg-red-800 disabled:opacity-60",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-[15px]",
  lg: "px-5 py-3 text-base",
};

/**
 * Shared button primitive — neutral primary, presentation only.
 */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
