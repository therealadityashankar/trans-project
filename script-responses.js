const params = new URLSearchParams(window.location.search);

function getLang() {
    return params.get('lang') === 'en' ? 'en' : 'de';
}

function applyLang(lang) {
    document.documentElement.lang = lang;
    document.title = lang === 'de' ? 'Queerness & Kindheit' : 'Queerness & Childhood';

    document.querySelectorAll('[data-lang]').forEach((el) => {
        el.hidden = el.dataset.lang !== lang;
    });

    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        const nextLang = lang === 'de' ? 'en' : 'de';
        const next = new URLSearchParams(window.location.search);
        next.set('lang', nextLang);
        langToggle.href = `?${next.toString()}`;
        langToggle.textContent = nextLang.toUpperCase();
    }
}

const feedList = document.getElementById('responses-list');
const responseDetail = document.getElementById('response-detail');
const detailContent = document.getElementById('detail-content');
const closeDetailBtn = document.getElementById('close-detail');

function escapeHtml(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

function renderFeed(items) {
    if (!feedList) return;

    if (!items.length) {
        feedList.innerHTML = `<div class="response-empty">${getLang() === 'de' ? 'Noch keine Einsendungen.' : 'No responses yet.'}</div>`;
        return;
    }

    feedList.innerHTML = items
        .map((item, index) => {
            const created = item.createdAt ? new Date(item.createdAt).toLocaleString() : '';
            const imageUrl = item.images && item.images[0] ? item.images[0] : null;
            const text = (item.message || '').substring(0, 150);

            return `
<div class="feed-card" data-index="${index}" data-item='${JSON.stringify(item).replace(/'/g, "&apos;")}'>
    ${imageUrl ? `<img class="card-image" src="${imageUrl}" alt="">` : '<div class="card-image"></div>'}
    <div class="card-content">
        <div class="card-meta">${escapeHtml(created)}</div>
        <div class="card-text">${escapeHtml(text)}</div>
    </div>
</div>`;
        })
        .join('');

    // Add click handlers
    document.querySelectorAll('.feed-card').forEach((card) => {
        card.addEventListener('click', () => {
            try {
                const itemData = JSON.parse(card.dataset.item.replace(/&apos;/g, "'"));
                showDetail(itemData);
            } catch (e) {
                console.error('Error parsing item data:', e);
            }
        });
    });
}

function showDetail(item) {
    const created = item.createdAt ? new Date(item.createdAt).toLocaleString() : '';
    const images = (item.images || [])
        .map((imagePath) => {
            return `<img class="detail-image" src="${imagePath}" alt="">`;
        })
        .join('');

    detailContent.innerHTML = `
<div class="detail-meta">${escapeHtml(created)}</div>
<div class="detail-text">${escapeHtml(item.message || '')}</div>
${images ? `<div class="detail-images">${images}</div>` : ''}
`;

    responseDetail.classList.remove('hidden');
}

function closeDetail() {
    responseDetail.classList.add('hidden');
}

async function loadResponses() {
    if (!feedList) return;
    feedList.innerHTML = `<div class="response-loading">${getLang() === 'de' ? 'Lade…' : 'Loading…'}</div>`;

    try {
        const metaResp = await fetch('responses/meta.json');
        if (!metaResp.ok) {
            feedList.innerHTML = `<div class="response-empty">${getLang() === 'de' ? 'Konnte Einsendungen nicht laden.' : 'Could not load responses.'}</div>`;
            return;
        }

        const meta = await metaResp.json();
        const items = [];

        for (const responseData of meta.responses) {
            const id = responseData.id;
            const mdResp = await fetch(`responses/${id}/response.md`);
            if (!mdResp.ok) continue;

            const message = await mdResp.text();
            const images = responseData.images.map((img) => `responses/${id}/${img}`);

            items.push({
                id,
                message: message.trim(),
                images,
                createdAt: new Date().toISOString()
            });
        }

        renderFeed(items.reverse());
    } catch (e) {
        console.error('Error loading responses:', e);
        feedList.innerHTML = `<div class="response-empty">${getLang() === 'de' ? 'Konnte Einsendungen nicht laden.' : 'Could not load responses.'}</div>`;
    }
}

// Close detail when clicking close button or outside
closeDetailBtn.addEventListener('click', closeDetail);
responseDetail.addEventListener('click', (e) => {
    if (e.target === responseDetail) {
        closeDetail();
    }
});

// Initial state
applyLang(getLang());
loadResponses();

window.addEventListener('popstate', () => {
    applyLang(getLang());
    loadResponses();
});
