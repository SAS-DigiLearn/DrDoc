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

/* ---------- EMBEDDED WORD IMAGE EXTRACTION ---------- */

function extractEmbeddedImages(html){

  const imgRegex = /<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"/gi;

  let images=[];
  let match;

  while((match=imgRegex.exec(html))!==null){

    const ext = match[1];
    const base64 = match[2];

    const filename = `img_${Math.random().toString(36).substring(2,10)}.${ext}`;
    const path = `images/${filename}`;

    const buffer = Buffer.from(base64,"base64");

    fs.writeFileSync(`./${path}`,buffer);

    images.push({
      original:match[0],
      replacement:`<img src="${path}" class="tip-image">`
    });

  }

  return images;

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
    .filter(s => s.length > 40);
}

/* ---------- DOCX EXTRACTION ---------- */

async function extractDOCX(file) {

  const result = await mammoth.convertToHtml(
    { path: file },
    {
      convertImage: mammoth.images.imgElement(function(image) {

        const filename = "img_" + Date.now() + "." + image.contentType.split("/")[1];
        const filepath = "./images/" + filename;

     return image.readAsBuffer().then(function(buffer) {

  fs.writeFileSync(filepath, buffer);

  return {
    src: "images/" + filename
  };

        });

      })
    }
  );

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

  /* ---------- EXTRACT [para] PARAGRAPHS ---------- */

  const paraRegex = /\[para\](.*?)(?=\[para\]|$)/gis;

  let match;

  while ((match = paraRegex.exec(htmlWithoutTables)) !== null) {

    let paragraphHTML = match[1].trim();

    if (!paragraphHTML) continue;

    const image = extractImage(paragraphHTML);
    const cleanHTML = removeImageMarker(paragraphHTML);

    const chunked = cleanHTML.length > 2000
      ? chunkText(cleanHTML)
      : [cleanHTML];

    chunked.forEach(c => {

      items.push({
        type: "text",
        content: c,
        image: image,
        keywords: extractKeywords(c.replace(/<[^>]+>/g,""))
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
        type:"text",
        content:c,
        keywords:extractKeywords(c)
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

    items.forEach((item,i)=>{

      const hash = item.content.toLowerCase();

      if(seen.has(hash)) return;
      seen.add(hash);

      const entry = {
        filename:file,
        paragraph:i+1,
        type:item.type,
        content:item.content,
        keywords:item.keywords
      };

      if(item.image) entry.image=item.image;

      chunks.push(entry);

    });

  }

  fs.writeFileSync(output,JSON.stringify(chunks,null,2));

  console.log("Knowledge base built:",chunks.length);

}

run();
