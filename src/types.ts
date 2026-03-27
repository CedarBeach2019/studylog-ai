// ─── Bindings (Cloudflare Worker env) ───────────────────────────────────────

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  ENVIRONMENT: string;
  THEME?: string;
  DOMAIN?: string;
  JWT_SECRET: string;
  DEEPSEEK_API_KEY: string;
  OPENAI_API_KEY?: string;
  RATE_LIMIT?: string;
}

// ─── Hono Variables ────────────────────────────────────────────────────────

export type Variables = {
  userId: string;
};

// ─── Database row types (match Drizzle schema) ─────────────────────────────

export interface Session {
  id: string;
  userId: string;
  summary: string;
  metadata: string;
  messageCount: number;
  lastMessageAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface PIIEntity {
  entityId: string;
  entityType: string;
  realValue: string;
  createdAt: string;
  lastUsed: string;
}

export interface Interaction {
  id: string;
  sessionId: string;
  userId: string;
  userInput: string;
  rewrittenInput: string | null;
  routeAction: string;
  routeReason: string | null;
  targetModel: string;
  response: string;
  escalationResponse: string | null;
  responseLatencyMs: number | null;
  escalationLatencyMs: number | null;
  feedback: string | null;
  critique: string | null;
  createdAt: string;
}

export interface FeedbackRating {
  rating: 'up' | 'down';
  critique?: string;
}

export interface RoutingRule {
  id: string;
  name: string;
  pattern: string;
  action: string;
  confidence: number;
  source: 'static' | 'learned';
  hitCount: number;
  createdAt: string;
}

export interface UserPreference {
  key: string;
  value: string;
  updatedAt: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  model: string;
  apiKeyEncrypted: string | null;
  temperature: number;
  maxTokens: number;
  capabilities: string[];
  enabled: boolean;
  createdAt: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  endpoint: string;
  capabilities: string[];
  status: 'online' | 'degraded' | 'offline';
  lastHeartbeat: string | null;
  userId: string;
  createdAt: string;
}

// ─── Routing types ─────────────────────────────────────────────────────────

export type RoutingAction = 'cheap' | 'escalation' | 'compare' | 'draft' | 'local' | 'manual' | 'summarize';

export interface Classification {
  action: RoutingAction;
  confidence: number;
  reason: string;
}

export interface RoutingConfig {
  defaultAction: RoutingAction;
  escalationThreshold: number;
  compareThreshold: number;
  localThreshold: number;
}

// ─── PII types ─────────────────────────────────────────────────────────────

export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'api_key'
  | 'person'
  | 'address'
  | 'date'
  | 'ip_address'
  | 'chinese_name'
  | 'russian_name';

export interface PIIMatch {
  type: PIIType;
  value: string;
  start: number;
  end: number;
  entityId: string;
}

export interface DehydrationResult {
  text: string;
  preamble: string;
  entities: PIIMatch[];
}

// ─── Provider types ────────────────────────────────────────────────────────

export type ProviderMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export interface ProviderResponse {
  content: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
  latencyMs: number;
}

export interface DraftProfile {
  id: string;
  name: string;
  providerId: string;
  model: string;
  temperature: number;
  systemPrompt?: string;
}

// ─── Chat request/response (OpenAI-compatible) ─────────────────────────────

export interface ChatRequest {
  model?: string;
  messages: ProviderMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  _meta?: {
    route: string;
    cached: boolean;
    interactionId: string;
    classification: Classification;
  };
}

// ─── Health check ──────────────────────────────────────────────────────────

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: Record<string, { status: 'ok' | 'error'; message?: string; latencyMs?: number }>;
}
