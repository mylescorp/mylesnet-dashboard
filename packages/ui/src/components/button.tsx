import type { ButtonHTMLAttributes } from "react";
import { cn } from "../utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

/** Shared semantic button that uses the workspace's existing action tokens. */
export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  const variantClass = {
    primary: "primary-button",
    secondary: "secondary-button",
    danger: "danger-button",
  }[variant];
  return <button type={type} className={cn(variantClass, className)} {...props} />;
}
