"use client";

import { useEffect } from "react";

import { sendVisit } from "@/lib/visit-client";

const depths = [25, 50, 75, 100];
let tracking = false;

export function VisitTracker() {
  useEffect(() => {
    if (tracking) {
      return;
    }

    tracking = true;
    const started = Date.now();
    const eventId = crypto.randomUUID();
    const seen = new Set<number>();

    sendVisit("page_view", { eventId });
    window.fbq?.("track", "PageView", {}, { eventID: eventId });

    function onScroll() {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const percent = height <= 0 ? 100 : Math.round((window.scrollY / height) * 100);

      for (const depth of depths) {
        if (percent >= depth && !seen.has(depth)) {
          seen.add(depth);
          sendVisit("scroll", { depth });
        }
      }
    }

    function onLeave() {
      sendVisit("leave", {
        seconds: Math.round((Date.now() - started) / 1000),
        depth: Math.max(0, ...seen),
      });
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onLeave);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onLeave);
    };
  }, []);

  return null;
}

declare global {
  interface Window {
    fbq?: (
      command: string,
      event: string,
      params?: Record<string, unknown>,
      options?: { eventID?: string },
    ) => void;
  }
}
