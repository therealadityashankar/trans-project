#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

async function build() {
  // Dynamic import of ESM module
  const { escapeHtml, renderFeedCard, renderResponses, renderIndexHtml } = await import('./worker/src/render.js');

  const templatePath = path.join(__dirname, 'pre-index.html');
  const outputPath = path.join(__dirname, 'index.html');

  if (!fs.existsSync(templatePath)) {
    console.error('Error: pre-index.html not found');
    process.exit(1);
  }

  const template = fs.readFileSync(templatePath, 'utf8');
  const responses = getLocalResponses();
  const output = renderIndexHtml(template, responses);
  fs.writeFileSync(outputPath, output, 'utf8');

  console.log(`Built index.html with ${responses.length} responses`);
}

function getLocalResponses() {
  const responsesDir = path.join(__dirname, 'responses');
  if (!fs.existsSync(responsesDir)) {
    return [];
  }

  const dirs = fs.readdirSync(responsesDir)
    .filter(name => {
      const stat = fs.statSync(path.join(responsesDir, name));
      return stat.isDirectory() && /^\d+$/.test(name);
    })
    .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

  const responses = [];
  for (const timestamp of dirs) {
    const dirPath = path.join(responsesDir, timestamp);
    const mdPath = path.join(dirPath, 'response.md');
    
    let message = '';
    if (fs.existsSync(mdPath)) {
      message = fs.readFileSync(mdPath, 'utf8').trim();
    }

    const files = fs.readdirSync(dirPath);
    const images = files
      .filter(f => /^image\d+\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0], 10);
        const numB = parseInt(b.match(/\d+/)[0], 10);
        return numA - numB;
      })
      .map(f => `https://cdn.jsdelivr.net/gh/therealadityashankar/trans-project@main/responses/${timestamp}/${f}`);

    responses.push({
      id: timestamp,
      message,
      images,
      createdAt: new Date(parseInt(timestamp, 10) * 1000).toISOString(),
    });
  }

  return responses;
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
