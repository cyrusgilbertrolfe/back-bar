/**
 * The brand faces as raw font bytes, for embedding in generated PDFs.
 *
 * The only copies in the repo are the WOFF2 web fonts in public/fonts. A PDF
 * cannot carry WOFF2, and embedding the compressed bytes directly produces a
 * file that renders as dots, so they are decompressed to TrueType/OpenType
 * here, once per process. Keeping one source means the PDFs and the site can
 * never drift onto different cuts of Söhne.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { decompress } from "wawoff2";

export const BRAND_FONTS = {
  wordmark: "adamcg-pro",
  leicht: "soehne-leicht",
  buch: "soehne-buch",
  kraftig: "soehne-kraftig",
} as const;

export type BrandFontKey = keyof typeof BRAND_FONTS;
export type BrandFontBytes = Record<BrandFontKey, Uint8Array>;

let cached: Promise<BrandFontBytes> | null = null;

export function loadBrandFonts(): Promise<BrandFontBytes> {
  cached ??= (async () => {
    // One at a time, and copied out: wawoff2 returns a view into its own
    // WebAssembly heap, which the next call overwrites. Run in parallel, or
    // kept as views, three of the four fonts come back as garbage.
    const out = {} as BrandFontBytes;
    for (const key of Object.keys(BRAND_FONTS) as BrandFontKey[]) {
      const file = path.join(process.cwd(), "public", "fonts", `${BRAND_FONTS[key]}.woff2`);
      out[key] = Uint8Array.from(await decompress(await readFile(file)));
    }
    return out;
  })();
  return cached;
}
