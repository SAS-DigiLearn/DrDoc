import fs from "fs";
import mammoth from "mammoth";
import pdf from "pdf-parse";

const dataDir = "./docs";
const output = "./data/knowledge.json";

let chunks = [];

/* ---------- IMAGE MARKER SUPPORT ---------- */

function extractImage(text) {

 
  const plain = text.replace(/<[^>]+>/g,"");

  const match = plain.match(/\[image:(.*?)\]/i);

  if (!match) return null;

  return "images/" + match[1].trim();

}

function removeImageMarker(text) {
  return text.replace(/\[image:.*?\]/gi, "").trim();
}

/* ---------- KEYWORD EXTRACTION ---------- */

function extractKeywords(text) {
  const stopwords = new Set([
    "the","and","for","are","with","that","this","from","your",
    "have","will","into","you","can","not","use","how","when"
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g,"")
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w));
}

/* ---------- OPTIONAL LONG PARAGRAPH CHUNKING ---------- */

function chunkText(text) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences
    .map(s => s.trim())
    .filter(s => s.length > 40); // keep sentences longer than 40 chars
}

/* ---------- DOCX EXTRACTION ---------- */

async function extractDOCX(file) {
  // Convert DOCX to HTML to preserve tables and formatting
  const result = await mammoth.convertToHtml({ path: file });
  const html = result.value;

  let items = [];

  /* ---------- EXTRACT TABLES ---------- */
  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  const tables = html.match(tableRegex) || [];

  tables.forEach(t => {
    const styledTable = t.replace("<table", "<table class='sop-table'");
    items.push({
      type: "table",
      content: styledTable
    });
  });

  /* ---------- REMOVE TABLES FROM HTML ---------- */
  const htmlWithoutTables = html.replace(tableRegex, "");

  /* ---------- EXTRACT [para] PARAGRAPHS (PRESERVE FORMATTING) ---------- */
  const paraRegex = /\[para\](.*?)(?=\[para\]|$)/gis;
  let match;
  while ((match = paraRegex.exec(htmlWithoutTables)) !== null) {
    let paragraphHTML = match[1].trim();
    if (!paragraphHTML) continue;

    const image = extractImage(paragraphHTML);
    const cleanHTML = removeImageMarker(paragraphHTML);

    // Only chunk very long paragraphs; otherwise keep as one block
    const chunked = cleanHTML.length > 2000 ? chunkText(cleanHTML).map(s => s) : [cleanHTML];

    chunked.forEach(c => {
      items.push({
        type: "text",
        content: c,
        image: image,
        keywords: extractKeywords(c.replace(/<[^>]+>/g, "")) // keywords on text only
      });
    });
  }

  return items;
}

/* ---------- PDF EXTRACTION ---------- */

async function extractPDF(file) {
  const dataBuffer = fs.readFileSync(file);
  const data = await pdf(dataBuffer);

  const paragraphs = data.text.split(/\n{2,}/);
  let items = [];

  paragraphs.forEach(p => {
    const chunked = p.length > 1000 ? chunkText(p) : [p.trim()];
    chunked.forEach(c => {
      if (!c) return;
      items.push({
        type: "text",
        content: c,
        keywords: extractKeywords(c)
      });
    });
  });

  return items;
}

/* ---------- MAIN BUILD ---------- */

async function run() {
  const files = fs.readdirSync(dataDir);
  const seen = new Set();

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
      const hash = item.content.toLowerCase();
      if (seen.has(hash)) return;
      seen.add(hash);

      const entry = {
        filename: file,
        paragraph: i + 1,
        type: item.type,
        content: item.content,
        keywords: item.keywords
      };
      if (item.image) entry.image = item.image;
      chunks.push(entry);
    });
  }

  fs.writeFileSync(output, JSON.stringify(chunks, null, 2));
  console.log("Knowledge base built:", chunks.length);
}

run();
