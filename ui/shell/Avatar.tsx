import React from "react";

type AvatarProps = {
  className?: string;
  children?: React.ReactNode;
};

export function Avatar({ className, children }: AvatarProps) {
  return <div className={`bo-avatar ${className || ""}`}>{children}</div>;
}

type AvatarImageProps = {
  src?: string;
  alt?: string;
  className?: string;
};

export function AvatarImage({ src, alt, className }: AvatarImageProps) {
  if (!src) return null;
  return <img src={src} alt={alt} className={`bo-avatarImg ${className || ""}`} />;
}

type AvatarFallbackProps = {
  className?: string;
  children?: React.ReactNode;
};

export function AvatarFallback({ className, children }: AvatarFallbackProps) {
  return <span className={`bo-avatarFallback ${className || ""}`}>{children}</span>;
}
