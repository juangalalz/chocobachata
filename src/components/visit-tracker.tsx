"use client";

import { useEffect } from "react";

import {
  isInternal,
  markRead,
  sendVisit,
  trackMeta,
  trackMetaOnce,
  visitNumber,
} from "@/lib/visit-client";

const depths = [25, 50, 75, 100];
const activeSeconds = [15, 30, 60, 120];
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

    // En oct 2026, 1 de cada 4 visitas sin leer "duraba" justo 30 s: la app de Instagram o
    // Facebook la tenía abierta pero oculta. Solo cuenta el tiempo con la página a la vista.
    let visibleMs = 0;
    let visibleSince: number | null = document.visibilityState === "visible" ? started : null;
    const visibleSeconds = () =>
      Math.round((visibleMs + (visibleSince ? Date.now() - visibleSince : 0)) / 1000);

    sendVisit("page_view", { eventId, loadedHidden: visibleSince === null });
    if (!isInternal()) {
      window.fbq?.("track", "PageView", {}, { eventID: eventId });
    }
    const number = visitNumber();
    if (number >= 2) {
      trackMeta("VisitaRecurrente", { numero: number });
    }

    function onScroll() {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const percent = height <= 0 ? 100 : Math.round((window.scrollY / height) * 100);

      for (const depth of depths) {
        if (percent >= depth && !seen.has(depth)) {
          seen.add(depth);
          sendVisit("scroll", { depth });
          trackMeta("Lectura", { porcentaje: depth });
          if (depth >= 50) {
            trackMetaOnce("contenido", "ViewContent", { content_name: "Curso completo" }, true);
          }
          if (depth >= 75) {
            markRead();
          }
        }
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        visibleSince ??= Date.now();
      } else if (visibleSince) {
        visibleMs += Date.now() - visibleSince;
        visibleSince = null;
      }
    }

    const reached = new Set<number>();
    const timer = window.setInterval(() => {
      const current = visibleSeconds();
      for (const mark of activeSeconds) {
        if (current >= mark && !reached.has(mark)) {
          reached.add(mark);
          trackMeta("TiempoActivo", { segundos: mark });
        }
      }
      if (reached.size === activeSeconds.length) {
        window.clearInterval(timer);
      }
    }, 1000);

    // Qué secciones llega a ver: precio, testimonios, preguntas…
    const sections = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const name = (entry.target as HTMLElement).dataset.seccion;
          if (entry.isIntersecting && name) {
            sections.unobserve(entry.target);
            sendVisit("section_view", { cta: name });
            trackMetaOnce(`seccion:${name}`, "VioSeccion", { seccion: name });
          }
        }
      },
      { threshold: 0.3 },
    );
    document.querySelectorAll("[data-seccion]").forEach((section) => sections.observe(section));

    function onLeave() {
      sendVisit("leave", {
        seconds: Math.round((Date.now() - started) / 1000),
        visibleSeconds: visibleSeconds(),
        depth: Math.max(0, ...seen),
      });
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onLeave);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
      window.clearInterval(timer);
      sections.disconnect();
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
