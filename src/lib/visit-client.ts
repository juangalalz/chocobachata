"use client";

const storageKey = "choco_session";

export type VisitContext = {
  sessionId: string;
  fbclid: string;
  fbc: string;
  fbp: string;
  utmContent: string;
};

function cookie(name: string): string {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : "";
}

export function visitContext(): VisitContext {
  let sessionId = sessionStorage.getItem(storageKey) ?? "";

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(storageKey, sessionId);
  }

  const params = new URLSearchParams(window.location.search);
  const fbclid = params.get("fbclid") ?? "";
  const fbp = cookie("_fbp");
  const existingFbc = cookie("_fbc");
  const fbc =
    existingFbc || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : "");

  return {
    sessionId,
    fbclid,
    fbc,
    fbp,
    utmContent: params.get("utm_content") ?? "",
  };
}

export function sendVisit(
  name: "page_view" | "scroll" | "cta_click" | "leave",
  extra: { depth?: number; seconds?: number; eventId?: string } = {},
): void {
  const context = visitContext();
  const payload = {
    ...context,
    name,
    depth: extra.depth,
    seconds: extra.seconds,
    eventId: extra.eventId,
    path: window.location.pathname,
    sourceUrl: window.location.href,
  };

  const body = JSON.stringify(payload);

  if (name === "leave" && navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/events",
      new Blob([body], { type: "application/json" }),
    );
    return;
  }

  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}
