// Placeholder URL - replace with Cloudflare Worker URL
const SUBMISSION_URL = 'https://email-forwarder.theadityashankar.workers.dev';

// Get current language from document
const currentLang = document.documentElement.lang;

// Form submission
const form = document.getElementById('submission-form');
const formMessage = document.getElementById('form-message');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;

    const payload = {
        subject: document.getElementById('story').dataset.subject || 'Submission',
        message: document.getElementById('story').value.trim(),
        honeypot: ''
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
        formMessage.textContent = currentLang === 'de' 
            ? 'Vielen Dank für deine Einsendung!' 
            : 'Thank you for your submission!';
        form.reset();
    } else {
        formMessage.classList.add('error');
        formMessage.textContent = currentLang === 'de'
            ? 'Es gab einen Fehler. Bitte versuche es erneut.'
            : 'There was an error. Please try again.';
    }
    
    submitBtn.disabled = false;
});
