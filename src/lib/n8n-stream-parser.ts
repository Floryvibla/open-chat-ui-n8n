interface StreamEvent {
  type: string;
  content?: string;
}

const STREAM_EVENT_TYPES = new Set(["begin", "end", "item"]);

export function extractItemContents(streamText: string | undefined | null): string {
  if (!streamText) return "";
  const events = splitJsonStream(streamText);
  return events
    .map((raw) => safeParse<StreamEvent>(raw))
    .filter((e): e is StreamEvent => e !== null && e.type === "item")
    .map((e) => e.content ?? "")
    .join("");
}

export function hasStreamEvents(streamText: string | undefined | null): boolean {
  if (!streamText) return false;
  const events = splitJsonStream(streamText);
  return events.some((raw) => {
    const parsed = safeParse<StreamEvent>(raw);
    return parsed && STREAM_EVENT_TYPES.has(parsed.type);
  });
}

function splitJsonStream(text: string): string[] {
  const chunks: string[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0 && start !== -1) {
        chunks.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  if (start !== -1 && depth > 0) {
    const partial = text.slice(start);
    if (partial.trim().length > 0) chunks.push(partial);
  }
  return chunks;
}

function safeParse<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
