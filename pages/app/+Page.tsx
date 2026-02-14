import React, { useEffect } from "react";

export default function Page() {
  // Keep it simple: redirect client-side for any accidental navigation to `/app`.
  useEffect(() => {
    window.location.replace("/app/dashboard");
  }, []);
  return null;
}

