// Placeholder URL - replace with Cloudflare Worker URL
const SUBMISSION_URL = 'https://email-forwarder.theadityashankar.workers.dev';
const RESPONSES_URL = `${SUBMISSION_URL}/responses`;

const params = new URLSearchParams(window.location.search);

function getLang() {
    return params.get('lang') === 'en' ? 'en' : 'de';
}

function getView() {
    return params.get('view') === 'post' ? 'post' : 'all';
}

function setParams(next) {
    const nextParams = new URLSearchParams(next);
    const url = `${window.location.pathname}?${nextParams.toString()}`;
    history.pushState(null, '', url);
    params.delete('lang');
    params.delete('view');
    for (const [k, v] of nextParams.entries()) {
        params.set(k, v);
    }
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
        if (!next.get('view')) next.set('view', getView());
        langToggle.href = `?${next.toString()}`;
        langToggle.textContent = nextLang.toUpperCase();
    }
}

function applyView(view) {
    const responsesView = document.getElementById('responses-view');
    const postView = document.getElementById('post-view');
    const navAll = document.getElementById('nav-all');
    const navPost = document.getElementById('nav-post');

    if (responsesView) responsesView.hidden = view !== 'all';
    if (postView) postView.hidden = view !== 'post';

    if (navAll) navAll.classList.toggle('active', view === 'all');
    if (navPost) navPost.classList.toggle('active', view === 'post');
}

// Form submission
const form = document.getElementById('submission-form');
const formMessage = document.getElementById('form-message');
const responsesList = document.getElementById('responses-list');

async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
            name: file.name,
            type: file.type,
            data: reader.result.split(',')[1]
        });
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function escapeHtml(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

function renderResponses(items) {
    if (!responsesList) return;

    if (!items.length) {
        responsesList.innerHTML = `<div class="response-empty">${getLang() === 'de' ? 'Noch keine Einsendungen.' : 'No responses yet.'}</div>`;
        return;
    }

    responsesList.innerHTML = items
        .map((item) => {
            const created = item.createdAt ? new Date(item.createdAt).toLocaleString() : '';
            const images = (item.files || [])
                .filter((f) => (f.type || '').startsWith('image/') && f.data)
                .map((f) => {
                    const src = `data:${f.type};base64,${f.data}`;
                    return `<img class="response-image" src="${src}" alt="">`;
                })
                .join('');

            return `
<article class="response-item">
  <div class="response-meta">${escapeHtml(created)}</div>
  <div class="response-message">${escapeHtml(item.message || '')}</div>
  ${images ? `<div class="response-images">${images}</div>` : ''}
</article>`;
        })
        .join('');
}

async function loadResponses() {
    if (!responsesList) return;
    responsesList.innerHTML = `<div class="response-loading">${getLang() === 'de' ? 'Lade…' : 'Loading…'}</div>`;

    const resp = await fetch(RESPONSES_URL, { method: 'GET' });
    if (!resp.ok) {
        responsesList.innerHTML = `<div class="response-empty">${getLang() === 'de' ? 'Konnte Einsendungen nicht laden.' : 'Could not load responses.'}</div>`;
        return;
    }

    const data = await resp.json();
    renderResponses(Array.isArray(data.items) ? data.items : []);
}

function setupSidebar() {
    const navAll = document.getElementById('nav-all');
    const navPost = document.getElementById('nav-post');

    if (navAll) {
        navAll.addEventListener('click', () => {
            const next = new URLSearchParams(window.location.search);
            next.set('view', 'all');
            if (!next.get('lang')) next.set('lang', getLang());
            setParams(next);
            applyView('all');
            loadResponses();
        });
    }

    if (navPost) {
        navPost.addEventListener('click', () => {
            const next = new URLSearchParams(window.location.search);
            next.set('view', 'post');
            if (!next.get('lang')) next.set('lang', getLang());
            setParams(next);
            applyView('post');
        });
    }
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;

    const fileInput = document.getElementById('file-upload');
    const files = await Promise.all(Array.from(fileInput.files).map(fileToBase64));

    const honeypot = (form.querySelector('[name="honeypot"]')?.value || '').trim();

    const payload = {
        from: "anonymous",
        subject: document.getElementById('story').dataset.subject || 'Submission',
        message: document.getElementById('story').value.trim(),
        files,
        honeypot,
        lang: getLang()
    };

    const response = await fetch(SUBMISSION_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    
    formMessage.classList.remove('hidden', 'success', 'error');
    
    if (response.ok) {
        formMessage.classList.add('success');
        formMessage.textContent = getLang() === 'de' 
            ? 'Vielen Dank für deine Einsendung!' 
            : 'Thank you for your submission!';
        form.reset();

        const next = new URLSearchParams(window.location.search);
        next.set('view', 'all');
        if (!next.get('lang')) next.set('lang', getLang());
        setParams(next);
        applyView('all');
        loadResponses();
    } else {
        formMessage.classList.add('error');
        formMessage.textContent = getLang() === 'de'
            ? 'Es gab einen Fehler. Bitte versuche es erneut.'
            : 'There was an error. Please try again.';
    }
    
    submitBtn.disabled = false;
});

// Initial state
applyLang(getLang());
applyView(getView());
setupSidebar();
if (getView() === 'all') {
    loadResponses();
}

window.addEventListener('popstate', () => {
    applyLang(getLang());
    applyView(getView());
    if (getView() === 'all') loadResponses();
});
