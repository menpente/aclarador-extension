// Content script: extracts text content from the active page
// Responds to messages from the popup requesting page text

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractText') {
    try {
      const text = extractPageText();
      const metadata = extractPageMetadata();
      sendResponse({ success: true, text, metadata });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
  return true; // keep message channel open for async response
});

function extractPageText() {
  // Clone body to manipulate without affecting the page
  const clone = document.body.cloneNode(true);

  // Remove elements that don't contain meaningful content
  const selectorsToRemove = [
    'script', 'style', 'noscript', 'iframe', 'svg',
    'nav', 'footer', 'header',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '.cookie-banner', '.cookie-consent',
    '#cookie-banner', '#cookie-consent'
  ];

  selectorsToRemove.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  // Try to find the main content area first
  const mainContent = clone.querySelector(
    'main, article, [role="main"], .content, .post-content, .entry-content, .article-body'
  );

  const source = mainContent || clone;

  // Extract text, preserving paragraph structure
  const blocks = source.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dd, dt');
  let text = '';

  if (blocks.length > 0) {
    const seen = new Set();
    blocks.forEach(block => {
      const blockText = block.textContent.trim();
      if (blockText && !seen.has(blockText)) {
        seen.add(blockText);
        text += blockText + '\n\n';
      }
    });
  }

  // Fallback: use innerText if block extraction yielded little
  if (text.trim().length < 100) {
    text = source.innerText || source.textContent || '';
  }

  // Clean up whitespace
  text = text
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

function extractPageMetadata() {
  const title = document.title || '';
  const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
  const metaKeywords = document.querySelector('meta[name="keywords"]')?.content || '';
  const lang = document.documentElement.lang || '';
  const url = window.location.href;
  const h1 = document.querySelector('h1')?.textContent?.trim() || '';

  return { title, metaDescription, metaKeywords, lang, url, h1 };
}
