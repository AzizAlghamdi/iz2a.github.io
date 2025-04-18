/**
 * Website Translation Service - English to Arabic
 *
 * This script adds translation functionality to your website using Google Translate
 * without requiring an API key.
 *
 * Designed to work with your existing language switcher.
 */

// Configuration
const CONFIG = {
  // Use Google's unofficial translation endpoint that doesn't require API key
  apiUrl: 'https://translate.googleapis.com/translate_a/single',
  // Source and target languages
  sourceLang: 'en',
  targetLang: 'ar',
  // CSS selectors for translatable elements
  translatableSelector: '.translatable',
  // Storage key for saving translations
  storageKey: 'website_translations',
  // How long to cache translations (in milliseconds) - 1 day
  cacheDuration: 24 * 60 * 60 * 1000
};

// Global variables
let currentLanguage = 'en';
let translations = {};
let translationInProgress = false;
let elementsToTranslate = [];
let originalTexts = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Load cached translations
  loadTranslations();

  // Find all translatable elements
  elementsToTranslate = document.querySelectorAll(CONFIG.translatableSelector);

  // Store original texts
  elementsToTranslate.forEach(element => {
    originalTexts.push(element.innerText);
  });

  // Connect to existing language switcher
  const enBtn = document.getElementById('en-btn');
  const arBtn = document.getElementById('ar-btn');

  if (enBtn && arBtn) {
    // The changeLanguage function is already defined in your HTML
    // We'll modify it to work with our translation system
    window.originalChangeLanguage = window.changeLanguage || function() {};

    // Override the changeLanguage function
    window.changeLanguage = function(lang) {
      // Call the original function if it exists
      window.originalChangeLanguage(lang);

      // Handle translation
      if (lang === 'ar' && currentLanguage !== 'ar') {
        currentLanguage = 'ar';
        translateToArabic();
        document.documentElement.setAttribute('dir', 'rtl');
        localStorage.setItem('preferred_language', 'ar');
      } else if (lang === 'en' && currentLanguage !== 'en') {
        currentLanguage = 'en';
        restoreOriginalText();
        document.documentElement.setAttribute('dir', 'ltr');
        localStorage.setItem('preferred_language', 'en');
      }
    };
  } else {
    console.warn('Language switcher buttons not found. Make sure your HTML includes buttons with id="en-btn" and id="ar-btn"');
  }

  // Check if we should start in Arabic based on URL param or saved preference
  const params = new URLSearchParams(window.location.search);
  if (params.get('lang') === 'ar' || localStorage.getItem('preferred_language') === 'ar') {
    // Simulate click on the Arabic button
    const arBtn = document.getElementById('ar-btn');
    if (arBtn) {
      arBtn.click();
    } else {
      // Directly change to Arabic
      changeLanguage('ar');
    }
  }
});

// Translate all content to Arabic
async function translateToArabic() {
  if (translationInProgress) return;

  translationInProgress = true;

  // Show translation indicator
  showTranslationIndicator(true);

  try {
    const translationPromises = [];

    // Process each translatable element
    for (let i = 0; i < elementsToTranslate.length; i++) {
      const element = elementsToTranslate[i];
      const originalText = originalTexts[i];

      // Skip empty elements
      if (!originalText.trim()) continue;

      // Check if we already have a cached translation
      const cacheKey = hashString(originalText);
      if (translations[cacheKey]) {
        element.innerText = translations[cacheKey].text;

        // Check if cached translation is expired
        if (Date.now() - translations[cacheKey].timestamp > CONFIG.cacheDuration) {
          // Update cache in background
          translationPromises.push(translateText(originalText).then(translatedText => {
            if (translatedText) {
              translations[cacheKey] = {
                text: translatedText,
                timestamp: Date.now()
              };
              element.innerText = translatedText;
            }
          }));
        }
      } else {
        // No cached translation, translate now
        translationPromises.push(translateText(originalText).then(translatedText => {
          if (translatedText) {
            translations[cacheKey] = {
              text: translatedText,
              timestamp: Date.now()
            };
            element.innerText = translatedText;
          }
        }));
      }
    }

    // Wait for all translations to complete
    await Promise.all(translationPromises);

    // Save translations to local storage
    saveTranslations();
  } catch (error) {
    console.error('Translation error:', error);
    alert('Translation failed. Please try again later.');
    // Revert to English on error
    currentLanguage = 'en';
    restoreOriginalText();
  } finally {
    translationInProgress = false;
    showTranslationIndicator(false);
  }
}

