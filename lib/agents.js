// ============================================================================
// SYSTEM PROMPT (from aclarador-html)
// ============================================================================
const SYSTEM_PROMPT = `Eres un experto en lenguaje claro basado en el Manual de Estilo del Gobierno de Aragón.

PRINCIPIOS FUNDAMENTALES:
1. Expresar UNA SOLA IDEA por oración
2. Máximo 30 palabras por oración
3. Usar voz activa
4. Vocabulario común y preciso
5. Puntuación estratégica

CORRECCIONES ESPECÍFICAS:
- Eliminar muletillas ("es decir", "o sea")
- Evitar redundancias
- Simplificar lenguaje burocrático
- Sustituir nominalizaciones por verbos
- Convertir pasiva a activa

ADAPTACIÓN DIGITAL:
- Párrafos cortos
- Subtítulos descriptivos
- Formato escaneable
- Optimización SEO

Analiza el texto y proporciona mejoras específicas.`;

// ============================================================================
// BASE AGENT CLASS
// ============================================================================
class BaseAgent {
  constructor(name) {
    this.name = name;
  }

  async analyze(text, context = {}) {
    throw new Error('analyze() must be implemented by subclass');
  }

  getCapabilities() {
    throw new Error('getCapabilities() must be implemented by subclass');
  }
}

// ============================================================================
// ANALYZER AGENT
// ============================================================================
class AnalyzerAgent extends BaseAgent {
  constructor() {
    super('Analyzer');
  }

  async analyze(text, context = {}) {
    const classification = this._classifyText(text, context);
    const issues = this._detectIssues(text);
    const recommendedAgents = this._recommendAgents(classification, issues);
    const severity = this._assessSeverity(issues);

    return {
      agent: this.name,
      classification,
      issues,
      recommendedAgents,
      severity
    };
  }

  getCapabilities() {
    return ['text_classification', 'issue_detection', 'agent_routing', 'severity_assessment'];
  }

  _classifyText(text, context = {}) {
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 100) return 'short';
    // Web pages always get web classification since we're analyzing browser content
    if (context.isWebPage) return 'web';
    if (text.includes('meta') || text.includes('título') || text.includes('SEO')) {
      return 'web';
    }
    return 'document';
  }

  _detectIssues(text) {
    const issues = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());

    sentences.forEach((sentence, idx) => {
      const words = sentence.trim().split(/\s+/).length;
      if (words > 30) {
        issues.push({
          type: 'sentence_length',
          sentence: idx + 1,
          words: words,
          text: sentence.trim()
        });
      }
    });

    const longWords = text.match(/\b\w{13,}\b/g) || [];
    if (longWords.length > 0) {
      issues.push({
        type: 'complex_vocabulary',
        count: longWords.length,
        examples: longWords.slice(0, 3)
      });
    }

    return issues;
  }

  _recommendAgents(classification, issues) {
    const agents = ['grammar', 'validator'];

    if (issues.length > 2 || classification === 'document') {
      agents.unshift('style');
    }

    if (classification === 'web') {
      agents.push('seo');
    }

    return agents;
  }

  _assessSeverity(issues) {
    if (issues.length >= 3) return 'high';
    if (issues.length >= 2) return 'medium';
    return 'low';
  }
}

// ============================================================================
// REWRITER AGENT (uses Groq API)
// ============================================================================
class RewriterAgent extends BaseAgent {
  constructor() {
    super('Rewriter');
  }

