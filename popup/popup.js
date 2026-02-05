// ============================================================================
// Aclarador Chrome Extension - Popup Logic
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Load saved API key
  chrome.storage.local.get(['groqApiKey', 'charLimit'], (data) => {
    if (data.groqApiKey) {
      document.getElementById('apiKey').value = data.groqApiKey;
    }
    if (data.charLimit) {
      document.getElementById('charLimit').value = data.charLimit;
    }
  });

  // Event listeners
  document.getElementById('analyzeBtn').addEventListener('click', startAnalysis);
  document.getElementById('togglePassword').addEventListener('click', togglePasswordVisibility);
  document.getElementById('copyImprovedBtn').addEventListener('click', copyImprovedText);

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Save API key on change
  document.getElementById('apiKey').addEventListener('change', () => {
    const key = document.getElementById('apiKey').value.trim();
    chrome.storage.local.set({ groqApiKey: key });
  });

  // Save char limit on change
  document.getElementById('charLimit').addEventListener('change', () => {
    const limit = parseInt(document.getElementById('charLimit').value, 10);
    if (limit >= 500) {
      chrome.storage.local.set({ charLimit: limit });
    }
  });
});

// ============================================================================
// UI Helpers
// ============================================================================

function togglePasswordVisibility() {
  const input = document.getElementById('apiKey');
  const toggle = document.getElementById('togglePassword');
  if (input.type === 'password') {
    input.type = 'text';
    toggle.textContent = 'Ocultar';
  } else {
    input.type = 'password';
    toggle.textContent = 'Mostrar';
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
}

function showError(message) {
  const section = document.getElementById('errorSection');
  document.getElementById('errorMessage').textContent = message;
  section.style.display = 'block';
}

function hideError() {
  document.getElementById('errorSection').style.display = 'none';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// Progress Tracking
// ============================================================================

const agentOrder = ['analyzer', 'rewriter', 'grammar', 'style', 'seo', 'validator'];
let completedAgents = new Set();

function resetProgress() {
  completedAgents = new Set();
  document.querySelectorAll('.agent-step').forEach(step => {
    step.classList.remove('active', 'completed');
  });
  document.getElementById('progressBar').style.width = '0%';
  document.getElementById('progressStatus').textContent = 'Iniciando...';
}

function updateProgress(agentName, status) {
  if (agentName === 'done') {
    document.querySelectorAll('.agent-step').forEach(step => {
      step.classList.remove('active');
      step.classList.add('completed');
    });
    document.getElementById('progressBar').style.width = '100%';
    document.getElementById('progressStatus').textContent = status;
    return;
  }

  // Mark previous agents as completed
  for (const agent of agentOrder) {
    if (agent === agentName) break;
    const step = document.querySelector(`.agent-step[data-agent="${agent}"]`);
    if (step) {
      step.classList.remove('active');
      step.classList.add('completed');
      completedAgents.add(agent);
    }
  }

  // Mark current agent as active
  const currentStep = document.querySelector(`.agent-step[data-agent="${agentName}"]`);
  if (currentStep) {
    currentStep.classList.remove('completed');
    currentStep.classList.add('active');
  }

  // Update progress bar
  const currentIndex = agentOrder.indexOf(agentName);
  const progress = Math.round((currentIndex / agentOrder.length) * 100);
  document.getElementById('progressBar').style.width = progress + '%';
  document.getElementById('progressStatus').textContent = status;
}

// ============================================================================
// Main Analysis Flow
// ============================================================================

let analysisResult = null;

async function startAnalysis() {
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) {
    showError('Por favor, ingresa tu clave API de Groq.');
    return;
  }

  // Save API key
  chrome.storage.local.set({ groqApiKey: apiKey });

  hideError();

  // Disable button
  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  btn.textContent = 'Analizando...';

  // Hide previous results
  document.getElementById('resultsSection').style.display = 'none';

  // Show progress
  const progressSection = document.getElementById('progressSection');
  progressSection.style.display = 'block';
  resetProgress();

  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error('No se pudo acceder a la pestaña activa.');
    }

    // Check if we can inject into this tab
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
      throw new Error('No se puede analizar páginas internas del navegador.');
    }

    // Inject content script if needed, then request text extraction
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'extractText' });
    } catch (e) {
      // Content script not loaded yet, inject it
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/content.js']
      });
      response = await chrome.tabs.sendMessage(tab.id, { action: 'extractText' });
    }

    if (!response || !response.success) {
      throw new Error(response?.error || 'No se pudo extraer el texto de la página.');
    }

    const { text, metadata } = response;

    if (!text || text.trim().length < 20) {
      throw new Error('La página no contiene suficiente texto para analizar.');
    }

    // Show page info
    showPageInfo(metadata, text);

    // Truncate text if needed
    const charLimit = parseInt(document.getElementById('charLimit').value, 10) || 3000;
    const truncatedText = text.length > charLimit
      ? text.substring(0, charLimit) + '...'
      : text;

    // Run analysis
    const coordinator = new AgentCoordinator();
    analysisResult = await coordinator.processText(truncatedText, {
      apiKey,
      metadata,
      onProgress: updateProgress
    });

    // Display results
    displayResults(analysisResult);

  } catch (error) {
    console.error('Analysis error:', error);
    showError(error.message);
    progressSection.style.display = 'none';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analizar Página Activa';
  }
}

