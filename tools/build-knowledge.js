import fs from "fs";
import mammoth from "mammoth";
import pdf from "pdf-parse";
import { pipeline } from "@xenova/transformers";

const dataDir = "./docs";
const output = "./data/knowledge.json";

let chunks = [];

/* LOAD EMBEDDING MODEL */
const embedder = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2"
);

/* DOCX EXTRACTION */
async function extractDOCX(file) {
  const result = await mammoth.extractRawText({ path: file });
  return result.value.split(/\n{2,}/);
}

/* PDF EXTRACTION */
async function extractPDF(file) {
  const dataBuffer = fs.readFileSync(file);
  const data = await pdf(dataBuffer);
  return data.text.split(/\n{2,}/);
}

/* CREATE EMBEDDING */
async function embed(text) {
  const result = await embedder(text, {
    pooling: "mean",
    normalize: true
  });

  return Array.from(result.data);
}

/* MAIN BUILD */
async function run() {

  const files = fs.readdirSync(dataDir);

  for (const file of files) {

    const path = `${dataDir}/${file}`;
    let paras = [];

    if (file.endsWith(".docx")) {
      paras = await extractDOCX(path);
    }

    if (file.endsWith(".pdf")) {
      paras = await extractPDF(path);
    }

    for (let i = 0; i < paras.length; i++) {

      const text = paras[i].trim();
      if (!text) continue;

      const embedding = await embed(text);

      chunks.push({
        id: `${file}_${i}`,
        text: text,
        source: file,
        section: `paragraph ${i + 1}`,
        embedding: embedding
      });

      console.log(`Embedded: ${file} paragraph ${i+1}`);
    }

  }

  fs.writeFileSync(output, JSON.stringify(chunks,null,2));

  console.log("Knowledge base built:", chunks.length);
}

run();
