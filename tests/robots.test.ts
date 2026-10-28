import { describe, expect, it } from "vitest";

import { isMetaNetwork, isRobot } from "@/lib/robots";

describe("robots", () => {
  it("reconoce la red de Meta, la de los revisores de anuncios", () => {
    expect(isMetaNetwork("66.220.149.7")).toBe(true);
    expect(isMetaNetwork("31.13.127.89")).toBe(true);
    expect(isMetaNetwork("173.252.70.36")).toBe(true);
    expect(isMetaNetwork("2a03:2880:f0ff:c::face:b00c")).toBe(true);
  });

  it("no confunde a la gente de España con Meta", () => {
    expect(isMetaNetwork("83.45.124.98")).toBe(false);
    expect(isMetaNetwork("5.6.7.8")).toBe(false);
    expect(isMetaNetwork("2a0c:5a80::1")).toBe(false);
    expect(isMetaNetwork(undefined)).toBe(false);
  });

  it("también por el navegador, como antes", () => {
    expect(isRobot("meta-externalads/1.1", "83.45.124.98")).toBe(true);
    expect(isRobot("Mozilla/5.0 (iPhone) Instagram 350", "83.45.124.98")).toBe(false);
  });
});
