/**
 * StudyLog.ai custom assets and configuration endpoints.
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../../src/types.js';
import { getThemeCSS, getRoutingRules, getTemplate } from '../app-config.js';

const appRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Serve theme CSS
appRoutes.get('/theme.css', async (c) => {
  const theme = await getThemeCSS(c.env);
  if (!theme) {
    return c.json({ error: 'Theme not found' }, 404);
  }
  return c.text(theme, 200, { 'Content-Type': 'text/css' });
});

// Get routing rules
appRoutes.get('/rules', async (c) => {
  const rules = await getRoutingRules(c.env);
  return c.json({ rules });
});

// Get template by key
appRoutes.get('/templates/:key', async (c) => {
  const key = c.req.param('key');
  const template = await getTemplate(key, c.env);
  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }
  return c.text(template, 200, { 'Content-Type': 'text/markdown' });
});

// List available templates
appRoutes.get('/templates', async (c) => {
  const templates = [
    { key: 'study_plan', name: 'Study Plan', icon: '📚', description: 'Create personalized study plans with goals and milestones' },
    { key: 'assignment', name: 'Assignment Help', icon: '✍️', description: 'Get guidance on assignments with step-by-step breakdown' },
    { key: 'concept', name: 'Concept Explanation', icon: '💡', description: 'Deep dive into concepts with clear explanations and examples' },
    { key: 'flashcard', name: 'Flashcard Generator', icon: '🗂️', description: 'Create flashcards for memorization and active recall' },
    { key: 'quiz', name: 'Quiz Generator', icon: '❓', description: 'Generate practice quizzes to test knowledge retention' },
    { key: 'summary', name: 'Summary', icon: '📝', description: 'Summarize notes, readings, or lectures concisely' },
    { key: 'explanation', name: 'Step-by-Step', icon: '🔢', description: 'Break down complex problems into clear steps' },
    { key: 'research', name: 'Research Assistant', icon: '🔍', description: 'Help find and organize research materials and citations' },
  ];
  return c.json({ templates });
});

export default appRoutes;
