const cache = {};

async function loadTranslations(lang) {
  if (cache[lang]) return cache[lang];
  try {
    const res = await fetch(`/translations/${lang}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cache[lang] = await res.json();
  } catch {
    cache[lang] = {};
  }
  return cache[lang];
}

async function applyLang(lang) {
  const t = await loadTranslations(lang);
  if (!Object.keys(t).length) return;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key] !== undefined) el.textContent = t[key];
  });

  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.dataset.i18nHtml;
    if (t[key] !== undefined) el.innerHTML = t[key];
  });

  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
  localStorage.setItem('lang', lang);
  updateToggleButton(lang);
}

function updateToggleButton(lang) {
  const btn = document.getElementById('lang-toggle');
  if (btn) btn.textContent = lang === 'pt' ? 'EN' : 'PT';
}

document.addEventListener('DOMContentLoaded', async () => {
  const lang = localStorage.getItem('lang') || 'pt';
  await applyLang(lang);

  document.getElementById('lang-toggle')?.addEventListener('click', () => {
    const current = localStorage.getItem('lang') || 'pt';
    applyLang(current === 'pt' ? 'en' : 'pt');
  });
});