  async analyze(text, context = {}) {
    const apiKey = context.apiKey;
    if (!apiKey) {
      throw new Error('API key requerida');
    }

    const issues = this._detectIssues(text);
    const prompt = this._buildRewritePrompt(text, issues);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`API error: ${response.status} ${errorBody}`);
    }

    const data = await response.json();
    const rewrittenText = data.choices[0].message.content;
    const improvements = this._identifyImprovements(text, rewrittenText);

    return {
      agent: this.name,
      originalText: text,
      rewrittenText,
      improvements,
      issuesDetected: issues
    };
  }

  getCapabilities() {
    return ['comprehensive_rewriting', 'clarity_enhancement', 'structure_improvement', 'plain_language_conversion'];
  }

  _detectIssues(text) {
    const issues = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());

    if (sentences.some(s => s.trim().split(/\s+/).length > 30)) {
      issues.push('long_sentences');
    }
    if (text.match(/\b(fue|fueron|ha sido|han sido)\b/gi)) {
      issues.push('passive_voice');
    }
    if (text.match(/\b\w{13,}\b/)) {
      issues.push('complex_vocabulary');
    }

    return issues;
  }

  _buildRewritePrompt(text, issues) {
    let prompt = `Reescribe el siguiente texto aplicando principios de lenguaje claro.\n\n`;

    if (issues.includes('long_sentences')) {
      prompt += `- Hay oraciones largas (>30 palabras). Divídelas.\n`;
    }
    if (issues.includes('passive_voice')) {
      prompt += `- Convierte voz pasiva a activa.\n`;
    }
    if (issues.includes('complex_vocabulary')) {
      prompt += `- Simplifica vocabulario complejo.\n`;
    }

    prompt += `\nTexto original:\n${text}`;
    return prompt;
  }

  _identifyImprovements(original, rewritten) {
    const improvements = [];

    const origSentences = original.split(/[.!?]+/).filter(s => s.trim());
    const rewritSentences = rewritten.split(/[.!?]+/).filter(s => s.trim());

    if (rewritSentences.length > origSentences.length) {
      improvements.push({
        type: 'structure',
        change: 'Oraciones divididas para mayor claridad',
        reason: 'Una idea por oración (máximo 30 palabras)'
      });
    }

    const origAvg = origSentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / (origSentences.length || 1);
    const rewAvg = rewritSentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / (rewritSentences.length || 1);

    if (rewAvg < origAvg - 3) {
      improvements.push({
        type: 'sentence_length',
        change: `Reducción promedio: ${origAvg.toFixed(1)} → ${rewAvg.toFixed(1)} palabras`,
        reason: 'Mejor legibilidad con oraciones más cortas'
      });
    }

    return improvements;
  }
}

// ============================================================================
// GRAMMAR AGENT
// ============================================================================
class GrammarAgent extends BaseAgent {
  constructor() {
    super('Grammar');
  }

  async analyze(text, context = {}) {
    const issues = this._findGrammarIssues(text);
    return {
      agent: this.name,
      issues,
      correctedText: text
    };
  }

  getCapabilities() {
    return ['grammar_correction', 'punctuation_fixing', 'sentence_structure', 'agreement_checking'];
  }

  _findGrammarIssues(text) {
    const issues = [];

    const repeatedWords = text.match(/\b(\w+)\s+\1\b/gi);
    if (repeatedWords) {
      issues.push({
        type: 'grammar',
        issue: 'Palabras repetidas',
        examples: repeatedWords.slice(0, 3),
        recommendation: 'Eliminar repeticiones innecesarias'
      });
    }

    return issues;
  }
}

// ============================================================================
// STYLE AGENT
// ============================================================================
class StyleAgent extends BaseAgent {
  constructor() {
    super('Style');
  }

  async analyze(text, context = {}) {
    const issues = this._findStyleIssues(text);
    const readability = this._calculateReadability(text);

    return {
      agent: this.name,
      styleIssues: issues,
      readabilityScore: readability
    };
  }

  getCapabilities() {
    return ['sentence_simplification', 'jargon_removal', 'flow_improvement', 'readability_enhancement'];
  }

  _findStyleIssues(text) {
    const issues = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());

    sentences.forEach((sentence, idx) => {
      const words = sentence.trim().split(/\s+/).length;
      if (words > 30) {
        issues.push({
          type: 'style',
          issue: 'Oración demasiado larga',
          sentence: idx + 1,
          words,
          recommendation: 'Dividir en oraciones más cortas'
        });
      }
    });

