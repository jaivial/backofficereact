import React from "react";

type AvatarProps = {
  className?: string;
  children?: React.ReactNode;
};

export function Avatar({ className, children }: AvatarProps) {
  return <div className={`w-9 h-9 rounded-xl border border-white/[0.06] bg-gradient-to-br from-primary/28 to-accent/18 flex items-center justify-center text-[13px] font-bold text-foreground/90 overflow-hidden ${className || ""}`}>{children}</div>;
}

type AvatarImageProps = {
  src?: string;
  alt?: string;
  className?: string;
};

export function AvatarImage({ src, alt, className }: AvatarImageProps) {
  if (!src) return null;
  return <img src={src} alt={alt} className={`w-full h-full object-cover ${className || ""}`} />;
}

type AvatarFallbackProps = {
  className?: string;
  children?: React.ReactNode;
};

export function AvatarFallback({ className, children }: AvatarFallbackProps) {
  return <span className={`w-full h-full flex items-center justify-center rounded-inherit ${className || ""}`}>{children}</span>;
}
