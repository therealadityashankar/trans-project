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

const responseDetail = document.getElementById('response-detail');
const detailContent = document.getElementById('detail-content');
const closeDetailDesktop = document.getElementById('close-detail-desktop');
const closeDetailMobile = document.getElementById('close-detail-mobile');

function escapeHtml(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
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

function setupCardClickHandlers() {
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

// Close detail when clicking close buttons or outside
closeDetailDesktop.addEventListener('click', closeDetail);
closeDetailMobile.addEventListener('click', closeDetail);
responseDetail.addEventListener('click', (e) => {
    if (e.target === responseDetail) {
        closeDetail();
    }
});

// Initial state
applyLang(getLang());
setupCardClickHandlers();

window.addEventListener('popstate', () => {
    applyLang(getLang());
});
