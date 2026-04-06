import React from "react";
import { cn } from "../shadcn/utils";

type AvatarProps = {
  className?: string;
  children?: React.ReactNode;
};

export function Avatar({ className, children }: AvatarProps) {
  return <div className={cn("bo-avatar", className)}>{children}</div>;
}

type AvatarImageProps = {
  src?: string;
  alt?: string;
  className?: string;
};

export function AvatarImage({ src, alt, className }: AvatarImageProps) {
  if (!src) return null;
  return <img src={src} alt={alt} className={cn("bo-avatarImg", className)} />;
}

type AvatarFallbackProps = {
  className?: string;
  children?: React.ReactNode;
};

export function AvatarFallback({ className, children }: AvatarFallbackProps) {
  return <span className={cn("bo-avatarFallback", className)}>{children}</span>;
}
