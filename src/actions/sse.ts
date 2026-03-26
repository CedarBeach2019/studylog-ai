import type {
  Action,
  SSEEvent,
  SSEEventType,
  SSEActionStartData,
  SSEActionDeltaData,
  SSEActionCompleteData,
  SSEActionErrorData,
  SSESessionMeta,
  SSESessionEnd,
  JsonPatch,
} from './types.js';

let idSeq = 0;
function genId(): string {
  return `act_${Date.now().toString(36)}_${(idSeq++).toString(36)}`;
}

// ─── Encoding ─────────────────────────────────────────────────────────────

export function encodeActionStart(action: Action): string {
  const data: SSEActionStartData = {
    id: action.meta?.id ?? genId(),
    type: action.type,
    payload: action.payload as Record<string, unknown>,
  };
  return encodeSSE('action_start', data);
}

export function encodeActionDelta(actionId: string, patch: JsonPatch): string {
  const data: SSEActionDeltaData = {
    id: actionId,
    path: patch.path,
    value: patch.value,
  };
  return encodeSSE('action_delta', data);
}

export function encodeActionComplete(actionId: string): string {
  const data: SSEActionCompleteData = { id: actionId };
  return encodeSSE('action_complete', data);
}

export function encodeActionError(actionId: string, error: Error): string {
  const data: SSEActionErrorData = {
    id: actionId,
    error: error.message,
    recovery: 'skip',
  };
  return encodeSSE('action_error', data);
}

export function encodeSessionMeta(meta: SSESessionMeta): string {
  return encodeSSE('session_meta', meta);
}

export function encodeSessionEnd(end: SSESessionEnd): string {
  return encodeSSE('session_end', end);
}

function encodeSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ─── Decoding ─────────────────────────────────────────────────────────────

export function decodeSSEEvent(raw: string): SSEEvent | null {
  const lines = raw.split('\n');
  let eventType: string | null = null;
  let dataStr = '';

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      dataStr = line.slice(6);
    }
  }

  if (!eventType || !dataStr) return null;

  // Parse multiple data lines (concatenate with newline)
  // For now, single data line is sufficient for our protocol
  const validTypes: SSEEventType[] = [
    'action_start', 'action_delta', 'action_complete', 'action_error',
    'session_meta', 'session_end',
  ];

  if (!validTypes.includes(eventType as SSEEventType)) return null;

  try {
    const data = JSON.parse(dataStr);
    return { type: eventType as SSEEventType, data };
  } catch {
    return null;
  }
}

/**
 * Parse an SSE text stream into individual SSEEvent objects.
 * Handles multi-line data fields and event/data ordering.
 */
export function parseSSEStream(text: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const blocks = text.split('\n\n');

  for (const block of blocks) {
    if (!block.trim()) continue;
    const event = decodeSSEEvent(block);
    if (event) events.push(event);
  }

  return events;
}

// ─── Create Action Stream (for Workers Response) ──────────────────────────

/**
 * Creates a ReadableStream that emits SSE-formatted actions.
 * Compatible with Cloudflare Workers streaming Response.
 */
export function createActionStream(
  actions: AsyncIterable<Action> | Iterable<Action>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const isAsync = Symbol.asyncIterator in actions;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (isAsync) {
          for await (const action of actions as AsyncIterable<Action>) {
            controller.enqueue(encoder.encode(encodeActionStart(action)));
            controller.enqueue(encoder.encode(encodeActionComplete(action.meta?.id ?? genId())));
          }
        } else {
          for (const action of actions as Iterable<Action>) {
            controller.enqueue(encoder.encode(encodeActionStart(action)));
            controller.enqueue(encoder.encode(encodeActionComplete(action.meta?.id ?? genId())));
          }
        }
        controller.enqueue(encoder.encode(encodeSessionEnd({ done: true })));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

/**
 * Convenience: wrap actions in a streaming Response suitable for Cloudflare Workers.
 */
export function createActionResponse(
  actions: AsyncIterable<Action> | Iterable<Action>,
  sessionMeta?: SSESessionMeta
): Response {
  const encoder = new TextEncoder();
  const isAsync = Symbol.asyncIterator in actions;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (sessionMeta) {
          controller.enqueue(encoder.encode(encodeSessionMeta(sessionMeta)));
        }
        if (isAsync) {
          for await (const action of actions as AsyncIterable<Action>) {
            controller.enqueue(encoder.encode(encodeActionStart(action)));
            controller.enqueue(encoder.encode(encodeActionComplete(action.meta?.id ?? genId())));
          }
        } else {
          for (const action of actions as Iterable<Action>) {
            controller.enqueue(encoder.encode(encodeActionStart(action)));
            controller.enqueue(encoder.encode(encodeActionComplete(action.meta?.id ?? genId())));
          }
        }
        controller.enqueue(encoder.encode(encodeSessionEnd({ done: true })));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
