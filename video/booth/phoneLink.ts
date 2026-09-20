/** Public HTTPS mic page — iOS will not grant getUserMedia on the LAN self-signed cert. */
export const PUBLIC_BOOTH = "https://alphakiller1.github.io/chase-content-engine";

const ALPH = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export const boothRoom = () => {
  try {
    const kept = sessionStorage.getItem("booth.room");
    if (kept && /^[A-Z0-9]{5}$/.test(kept)) return kept;
  } catch {
    /* private mode */
  }
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const id = Array.from(bytes, (n) => ALPH[n % ALPH.length]).join("");
  try {
    sessionStorage.setItem("booth.room", id);
  } catch {
    /* ignore */
  }
  return id;
};

export const peerIdFor = (room: string) => `chasebooth-${room.toLowerCase()}`;

export const micUrl = (room: string) => `${PUBLIC_BOOTH}/mic?room=${encodeURIComponent(room)}`;

export const qrUrl = (href: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(href)}`;
