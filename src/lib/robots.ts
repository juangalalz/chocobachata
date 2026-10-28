// Revisores de anuncios de Meta y otros robots: abren la página (y hasta tocan Comprar)
// pero no son personas.
const robotAgents = /meta-externalads|facebookexternalhit|facebot|bot\b|crawler|spider|HeadlessChrome/i;

// Desde oct 2026 el revisor de Meta se hace pasar por un móvil o un ordenador normal: solo se
// le reconoce por la red de Meta (AS32934). Al crear 6 anuncios llegaron 28 visitas en 85 s,
// todas con la página oculta y 10 toques en Comprar.
const metaNetworks = [
  "31.13.24.0/21",
  "31.13.64.0/18",
  "45.64.40.0/22",
  "66.220.144.0/20",
  "69.63.176.0/20",
  "69.171.224.0/19",
  "74.119.76.0/22",
  "102.132.96.0/20",
  "103.4.96.0/22",
  "129.134.0.0/17",
  "157.240.0.0/16",
  "163.70.128.0/17",
  "173.252.64.0/18",
  "179.60.192.0/22",
  "185.60.216.0/22",
  "185.89.216.0/22",
  "204.15.20.0/22",
].map((range) => {
  const [base, bits] = range.split("/");
  return { base: ipv4(base), size: 2 ** (32 - Number(bits)) };
});

function ipv4(ip: string): number {
  return ip.split(".").reduce((total, part) => total * 256 + Number(part), 0);
}

export function isMetaNetwork(ip: string | undefined): boolean {
  if (!ip) {
    return false;
  }
  if (ip.toLowerCase().startsWith("2a03:2880:")) {
    return true;
  }
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    return false;
  }
  const value = ipv4(ip);
  return metaNetworks.some(
    ({ base, size }) => Math.floor(value / size) === Math.floor(base / size),
  );
}

export function isRobot(userAgent: string | undefined, ip: string | undefined): boolean {
  return (userAgent != null && robotAgents.test(userAgent)) || isMetaNetwork(ip);
}
