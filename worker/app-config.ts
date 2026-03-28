/**
 * StudyLog.ai custom configuration loader.
 * Loads personality, rules, theme, and templates from KV.
 */
import type { Env } from '../../src/types';

export interface AppConfig {
  personality: string;
  rules: any;
  theme: string;
  templates: Record<string, string>;
}

/**
 * Load StudyLog.ai custom configuration from KV.
 */
export async function loadAppConfig(env: Env): Promise<AppConfig> {
  try {
    const [personality, rulesRaw, theme] = await Promise.all([
      env.KV.get('config:personality') || '',
      env.KV.get('config:rules') || '[]',
      env.KV.get('config:theme') || '',
    ]);

    let rules: any[] = [];
    try {
      rules = JSON.parse(rulesRaw);
    } catch (e) {
      console.error('Failed to parse rules JSON:', e);
    }

    // Load templates
    const templateKeys = [
      'template:study_plan', 'template:assignment', 'template:concept',
      'template:flashcard', 'template:quiz', 'template:summary',
      'template:explanation', 'template:research',
    ];
    const templates: Record<string, string> = {};
    const templateResults = await Promise.all(templateKeys.map(k => env.KV.get(k)));
    for (let i = 0; i < templateKeys.length; i++) {
      const key = templateKeys[i].replace('template:', '');
      if (templateResults[i]) templates[key] = templateResults[i]!;
    }

    return { personality, rules, theme, templates };
  } catch (error) {
    console.error('Failed to load StudyLog config from KV:', error);
    return getDefaultConfig();
  }
}

/**
 * Get the default system prompt for StudyLog.ai.
 */
export async function getSystemPrompt(env: Env): Promise<string> {
  const config = await loadAppConfig(env);
  return config.personality || getDefaultConfig().personality;
}

/**
 * Get routing rules for StudyLog.ai commands.
 */
export async function getRoutingRules(env: Env): Promise<any[]> {
  const config = await loadAppConfig(env);
  return config.rules;
}

/**
 * Get theme CSS for StudyLog.ai.
 */
export async function getThemeCSS(env: Env): Promise<string> {
  const config = await loadAppConfig(env);
  return config.theme;
}

/**
 * Get template by key.
 */
export async function getTemplate(key: string, env: Env): Promise<string | null> {
  const val = await env.KV.get(`template:${key}`);
  return val;
}

/**
 * Default fallback configuration.
 */
function getDefaultConfig(): AppConfig {
  return {
    personality: `# StudyLog.ai System Prompt

You are StudyLog.ai — an intelligent study companion and educational assistant.
Help with learning planning, concept explanation, assignment guidance, flashcard creation, and knowledge retention.
Be encouraging but thorough, pedagogically sound but flexible. Remember learning context via the LOG.`,
    rules: [],
    theme: `/* StudyLog.ai Theme - Fallback */
body.study-theme {
  background-color: #f8f9fa;
  color: #212529;
  font-family: 'Inter', system-ui, sans-serif;
}`,
    templates: {}
  };
}
