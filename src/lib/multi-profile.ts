// multi-profile.ts — Student profiles with per-provider API keys and per-role model routing

export interface ProviderConfig {
  key: string;
  baseURL?: string;
  defaultModel: string;
}

export interface ModelRouting {
  teacher?: string;
  codegen?: string;
  quiz?: string;
  classmate?: string;
  tutor?: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  role: 'student' | 'teacher' | 'observer';
  providers: Record<string, ProviderConfig>;
  modelRouting: ModelRouting;
  interests: string[];
  learningStyle: 'visual' | 'auditory' | 'reading' | 'kinesthetic' | 'mixed';
  knowledgeGraph: Record<string, number>; // topic → mastery 0-1
  createdAt: number;
}

const PROFILE_KV = 'STUDYLOG_PROFILES';

function storage(): KVNamespace {
  // @ts-ignore Cloudflare Workers KV binding
  return (globalThis as any).PROFILES_KV;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export async function createProfile(data: Omit<StudentProfile, 'id' | 'createdAt' | 'knowledgeGraph'>): Promise<StudentProfile> {
  const profile: StudentProfile = {
    ...data,
    id: generateId(),
    knowledgeGraph: {},
    createdAt: Date.now(),
  };
  const kv = storage();
  await kv.put(`${PROFILE_KV}:${profile.id}`, serialize(profile));
  return profile;
}

export async function getProfile(id: string): Promise<StudentProfile | null> {
  const kv = storage();
  const raw = await kv.get(`${PROFILE_KV}:${id}`);
  return raw ? deserialize(raw) : null;
}

export async function updateProfile(id: string, patch: Partial<StudentProfile>): Promise<StudentProfile | null> {
  const existing = await getProfile(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch, id, createdAt: existing.createdAt };
  const kv = storage();
  await kv.put(`${PROFILE_KV}:${id}`, serialize(updated));
  return updated;
}

export async function listProfiles(): Promise<StudentProfile[]> {
  const kv = storage();
  const list = await kv.list({ prefix: PROFILE_KV });
  const profiles: StudentProfile[] = [];
  for (const key of list.keys) {
    const raw = await kv.get(key.name);
    if (raw) profiles.push(deserialize(raw));
  }
  return profiles.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteProfile(id: string): Promise<boolean> {
  const kv = storage();
  const existing = await getProfile(id);
  if (!existing) return false;
  await kv.delete(`${PROFILE_KV}:${id}`);
  return true;
}

export function getModelForRole(profile: StudentProfile, role: keyof ModelRouting): string | undefined {
  return profile.modelRouting[role];
}

export function serialize(p: StudentProfile): string {
  return JSON.stringify(p);
}

export function deserialize(raw: string): StudentProfile {
  return JSON.parse(raw);
}
