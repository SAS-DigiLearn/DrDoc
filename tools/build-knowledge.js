import fs from "fs";
import mammoth from "mammoth";
import pdf from "pdf-parse";

const dataDir = "./docs";
const output = "./data/knowledge.json";

let paragraphs = [];

async function extractDOCX(file) {
  const result = await mammoth.extractRawText({ path: file });
  return result.value.split(/\n{2,}/);
}

async function extractPDF(file) {
  const dataBuffer = fs.readFileSync(file);
  const data = await pdf(dataBuffer);
  return data.text.split(/\n{2,}/);
}

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

    paras.forEach((p, i) => {
      if (p.trim()) {
        paragraphs.push({
          filename: file,
          paragraph: i + 1,
          content: p.trim()
        });
      }
    });
  }

  fs.writeFileSync(output, JSON.stringify(paragraphs, null, 2));
  console.log("Knowledge base built:", paragraphs.length);
}

run();