    if (text.match(/\b(fue|fueron|ha sido|han sido)\b/gi)) {
      issues.push({
        type: 'style',
        issue: 'Posible voz pasiva',
        recommendation: 'Usar voz activa para mayor claridad'
      });
    }

    return issues;
  }

  _calculateReadability(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    if (sentences.length === 0) return 0;

    const avgLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
    const score = Math.max(0, Math.min(1, 1 - (Math.abs(avgLength - 15) / 30)));
    return parseFloat(score.toFixed(2));
  }
}

// ============================================================================
// SEO AGENT
// ============================================================================
class SEOAgent extends BaseAgent {
  constructor() {
    super('SEO');
  }

  async analyze(text, context = {}) {
    const recommendations = this._analyzeSEOElements(text, context);
    const balance = this._assessClarityBalance(text);

    return {
      agent: this.name,
      seoRecommendations: recommendations,
      clarityBalance: balance
    };
  }

  getCapabilities() {
    return ['keyword_optimization', 'meta_description_review', 'clarity_seo_balance', 'search_intent_preservation'];
  }

  _analyzeSEOElements(text, context = {}) {
    const recommendations = [];
    const metadata = context.metadata || {};

    // Check page title length
    if (metadata.title) {
      if (metadata.title.length > 60) {
        recommendations.push({
          type: 'seo',
          element: 'title',
          recommendation: `Título demasiado largo (${metadata.title.length} caracteres). Máximo recomendado: 60.`,
          reason: 'Los títulos largos se cortan en resultados de búsqueda'
        });
      }
    }

    // Check meta description
    if (!metadata.metaDescription) {
      recommendations.push({
        type: 'seo',
        element: 'meta_description',
        recommendation: 'Falta la meta descripción',
        reason: 'La meta descripción mejora la visibilidad en buscadores'
      });
    } else if (metadata.metaDescription.length > 160) {
      recommendations.push({
        type: 'seo',
        element: 'meta_description',
        recommendation: `Meta descripción demasiado larga (${metadata.metaDescription.length} caracteres). Máximo: 160.`,
        reason: 'Las descripciones largas se truncan en resultados'
      });
    }

    // Word frequency analysis
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const wordFreq = {};
    words.forEach(w => wordFreq[w] = (wordFreq[w] || 0) + 1);

    const repeatedWords = Object.entries(wordFreq)
      .filter(([_, freq]) => freq > 3)
      .map(([word, _]) => word);

    if (repeatedWords.length > 0) {
      recommendations.push({
        type: 'seo',
        element: 'keywords',
        recommendation: `Palabras clave frecuentes: ${repeatedWords.slice(0, 5).join(', ')}`,
        reason: 'Equilibrar densidad de palabras clave con variedad'
      });
    }

    return recommendations;
  }

  _assessClarityBalance(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    if (sentences.length === 0) return { seoScore: 0, clarityScore: 0, balanceScore: 0 };

    const avgLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
    const clarityScore = Math.max(0, 1 - (avgLength - 15) / 30);

    return {
      seoScore: 0.7,
      clarityScore: parseFloat(clarityScore.toFixed(2)),
      balanceScore: 0.65
    };
  }
}

// ============================================================================
// VALIDATOR AGENT
// ============================================================================
class ValidatorAgent extends BaseAgent {
  constructor() {
    super('Validator');
  }

  async analyze(text, context = {}) {
    const validation = this._validateImprovements(text);
    const qualityScore = this._calculateQualityScore(text);
    const compliance = this._checkCompliance(text);

    return {
      agent: this.name,
      validation,
      qualityScore,
      compliance
    };
  }

  getCapabilities() {
    return ['quality_assurance', 'compliance_verification', 'final_review', 'scoring'];
  }

  _validateImprovements(text) {
    const validations = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());

    sentences.forEach((sentence, idx) => {
      const words = sentence.trim().split(/\s+/).length;
      if (words > 30) {
        validations.push({
          status: 'warning',
          message: `Oración ${idx + 1} excede 30 palabras (${words})`,
          recommendation: 'Considerar dividir la oración'
        });
      } else if (words >= 15 && words <= 25) {
        validations.push({
          status: 'success',
          message: `Oración ${idx + 1} tiene longitud óptima (${words} palabras)`
        });
      }
    });

