#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Import render functions (duplicated here for Node.js compatibility)
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderFeedCard(item) {
  const created = item.createdAt ? new Date(item.createdAt).toLocaleString() : '';
  const firstImage = item.images && item.images[0] ? item.images[0] : null;
  const text = (item.message || '').substring(0, 150);
  const itemJson = JSON.stringify(item).replace(/'/g, '&apos;');

  return `
<div class="feed-card" data-item='${itemJson}'>
    ${firstImage ? `<img class="card-image" src="${escapeHtml(firstImage)}" alt="">` : '<div class="card-image"></div>'}
    <div class="card-content">
        <div class="card-meta">${escapeHtml(created)}</div>
        <div class="card-text">${escapeHtml(text)}</div>
    </div>
</div>`;
}

function renderResponses(items) {
  if (!items.length) {
    return '<div class="response-empty">Noch keine Einsendungen.</div>';
  }
  return items.map(renderFeedCard).join('\n');
}

function renderIndexHtml(template, items) {
  const renderedResponses = renderResponses(items);
  return template.replace('<!-- RESPONSES_PLACEHOLDER -->', renderedResponses);
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

function build() {
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

// Run if called directly
if (require.main === module) {
  build();
}
