const translations = {};
let currentLanguage = 'en';

async function setLanguage(lang) {
    currentLanguage = lang;
    if (!translations[lang]) {
        const response = await fetch(`lang/${lang}.json`);
        translations[lang] = await response.json();
    }
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    translatePage();
}

function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = translations[currentLanguage][key] || key;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = translations[currentLanguage][key] || key;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const lang = localStorage.getItem('language') || 'en';
    setLanguage(lang);

    document.getElementById('lang-en').addEventListener('click', () => {
        localStorage.setItem('language', 'en');
        setLanguage('en');
    });

    document.getElementById('lang-ar').addEventListener('click', () => {
        localStorage.setItem('language', 'ar');
        setLanguage('ar');
    });
});
