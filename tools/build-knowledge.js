import fs from "fs";
import mammoth from "mammoth";
import pdf from "pdf-parse";
import { pipeline } from "@xenova/transformers";

// Directories
const dataDir = "./docs";               // Your PDF/DOCX source folder
const output = "./data/knowledge.json"; // Output embeddings

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

/* SPLIT PARAGRAPH INTO CHUNKS (2–3 sentences each) */
function chunkParagraph(text, sentencesPerChunk = 3) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  for (let i = 0; i < sentences.length; i += sentencesPerChunk) {
    const chunkText = sentences.slice(i, i + sentencesPerChunk).join(" ").trim();
    if (chunkText) chunks.push(chunkText);
  }
  return chunks;
}

/* CREATE EMBEDDING */
async function embed(text) {
  const result = await embedder(text, {
    pooling: "mean",
    normalize: true
  });
  // Round each float to 4 decimals to reduce size
  return Array.from(result.data).map(v => Number(v.toFixed(4)));
}

/* MAIN BUILD */
async function run() {
  const files = fs.readdirSync(dataDir);

  for (const file of files) {
    const filePath = `${dataDir}/${file}`;
    let paras = [];

    if (file.endsWith(".docx")) paras = await extractDOCX(filePath);
    if (file.endsWith(".pdf")) paras = await extractPDF(filePath);

    for (let i = 0; i < paras.length; i++) {
      const paragraph = paras[i].trim();
      if (!paragraph) continue;

      // Split into smaller chunks for better embeddings
      const subChunks = chunkParagraph(paragraph, 3);

      for (let j = 0; j < subChunks.length; j++) {
        const text = subChunks[j];
        const embedding = await embed(text);

        chunks.push({
          id: `${file}_${i}_${j}`,
          text,
          source: file,
          section: `paragraph ${i + 1}`,
          embedding
        });

        console.log(`Embedded: ${file} paragraph ${i+1} chunk ${j+1}`);
      }
    }
  }

  fs.writeFileSync(output, JSON.stringify(chunks, null, 2));
  console.log("Knowledge base built:", chunks.length);
}

run();
