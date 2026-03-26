/**
 * Usage metrics endpoint.
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../../src/types.js';

const metricsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

metricsRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const stats = await c.env.DB.prepare(
    `SELECT COUNT(*) as request_count, SUM(response_latency_ms) as total_latency, route_action, target_model
     FROM interactions WHERE user_id = ? GROUP BY route_action, target_model`,
  ).bind(userId).all<{ request_count: number; total_latency: number | null; route_action: string; target_model: string }>();

  const rows = stats.results ?? [];
  let totalRequests = 0;
  const byProvider: Record<string, { requests: number; avgLatencyMs: number }> = {};
  const byModel: Record<string, number> = {};

  for (const row of rows) {
    totalRequests += row.request_count;
    byModel[row.target_model] = (byModel[row.target_model] ?? 0) + row.request_count;
    if (!byProvider[row.route_action]) byProvider[row.route_action] = { requests: 0, avgLatencyMs: 0 };
    const p = byProvider[row.route_action];
    p.requests += row.request_count;
    p.avgLatencyMs = row.total_latency ? Math.round(row.total_latency / row.request_count) : 0;
  }

  return c.json({ totalRequests, totalCost: 0, byProvider, byModel });
});

export default metricsRoutes;
