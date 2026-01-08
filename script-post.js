// Placeholder URL - replace with Cloudflare Worker URL
const SUBMISSION_URL = 'https://email-forwarder.theadityashankar.workers.dev';

const params = new URLSearchParams(window.location.search);

function getLang() {
    return params.get('lang') === 'en' ? 'en' : 'de';
}

function setParams(next) {
    const nextParams = new URLSearchParams(next);
    const url = `${window.location.pathname}?${nextParams.toString()}`;
    history.pushState(null, '', url);
    params.delete('lang');
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
        langToggle.href = `?${next.toString()}`;
        langToggle.textContent = nextLang.toUpperCase();
    }
}

// Form submission
const form = document.getElementById('submission-form');
const formMessage = document.getElementById('form-message');

function escapeHtml(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

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

    // Show loading state
    formMessage.classList.remove('hidden', 'success', 'error', 'loading');
    formMessage.classList.add('loading');
    formMessage.innerHTML = getLang() === 'de' 
        ? '<div class="spinner"></div><p>Deine Einsendung wird hochgeladen…</p>'
        : '<div class="spinner"></div><p>Uploading your submission…</p>';
    form.style.display = 'none';

    try {
        const response = await fetch(SUBMISSION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        formMessage.classList.remove('loading');
        
        if (response.ok || response.status === 202) {
            // Success or partial success
            formMessage.classList.add('success');
            const lang = getLang();
            const responseLink = `index.html?lang=${lang}`;
            
            if (response.status === 202) {
                formMessage.innerHTML = getLang() === 'de' 
                    ? `<p>Deine Einsendung wurde empfangen, aber es gab ein Problem beim Speichern. Sie wird möglicherweise nicht sofort angezeigt.</p><a href="${responseLink}" class="response-link">${getLang() === 'de' ? 'Zu den Einsendungen' : 'View submissions'}</a>`
                    : `<p>Your submission was received but there was an issue saving it. It may not appear immediately.</p><a href="${responseLink}" class="response-link">View submissions</a>`;
            } else {
                formMessage.innerHTML = getLang() === 'de' 
                    ? `<p>Vielen Dank für deine Einsendung!</p><p><small>Aufgrund der Cache-Aktualisierung kann es ein paar Minuten dauern, bis neue Einsendungen erscheinen. Drücke Shift+Neu laden, um die neuesten Einsendungen zu sehen.</small></p><a href="${responseLink}" class="response-link">Zu den Einsendungen</a>`
                    : `<p>Thank you for your submission!</p><p><small>Due to cache updates, it may take a few minutes for new responses to appear. Press Shift+Reload to see the latest responses.</small></p><a href="${responseLink}" class="response-link">View submissions</a>`;
            }
        } else {
            formMessage.classList.add('error');
            const errorMsg = data.error || 'Unknown error';
            const details = data.details ? `<small>${data.details}</small>` : '';
            formMessage.innerHTML = `<p>${getLang() === 'de' ? 'Es gab einen Fehler: ' : 'There was an error: '}</p><p>${escapeHtml(errorMsg)}</p>${details}<button type="button" class="retry-btn">${getLang() === 'de' ? 'Erneut versuchen' : 'Try again'}</button>`;
            
            // Reset form on retry
            document.querySelector('.retry-btn').addEventListener('click', () => {
                formMessage.classList.add('hidden');
                form.style.display = '';
                submitBtn.disabled = false;
            });
        }
    } catch (error) {
        formMessage.classList.remove('loading');
        formMessage.classList.add('error');
        formMessage.innerHTML = `<p>${getLang() === 'de' ? 'Netzwerkfehler: ' : 'Network error: '}</p><p>${escapeHtml(error.message)}</p><button type="button" class="retry-btn">${getLang() === 'de' ? 'Erneut versuchen' : 'Try again'}</button>`;
        
        document.querySelector('.retry-btn').addEventListener('click', () => {
            formMessage.classList.add('hidden');
            form.style.display = '';
            submitBtn.disabled = false;
        });
    }
});

// Initial state
applyLang(getLang());

window.addEventListener('popstate', () => {
    applyLang(getLang());
});
