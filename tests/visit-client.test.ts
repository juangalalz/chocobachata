// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isInternal, markRead, sendVisit, visitContext } from "@/lib/visit-client";

function open(url: string, userAgent: string, referrer = "") {
  window.history.replaceState({}, "", url);
  Object.defineProperty(window.navigator, "userAgent", { value: userAgent, configurable: true });
  Object.defineProperty(document, "referrer", { value: referrer, configurable: true });
}

const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("origen y dispositivo de la visita", () => {
  it("detecta el navegador de Instagram", () => {
    open("/?utm_source=meta&utm_content=video1", `${iphone} Instagram 350.0`);
    expect(visitContext()).toMatchObject({ source: "instagram", device: "movil", utmContent: "video1" });
  });

  it("detecta el navegador de Facebook y Messenger", () => {
    open("/", `${iphone} [FBAN/FBIOS;FBAV/450.0]`);
    expect(visitContext().source).toBe("facebook");
  });

  it("usa utm_source fuera de las apps de Meta", () => {
    open("/?utm_source=meta", "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/130");
    expect(visitContext()).toMatchObject({ source: "meta", device: "ordenador" });
  });

  it("usa la web de origen y si no hay, directo", () => {
    open("/", "Mozilla/5.0 (Linux; Android 14) Mobile", "https://www.google.com/search");
    expect(visitContext()).toMatchObject({ source: "google.com", device: "movil" });

    open("/", "Mozilla/5.0 (iPad; CPU OS 18_0)");
    expect(visitContext()).toMatchObject({ source: "directo", device: "tablet" });
  });

  it("mantiene la misma sesión en toda la visita", () => {
    open("/", iphone);
    expect(visitContext().sessionId).toBe(visitContext().sessionId);
  });
});

describe("cookies de Meta", () => {
  beforeEach(() => {
    for (const name of ["_fbp", "_fbc"]) {
      document.cookie = `${name}=; max-age=0; path=/`;
    }
  });

  it("crea _fbp en la primera entrada y lo mantiene", () => {
    open("/", iphone);
    const { fbp } = visitContext();
    expect(fbp).toMatch(/^fb\.1\.\d+\.\d+$/);
    expect(visitContext().fbp).toBe(fbp);
  });

  it("respeta el _fbp que ya puso el píxel", () => {
    document.cookie = "_fbp=fb.1.1.123; path=/";
    open("/", iphone);
    expect(visitContext().fbp).toBe("fb.1.1.123");
  });

  it("un clic nuevo en un anuncio reemplaza el _fbc del clic anterior", () => {
    document.cookie = "_fbc=fb.1.1.viejo; path=/";
    open("/?fbclid=nuevo", iphone);
    expect(visitContext().fbc).toMatch(/^fb\.1\.\d+\.nuevo$/);
  });

  it("sin clic nuevo conserva el _fbc", () => {
    document.cookie = "_fbc=fb.1.1.viejo; path=/";
    open("/", iphone);
    expect(visitContext().fbc).toBe("fb.1.1.viejo");

    open("/?fbclid=viejo", iphone);
    expect(visitContext().fbc).toBe("fb.1.1.viejo");
  });
});

describe("envío de eventos", () => {
  it("usa sendBeacon y solo recurre a fetch si el navegador lo rechaza", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response()));
    const beacon = vi.fn(() => true);
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window.navigator, "sendBeacon", { value: beacon, configurable: true });

    open("/", iphone);
    sendVisit("page_view");
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    beacon.mockReturnValue(false);
    sendVisit("scroll", { depth: 25 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(window.navigator, "sendBeacon", { value: undefined, configurable: true });
  });

  it("marca la lectura en el píxel una sola vez por visita", () => {
    const fbq = vi.fn();
    window.fbq = fbq;

    open("/", iphone);
    markRead();
    markRead();
    expect(fbq).toHaveBeenCalledTimes(1);
    expect(fbq).toHaveBeenCalledWith("trackCustom", "LeyoPagina");

    delete window.fbq;
  });
});

describe("visitas internas", () => {
  it("?interno=1 marca el dispositivo y deja de enviar eventos", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response()));
    vi.stubGlobal("fetch", fetchMock);

    open("/?interno=1", iphone);
    expect(isInternal()).toBe(true);

    open("/", iphone);
    sendVisit("page_view");
    expect(fetchMock).not.toHaveBeenCalled();

    open("/?interno=0", iphone);
    expect(isInternal()).toBe(false);
    sendVisit("page_view");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
