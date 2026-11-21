import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Nội dung ebook tự tạo, chỉ dùng cho trải nghiệm đọc PDF của bản demo.
export async function createDemoPdf(book, { preview = false } = {}) {
  const pdf = await PDFDocument.create();
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const green = rgb(0.13, 0.29, 0.24);
  const title =
    book.id === "d2" ? "Letters to Tomorrow" : "The Art of Paying Attention";
  const chapters = [
    [
      "A small beginning",
      "A book is a quiet invitation. It asks us to leave the noise of the day at the door and spend a little time with a different way of seeing. There is no perfect place to begin. There is only the next page.",
      "Set aside ten minutes today. Choose a comfortable chair, place your phone somewhere out of reach, and open a book. Do not measure how many pages you finish. Notice instead the sentence that stays with you.",
      "A reading life grows through these small returns. Some days a paragraph is enough. Some days you will lose an afternoon. Both are beautiful ways to begin.",
    ],
    [
      "The space between pages",
      "We often remember a book through the place where we read it: a window on a rainy afternoon, a train moving toward a new city, the kitchen table before everyone wakes. Reading is part of the world, not an escape from it.",
      "Pause when a thought surprises you. Write it in a notebook in your own words. Ask what it reminds you of, and what it might change. The space between pages is where a story becomes part of your own.",
      "You do not need to agree with every voice you encounter. Curiosity is enough. Let a new idea sit beside an old one for a while. Understanding can take its time.",
    ],
    [
      "A story continues",
      "When you finish a book, its journey need not end. Pass it to a friend. Leave a little note about the moment you loved. Trade it for a story you would never have chosen on your own.",
      "A shared book carries more than words. It carries the memory of attention: someone made time for these pages, and now they are inviting you to do the same. This is how a shelf becomes a community.",
      "Tomorrow, begin again. There will always be another page, another question, another person waiting to meet you through a story. A little book can open a whole new world.",
    ],
  ];
  pdf.setTitle(title);
  pdf.setAuthor("BookMarket Studio");
  const cover = pdf.addPage([595, 842]);
  cover.drawRectangle({
    x: 0,
    y: 0,
    width: 595,
    height: 842,
    color: green,
  });
  cover.drawText("BOOKMARKET STUDIO", {
    x: 60,
    y: 745,
    size: 12,
    font: sans,
    color: rgb(0.8, 0.85, 0.68),
  });
  title
    .split(" ")
    .reduce(
      (lines, word) => {
        if ((lines.at(-1) + " " + word).length > 22) {
          lines.push(word);
        } else {
          lines[lines.length - 1] += (lines.at(-1) ? " " : "") + word;
        }
        return lines;
      },
      [""],
    )
    .forEach((line, i) =>
      cover.drawText(line, {
        x: 60,
        y: 540 - i * 60,
        size: 43,
        font: serif,
        color: rgb(0.96, 0.94, 0.85),
      }),
    );
  cover.drawText("A little book. A whole new world.", {
    x: 60,
    y: 270,
    size: 19,
    font: italic,
    color: rgb(0.8, 0.85, 0.68),
  });
  cover.drawText("Original demo edition - 2026", {
    x: 60,
    y: 65,
    size: 10,
    font: sans,
    color: rgb(0.8, 0.85, 0.68),
  });
  // Bản đọc thử gồm trang bìa và một trang nội dung.
  (preview ? chapters.slice(0, 1) : chapters).forEach(
    ([heading, ...paragraphs], index) => {
      const page = pdf.addPage([595, 842]);
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 595,
        height: 842,
        color: rgb(0.98, 0.97, 0.94),
      });
      page.drawText("BOOKMARKET / A READING LIFE", {
        x: 60,
        y: 780,
        size: 9,
        font: sans,
        color: green,
      });
      page.drawText("0" + (index + 1), {
        x: 60,
        y: 690,
        size: 15,
        font: italic,
        color: green,
      });
      page.drawText(heading, {
        x: 60,
        y: 640,
        size: 30,
        font: serif,
        color: green,
      });
      let y = 575;
      paragraphs.forEach((paragraph) => {
        const words = paragraph.split(" ");
        let line = "";
        words.forEach((word) => {
          const proposed = line ? line + " " + word : word;
          if (serif.widthOfTextAtSize(proposed, 13) > 470) {
            page.drawText(line, {
              x: 60,
              y,
              size: 13,
              font: serif,
              color: rgb(0.2, 0.24, 0.21),
            });
            y -= 22;
            line = word;
          } else {
            line = proposed;
          }
        });
        if (line) {
          page.drawText(line, {
            x: 60,
            y,
            size: 13,
            font: serif,
            color: rgb(0.2, 0.24, 0.21),
          });
          y -= 42;
        }
      });
      page.drawText(String(index + 1), {
        x: 290,
        y: 45,
        size: 10,
        font: sans,
        color: green,
      });
    },
  );
  return pdf.save();
}
