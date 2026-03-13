import fs from "fs";
import mammoth from "mammoth";
import pdf from "pdf-parse";
import cheerio from "cheerio";

const dataDir = "./docs";
const output = "./data/knowledge.json";

let paragraphs = [];

/* ---------- IMAGE MARKER SUPPORT ---------- */

function extractImage(text) {
  const match = text.match(/\[image:(.*?)\]/i);
  if (!match) return null;
  return "images/" + match[1].trim();
}

function removeImageMarker(text) {
  return text.replace(/\[image:.*?\]/i, "").trim();
}

/* ---------- DOCX EXTRACTION ---------- */

async function extractDOCX(file) {

  const result = await mammoth.convertToHtml({ path: file });

  const $ = cheerio.load(result.value);

  let parsed = [];
  let index = 1;

  $("p, table").each((i, el) => {

    if (el.tagName === "p") {

      const text = $(el).text().trim();
      if (!text) return;

      const image = extractImage(text);
      const cleanText = removeImageMarker(text);

      parsed.push({
        paragraph: index++,
        type: "text",
        content: cleanText,
        image: image
      });

    }

    if (el.tagName === "table") {

      parsed.push({
        paragraph: index++,
        type: "table",
        content: $.html(el)
      });

    }

  });

  return parsed;

}

/* ---------- PDF EXTRACTION ---------- */

async function extractPDF(file) {

  const dataBuffer = fs.readFileSync(file);
  const data = await pdf(dataBuffer);

  return data.text
    .split(/\n{2,}/)
    .map((p, i) => ({
      paragraph: i + 1,
      type: "text",
      content: p.trim()
    }))
    .filter(p => p.content.length > 0);

}

/* ---------- MAIN BUILD ---------- */

async function run() {

  const files = fs.readdirSync(dataDir);

  for (const file of files) {

    const path = `${dataDir}/${file}`;
    let items = [];

    if (file.endsWith(".docx")) {
      items = await extractDOCX(path);
    }

    if (file.endsWith(".pdf")) {
      items = await extractPDF(path);
    }

    items.forEach(item => {

      const entry = {
        filename: file,
        paragraph: item.paragraph,
        type: item.type,
        content: item.content
      };

      if (item.image) entry.image = item.image;

      paragraphs.push(entry);

    });

  }

  fs.writeFileSync(output, JSON.stringify(paragraphs, null, 2));

  console.log("Knowledge base built:", paragraphs.length);

}

run();
