// Placeholder URL - replace with Cloudflare Worker URL
const SUBMISSION_URL = 'https://your-cloudflare-worker.workers.dev/submit';

// Get current language from document
const currentLang = document.documentElement.lang;

// Form submission
const form = document.getElementById('submission-form');
const formMessage = document.getElementById('form-message');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    
    const formData = new FormData(form);
    
    const fileInput = document.getElementById('file-upload');
    if (fileInput.files[0]) {
        formData.append('file', fileInput.files[0]);
    }
    
    const response = await fetch(SUBMISSION_URL, {
        method: 'POST',
        body: formData
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
