// repo-agent.ts — Repo-agent hook system

export interface RepoAgentAction {
  type: 'fork' | 'theme' | 'component' | 'build' | 'ship';
  target?: string;
  params: Record<string, unknown>;
  timestamp: number;
}

export interface RepoAgentHook {
  type: RepoAgentAction['type'];
  handler: (action: RepoAgentAction) => Promise<unknown>;
}

export class RepoAgent {
  private hooks: Map<string, RepoAgentHook[]> = new Map();
  private history: RepoAgentAction[] = [];
  private maxSize: number;

  constructor(maxHistory = 100) {
    this.maxSize = maxHistory;
  }

  registerHook(type: RepoAgentAction['type'], handler: RepoAgentHook['handler']): void {
    const existing = this.hooks.get(type) || [];
    existing.push({ type, handler });
    this.hooks.set(type, existing);
  }

  async invoke(action: Omit<RepoAgentAction, 'timestamp'>): Promise<unknown> {
    const full: RepoAgentAction = { ...action, timestamp: Date.now() };
    this.history.push(full);
    if (this.history.length > this.maxSize) this.history.shift();

    const hooks = this.hooks.get(action.type) || [];
    const results = await Promise.all(hooks.map(h => h.handler(full)));
    return results.length === 1 ? results[0] : results;
  }

  getCapabilities(): string[] {
    return Array.from(new Set(Array.from(this.hooks.values()).flatMap(hooks => hooks.map(h => h.type))));
  }

  getHistory(limit?: number): RepoAgentAction[] {
    return limit ? this.history.slice(-limit) : [...this.history];
  }
}
