import React from "react";
import { usePageContext } from "vike-react/usePageContext";

export default function MobileRootPage() {
  const pageContext = usePageContext();
  const session = pageContext.bo?.session;

  // Redirect to mobile backoffice or mobile login
  if (!session) {
    if (typeof window !== "undefined") {
      window.location.href = "/m/login";
    }
    return null;
  }

  if (typeof window !== "undefined") {
    window.location.href = "/m/app/backoffice";
  }
  return null;
}
