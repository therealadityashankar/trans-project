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

        // Redirect to responses page
        setTimeout(() => {
            const next = new URLSearchParams(window.location.search);
            next.delete('lang');
            window.location.href = `index.html?lang=${getLang()}`;
        }, 2000);
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

window.addEventListener('popstate', () => {
    applyLang(getLang());
});
