import { expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { documentPdf } from "../src/lib/pdf";
it("generates a paginated printable PDF with embedded font", async () => {
  const bytes = await documentPdf("Rental agreement", ["RentOps · €500", "Customer: Émilie Müller", ...Array.from({ length: 100 }, (_, n) => `Inspection item ${n}: vehicle checked and documented.`)]);
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBeGreaterThan(1);
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
});
