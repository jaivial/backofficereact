import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  primary: "bo-btn bo-btn--primary",
  secondary: "bo-btn bo-btn--ghost",
  ghost: "bo-btn bo-btn--ghost",
  danger: "bo-btn bo-btn--danger",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "bo-btn--sm",
  md: "",
  lg: "bo-btn--lg",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const cls = `${variantClass[variant]} ${sizeClass[size]} ${className}`.trim();
  return <button type={type} className={cls} {...props} />;
}
