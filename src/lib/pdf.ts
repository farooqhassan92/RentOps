import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
// Bundled local fonts keep document generation independent of external network calls.
export async function documentPdf(title: string, lines: string[]) {
  const document = await PDFDocument.create(); document.registerFontkit(fontkit);
  const font = await document.embedFont(await readFile(path.join(process.cwd(), "assets", "NotoSans-Regular.woff")), { subset: true });
  const pageSize: [number, number] = [595.28, 841.89];
  let page = document.addPage(pageSize), y = 775;
  const primary = rgb(.145, .388, .922), dark = rgb(.19, .23, .26), muted = rgb(.47, .52, .56);
  function newPage() { page = document.addPage(pageSize); y = 780; }
  function line(text: string, size = 10, color = dark) {
    if (y < 65) newPage();
    // Replace unsupported glyphs explicitly; the bundled font covers Latin scripts.
    page.drawText(text, { x: 46, y, size, font, color }); y -= size + 8;
  }
  line("RentOps.", 24, primary); y -= 17; line(title, 19); y -= 13;
  for (const raw of lines) {
    if (!raw) { y -= 10; continue; }
    for (const paragraph of raw.split(/\r?\n/)) {
      let current = "";
      for (const word of paragraph.split(/\s+/)) {
        // Break long identifiers as well as normal text to prevent clipping.
        for (const segment of word.match(/.{1,65}/gu) || [""]) {
          const next = current ? current + " " + segment : segment;
          if (font.widthOfTextAtSize(next, 10) > 500 && current) { line(current); current = segment; } else current = next;
        }
      }
      line(current);
    }
  }
  document.getPages().forEach((p, i) => p.drawText(`RentOps | ${i + 1} / ${document.getPageCount()}`, { x: 46, y: 30, size: 8, font, color: muted }));
  return document.save();
}
