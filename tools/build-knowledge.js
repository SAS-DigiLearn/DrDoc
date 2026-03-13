import fs from "fs";
import mammoth from "mammoth";
import pdf from "pdf-parse";

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

  const html = result.value;

  let items = [];

  // Extract tables
  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  let tables = html.match(tableRegex) || [];

  // Remove tables from HTML so we can process paragraphs separately
  let htmlWithoutTables = html.replace(tableRegex, "");

  // Extract paragraphs
  const paraRegex = /<p>(.*?)<\/p>/gi;
  let match;

  while ((match = paraRegex.exec(htmlWithoutTables)) !== null) {

    const text = match[1]
      .replace(/<\/?[^>]+>/g, "")
      .trim();

    if (!text) continue;

    const image = extractImage(text);
    const cleanText = removeImageMarker(text);

    items.push({
      type: "text",
      content: cleanText,
      image: image
    });

  }

  // Add tables as separate items
  tables.forEach(t => {
    items.push({
      type: "table",
      content: t
    });
  });

  return items;

}

/* ---------- PDF EXTRACTION ---------- */

async function extractPDF(file) {

  const dataBuffer = fs.readFileSync(file);
  const data = await pdf(dataBuffer);

  return data.text
    .split(/\n{2,}/)
    .map(p => ({
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

    items.forEach((item, i) => {

      const entry = {
        filename: file,
        paragraph: i + 1,
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