// ============================================================================
// Display Functions
// ============================================================================

function showPageInfo(metadata, text) {
  const section = document.getElementById('pageInfo');
  section.style.display = 'block';

  document.getElementById('pageTitle').textContent = metadata.title || 'Sin título';
  document.getElementById('pageUrl').textContent = metadata.url || '';

  const wordCount = text.split(/\s+/).filter(w => w).length;
  const sentenceCount = text.split(/[.!?]+/).filter(s => s.trim()).length;
  document.getElementById('pageStats').textContent =
    `${wordCount.toLocaleString()} palabras | ${sentenceCount.toLocaleString()} oraciones | ${text.length.toLocaleString()} caracteres`;
}

function displayResults(result) {
  const section = document.getElementById('resultsSection');
  section.style.display = 'block';

  // Scores
  const quality = result.validation?.qualityScore || 0;
  const readability = result.style?.readabilityScore || 0;
  const severity = result.analysis?.severity || 'N/A';

  document.getElementById('qualityScore').textContent = (quality * 100).toFixed(0) + '%';
  document.getElementById('readabilityScore').textContent = (readability * 100).toFixed(0) + '%';
  document.getElementById('severityScore').textContent = severity;

  // Color-code severity
  const severityCard = document.getElementById('severityCard');
  severityCard.className = 'score-card score-card-severity';
  if (severity === 'high') severityCard.style.background = '#e53e3e';
  else if (severity === 'medium') severityCard.style.background = '#ed8936';
  else severityCard.style.background = '#48bb78';

  // Text comparison
  const originalText = result.originalText || '';
  const improvedText = result.finalText || '';

  document.getElementById('originalText').textContent = originalText;
  document.getElementById('improvedText').textContent = improvedText;
  document.getElementById('sideOriginal').textContent = originalText;
  document.getElementById('sideImproved').textContent = improvedText;

  // Improvements
  const improvementsList = document.getElementById('improvementsList');
  improvementsList.innerHTML = '';

  if (result.improvements && result.improvements.length > 0) {
    result.improvements.forEach(imp => {
      const item = document.createElement('div');
      const type = imp.type || 'general';
      item.className = `improvement-item type-${type}`;
      item.innerHTML = `
        <div class="improvement-type">${escapeHtml(type)}</div>
        <div class="improvement-text">${escapeHtml(imp.change || imp.issue || imp.recommendation || '')}</div>
        ${imp.reason ? `<div class="improvement-reason">${escapeHtml(imp.reason)}</div>` : ''}
      `;
      improvementsList.appendChild(item);
    });
  } else {
    improvementsList.innerHTML = '<div class="empty-state"><p>No se detectaron incidencias significativas.</p></div>';
  }

  // Compliance
  const complianceList = document.getElementById('complianceList');
  complianceList.innerHTML = '';

  if (result.validation?.compliance) {
    result.validation.compliance.forEach(check => {
      const item = document.createElement('div');
      item.className = 'compliance-item';
      item.innerHTML = `
        <span class="compliance-icon ${check.passed ? 'passed' : 'failed'}">${check.passed ? '\u2713' : '\u2717'}</span>
        <span>${escapeHtml(check.criterion)}</span>
      `;
      complianceList.appendChild(item);
    });
  }

  // SEO
  if (result.seo?.seoRecommendations && result.seo.seoRecommendations.length > 0) {
    const seoCard = document.getElementById('seoCard');
    seoCard.style.display = 'block';

    const seoList = document.getElementById('seoList');
    seoList.innerHTML = '';

    result.seo.seoRecommendations.forEach(rec => {
      const item = document.createElement('div');
      item.className = 'seo-item';
      item.innerHTML = `
        <div class="seo-element">${escapeHtml(rec.element || '')}</div>
        <div class="seo-recommendation">${escapeHtml(rec.recommendation)}</div>
        ${rec.reason ? `<div class="seo-reason">${escapeHtml(rec.reason)}</div>` : ''}
      `;
      seoList.appendChild(item);
    });
  }
}

// ============================================================================
// Copy to Clipboard
// ============================================================================

function copyImprovedText() {
  if (!analysisResult?.finalText) return;

  navigator.clipboard.writeText(analysisResult.finalText).then(() => {
    const btn = document.getElementById('copyImprovedBtn');
    btn.textContent = 'Copiado!';
    setTimeout(() => { btn.textContent = 'Copiar Mejorado'; }, 2000);
  }).catch(() => {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = analysisResult.finalText;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);

    const btn = document.getElementById('copyImprovedBtn');
    btn.textContent = 'Copiado!';
    setTimeout(() => { btn.textContent = 'Copiar Mejorado'; }, 2000);
  });
}
