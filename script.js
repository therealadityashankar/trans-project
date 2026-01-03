// Placeholder URL - replace with Cloudflare Worker URL
const SUBMISSION_URL = 'https://email-forwarder.theadityashankar.workers.dev';

// Get current language from document
const currentLang = document.documentElement.lang;

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
    const files = await Promise.all(
        Array.from(fileInput.files).map(fileToBase64)
    );

    const payload = {
        from: "anonymous",
        subject: document.getElementById('story').dataset.subject || 'Submission',
        message: document.getElementById('story').value.trim(),
        files,
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
