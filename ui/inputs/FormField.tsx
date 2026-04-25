import React, { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../shadcn/utils";

type FormFieldProps = HTMLAttributes<HTMLDivElement> & {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  fieldClassName?: string;
  labelClassName?: string;
};

export function FormField({
  label,
  htmlFor,
  error,
  required,
  className,
  fieldClassName,
  labelClassName,
  children,
  ...rest
}: FormFieldProps) {
  return (
    <div className={cn("bo-field", className)} {...rest}>
      <label className={cn("bo-label", labelClassName)} htmlFor={htmlFor}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {error && <div className="bo-fieldError">{error}</div>}
    </div>
  );
}
