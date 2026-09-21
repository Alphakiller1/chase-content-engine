/** Hosted vs local booth. esbuild defines BOOTH_STATIC / BOOTH_BASE for GitHub Pages. */

declare const process: { env: Record<string, string | undefined> };

export const STATIC = process.env.BOOTH_STATIC === "1";
export const BASE = String(process.env.BOOTH_BASE || "").replace(/\/$/, "");

export const url = (path: string) => {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BASE}${p}`;
};

export const downloadBlob = (filename: string, data: Blob | string, mime = "application/octet-stream") => {
  const blob = typeof data === "string" ? new Blob([data], { type: mime }) : data;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2_000);
};

if (typeof window !== "undefined" && BASE) {
  (window as unknown as { remotion_staticBase?: string }).remotion_staticBase = BASE;
}
