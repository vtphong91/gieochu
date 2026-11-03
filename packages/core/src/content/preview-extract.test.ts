import {
  sliceDocxHtmlParagraphs,
  sliceXlsxRows,
  slicePptxSlides,
  DOCX_PREVIEW_MIN,
  DOCX_PREVIEW_MAX,
  XLSX_PREVIEW_MIN,
  XLSX_PREVIEW_MAX,
  PPTX_PREVIEW_MIN,
  PPTX_PREVIEW_MAX,
  type PptxSlide,
} from "./preview-extract";

describe("ADR-063 preview-extract", () => {
  it("extracts 20% of docx paragraphs and pptx slides bounded by min/max", () => {
    const paras = Array.from({ length: 10 }, (_, i) => `<p>Đoạn ${i + 1}</p>`).join("");
    // 10 paragraphs * 20% = 2, bounded by min 3.
    const small = sliceDocxHtmlParagraphs(paras);
    expect(small.totalParagraphs).toBe(10);
    expect(small.paragraphsShown).toBe(DOCX_PREVIEW_MIN);
    expect(small.html.match(/<p>/g)?.length).toBe(DOCX_PREVIEW_MIN);

    // 500 paragraphs * 20% = 100, bounded by max 60.
    const big = Array.from({ length: 500 }, (_, i) => `<p>Đoạn ${i + 1}</p>`).join("");
    const result = sliceDocxHtmlParagraphs(big);
    expect(result.totalParagraphs).toBe(500);
    expect(result.paragraphsShown).toBe(DOCX_PREVIEW_MAX);

    // 50 paragraphs * 20% = 10, within range.
    const mid = Array.from({ length: 50 }, (_, i) => `<h2>Đoạn ${i + 1}</h2>`).join("");
    const midResult = sliceDocxHtmlParagraphs(mid);
    expect(midResult.totalParagraphs).toBe(50);
    expect(midResult.paragraphsShown).toBe(10);

    // PPTX: 10 slides * 20% = 2
    const slides: PptxSlide[] = Array.from({ length: 10 }, (_, i) => ({
      slideNumber: i + 1,
      title: `Slide ${i + 1}`,
      bullets: [`Point A${i + 1}`, `Point B${i + 1}`],
    }));
    const pptxRes = slicePptxSlides(slides);
    expect(pptxRes.totalSlides).toBe(10);
    expect(pptxRes.slidesShown).toBe(2);
    expect(pptxRes.slides.length).toBe(2);

    // PPTX: 1 slide * 20% = 1 (min 1)
    const singleSlideRes = slicePptxSlides([slides[0]]);
    expect(singleSlideRes.slidesShown).toBe(PPTX_PREVIEW_MIN);

    // PPTX: 200 slides * 20% = 40 (capped at max 20)
    const manySlides: PptxSlide[] = Array.from({ length: 200 }, (_, i) => ({
      slideNumber: i + 1,
      title: `Slide ${i + 1}`,
      bullets: [],
    }));
    const manyRes = slicePptxSlides(manySlides);
    expect(manyRes.slidesShown).toBe(PPTX_PREVIEW_MAX);
  });

  it("extracts 20% of xlsx rows with min 10 and max 200", () => {
    const smallRows = Array.from({ length: 20 }, (_, i) => [i, `R${i}`]);
    const small = sliceXlsxRows(smallRows);
    // 20 * 20% = 4, bounded by min 10.
    expect(small.totalRows).toBe(20);
    expect(small.rowsShown).toBe(XLSX_PREVIEW_MIN);
    expect(small.rows.length).toBe(XLSX_PREVIEW_MIN);

    // 5000 rows * 20% = 1000, bounded by max 200.
    const bigRows = Array.from({ length: 5000 }, (_, i) => [i]);
    const big = sliceXlsxRows(bigRows);
    expect(big.totalRows).toBe(5000);
    expect(big.rowsShown).toBe(XLSX_PREVIEW_MAX);
    expect(big.rows.length).toBe(XLSX_PREVIEW_MAX);

    // 300 rows * 20% = 60, within range.
    const midRows = Array.from({ length: 300 }, (_, i) => [i]);
    const mid = sliceXlsxRows(midRows);
    expect(mid.rowsShown).toBe(60);
  });
});