    return validations;
  }

  _calculateQualityScore(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    if (sentences.length === 0) return 0;

    let score = 0;
    sentences.forEach(sentence => {
      const words = sentence.trim().split(/\s+/).length;
      if (words >= 10 && words <= 30) {
        score += (words >= 15 && words <= 25) ? 1 : 0.7;
      } else {
        score += 0.3;
      }
    });

    return parseFloat((score / sentences.length).toFixed(2));
  }

  _checkCompliance(text) {
    const checks = [];

    checks.push({
      criterion: 'Oraciones completas',
      passed: text.split(/[.!?]+/).filter(s => s.trim()).length > 0
    });

    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    const avgLength = sentences.length > 0
      ? sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length
      : 0;

    checks.push({
      criterion: 'Longitud promedio adecuada',
      passed: avgLength <= 30
    });

    checks.push({
      criterion: 'Puntuación apropiada',
      passed: text.includes('.') || text.includes('!') || text.includes('?')
    });

    checks.push({
      criterion: 'Contenido no vacío',
      passed: text.trim().length > 0
    });

    return checks;
  }
}

// ============================================================================
// AGENT COORDINATOR
// ============================================================================
class AgentCoordinator {
  constructor() {
    this.analyzer = new AnalyzerAgent();
    this.rewriter = new RewriterAgent();
    this.grammar = new GrammarAgent();
    this.style = new StyleAgent();
    this.seo = new SEOAgent();
    this.validator = new ValidatorAgent();
  }

  async processText(text, options = {}) {
    const results = {
      originalText: text,
      analysis: null,
      rewriting: null,
      grammar: null,
      style: null,
      seo: null,
      validation: null,
      finalText: text,
      improvements: []
    };

    const context = {
      apiKey: options.apiKey,
      isWebPage: true,
      metadata: options.metadata || {}
    };

    const onProgress = options.onProgress || (() => {});

    // Step 1: Analyze
    onProgress('analyzer', 'Analizando texto...');
    results.analysis = await this.analyzer.analyze(text, context);

    // Step 2: Rewrite (API call)
    onProgress('rewriter', 'Reescribiendo con IA...');
    results.rewriting = await this.rewriter.analyze(text, context);
    let currentText = results.rewriting.rewrittenText || text;

    if (results.rewriting.improvements) {
      results.improvements.push(...results.rewriting.improvements);
    }

    // Step 3: Grammar
    onProgress('grammar', 'Revisando gramática...');
    results.grammar = await this.grammar.analyze(currentText, context);
    if (results.grammar.issues && results.grammar.issues.length > 0) {
      results.improvements.push(...results.grammar.issues);
    }

    // Step 4: Style
    onProgress('style', 'Analizando estilo...');
    results.style = await this.style.analyze(currentText, context);
    if (results.style.styleIssues && results.style.styleIssues.length > 0) {
      results.improvements.push(...results.style.styleIssues);
    }

    // Step 5: SEO (always run for web pages)
    onProgress('seo', 'Evaluando SEO...');
    results.seo = await this.seo.analyze(currentText, context);
    if (results.seo.seoRecommendations) {
      results.improvements.push(...results.seo.seoRecommendations);
    }

    // Step 6: Validate
    onProgress('validator', 'Validando resultados...');
    results.validation = await this.validator.analyze(currentText, context);
    results.finalText = currentText;

    onProgress('done', 'Análisis completado');

    return results;
  }

  getAvailableAgents() {
    return {
      analyzer: this.analyzer.getCapabilities(),
      rewriter: this.rewriter.getCapabilities(),
      grammar: this.grammar.getCapabilities(),
      style: this.style.getCapabilities(),
      seo: this.seo.getCapabilities(),
      validator: this.validator.getCapabilities()
    };
  }
}
