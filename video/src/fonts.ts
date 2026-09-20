/**
 * Brand faces, once, for every composition.
 *
 * The faces are the site's own (Archivo, as 'Chase Sans' and the 72%-width
 * 'Chase Display'), declared by the exported chase-fonts.css that theme.css imports.
 * A @font-face only downloads when something asks for it, and Remotion would happily
 * screenshot a frame before that - the still engine shipped a post with NO brand face
 * that way. So every render waits here until both faces are loaded, and FAILS rather
 * than render in a system fallback.
 *
 * Replaced 2026-09-17: this used @remotion/google-fonts for Roboto Condensed + DM Sans,
 * the site's previous faces.
 */
import { cancelRender, continueRender, delayRender } from "remotion";
import "./theme.css";

export const display = { fontFamily: "var(--font-display)" };
export const body = { fontFamily: "var(--font-body)" };

const FACES = [
  '800 64px "Chase Display"',
  '700 64px "Chase Display"',
  '400 32px "Chase Sans"',
  '600 32px "Chase Sans"',
  '700 32px "Chase Sans"',
];

if (typeof document !== "undefined") {
  const handle = delayRender("Loading the site's brand faces", {
    timeoutInMilliseconds: 30000,
  });
  Promise.all(FACES.map((f) => document.fonts.load(f)))
    .then((loaded) => {
      const missing = FACES.filter((_, i) => loaded[i].length === 0);
      if (missing.length) {
        cancelRender(
          new Error(
            `Brand face(s) did not load: ${missing.join(", ")}. ` +
              "Run `python -m outputs.content_engine sync-style` from the repo root.",
          ),
        );
        return;
      }
      continueRender(handle);
    })
    .catch((err) => cancelRender(err));
}
