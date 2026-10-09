"use client";

import { useRouter } from "next/navigation.js";
import { useEffect } from "react";

export function RaidRefresh() {
  const router = useRouter();
  useEffect(() => {
    let lastRefresh = Date.now();
    const refresh = () => {
      if (
        document.visibilityState === "visible" &&
        navigator.onLine &&
        Date.now() - lastRefresh >= 15_000
      ) {
        lastRefresh = Date.now();
        router.refresh();
      }
    };
    const timer = setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}
