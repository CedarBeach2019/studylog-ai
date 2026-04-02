// cross-cocapn.ts — Cross-platform topic linking

export interface CocapnLink {
  platform: string;
  repo: string;
  file?: string;
  type: 'code' | 'doc' | 'lesson' | 'quiz' | 'flashcard';
  timestamp: number;
}

export interface TopicLink {
  topic: string;
  links: CocapnLink[];
  lastUpdated: number;
}

const COCAPN_KV = 'COCAPN_LINKS';

function storage(): KVNamespace {
  // @ts-ignore
  return (globalThis as any).PROFILES_KV;
}

export class CrossCocapn {
  async addLink(topic: string, link: Omit<CocapnLink, 'timestamp'>): Promise<TopicLink> {
    const kv = storage();
    const key = `${COCAPN_KV}:${topic.toLowerCase()}`;
    const existing = await this.getTopic(topic);
    const fullLink: CocapnLink = { ...link, timestamp: Date.now() };
    const topicLink: TopicLink = {
      topic: topic.toLowerCase(),
      links: existing ? [...existing.links, fullLink] : [fullLink],
      lastUpdated: Date.now(),
    };
    await kv.put(key, JSON.stringify(topicLink));
    return topicLink;
  }

  async getLinks(topic: string): Promise<CocapnLink[]> {
    const t = await this.getTopic(topic);
    return t?.links || [];
  }

  async getTopic(topic: string): Promise<TopicLink | null> {
    const kv = storage();
    const raw = await kv.get(`${COCAPN_KV}:${topic.toLowerCase()}`);
    return raw ? JSON.parse(raw) : null;
  }

  async getTopicGraph(): Promise<TopicLink[]> {
    const kv = storage();
    const list = await kv.list({ prefix: COCAPN_KV });
    const topics: TopicLink[] = [];
    for (const key of list.keys) {
      const raw = await kv.get(key.name);
      if (raw) topics.push(JSON.parse(raw));
    }
    return topics;
  }

  async searchTopics(query: string): Promise<TopicLink[]> {
    const all = await this.getTopicGraph();
    const q = query.toLowerCase();
    return all.filter(t => t.topic.includes(q) || t.links.some(l => l.repo.toLowerCase().includes(q)));
  }
}
