export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderFeedCard(item) {
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

export function renderResponses(items) {
  if (!items.length) {
    return '<div class="response-empty">Noch keine Einsendungen.</div>';
  }
  return items.map(renderFeedCard).join('\n');
}

export function renderIndexHtml(template, items) {
  const renderedResponses = renderResponses(items);
  return template.replace('<!-- RESPONSES_PLACEHOLDER -->', renderedResponses);
}