// Restore original English text
function restoreOriginalText() {
  elementsToTranslate.forEach((element, index) => {
    element.innerText = originalTexts[index];
  });
}

// Translate a single text using Google Translate without API key
async function translateText(text) {
  try {
    // Rate limiting - avoid too many requests at once
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));

    // URL encode the text
    const encodedText = encodeURIComponent(text);

    // Build the query parameters
    const params = new URLSearchParams({
      client: 'gtx',        // Use 'gtx' client (no API key required)
      sl: CONFIG.sourceLang, // Source language
      tl: CONFIG.targetLang, // Target language
      dt: 't',              // Return translated text
      q: encodedText        // Text to translate
    });

    // Make the request
    const response = await fetch(`${CONFIG.apiUrl}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Parse the response - Google returns a nested array structure
    const data = await response.json();

    // The translation is in the first element of the first array
    // Structure is typically: [[["translated text","original text",null,null,1]],null,"en"]
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      return data[0][0][0];
    } else {
      console.error('Unexpected translation response format:', data);
      return null;
    }
  } catch (error) {
    console.error('Translation API error:', error);
    // If API fails, try fallback method
    return tryFallbackMethod(text);
  }
}

// Fallback translation method
async function tryFallbackMethod(text) {
  try {
    // Alternative endpoint
    const url = `https://translation.googleapis.com/language/translate/v2?source=${CONFIG.sourceLang}&target=${CONFIG.targetLang}&q=${encodeURIComponent(text)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.data && data.data.translations && data.data.translations[0]) {
      return data.data.translations[0].translatedText;
    }

    return null;
  } catch (error) {
    console.error('Fallback translation error:', error);
    return text; // Return original text as last resort
  }
}

// Save translations to local storage
function saveTranslations() {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(translations));
  } catch (error) {
    console.error('Error saving translations to local storage:', error);
  }
}

// Load translations from local storage
function loadTranslations() {
  try {
    const saved = localStorage.getItem(CONFIG.storageKey);
    if (saved) {
      translations = JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading translations from local storage:', error);
    translations = {};
  }
}

// Simple string hash function for caching
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}

// Show/hide translation indicator
function showTranslationIndicator(show) {
  let indicator = document.getElementById('translation-indicator');

  if (show) {
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'translation-indicator';
      indicator.innerHTML = 'Translating...';
      indicator.style.position = 'fixed';
      indicator.style.top = '60px';
      indicator.style.right = '20px';
      indicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      indicator.style.color = 'white';
      indicator.style.padding = '8px 12px';
      indicator.style.borderRadius = '4px';
      indicator.style.zIndex = '1001';
      document.body.appendChild(indicator);
    }
    indicator.style.display = 'block';
  } else if (indicator) {
    indicator.style.display = 'none';
  }
}

// Additional helper function to update page after dynamic content changes
function updateTranslatableElements() {
  // Re-scan the page for translatable elements
  elementsToTranslate = document.querySelectorAll(CONFIG.translatableSelector);
  originalTexts = [];

  // Update original texts
  elementsToTranslate.forEach(element => {
    originalTexts.push(element.innerText);
  });

  // If currently in Arabic, translate the new elements
  if (currentLanguage === 'ar') {
    translateToArabic();
  }
}

// Make updateTranslatableElements available globally
window.updateTranslatableElements = updateTranslatableElements;