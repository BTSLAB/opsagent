export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    family?: string;
    parameter_size?: string;
  };
  remote_model?: string;
  remote_host?: string;
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

export const OLLAMA_CURATED_MODELS = [
  { value: "deepseek-r1:8b", label: "DeepSeek R1 8B", hint: "reasoning, 8B params" },
  { value: "deepseek-r1:14b", label: "DeepSeek R1 14B", hint: "reasoning, 14B params" },
  { value: "deepseek-r1:1.5b", label: "DeepSeek R1 1.5B", hint: "reasoning, lightweight" },
  { value: "llama3.3:latest", label: "Llama 3.3", hint: "general purpose" },
  { value: "qwen2.5-coder:7b", label: "Qwen 2.5 Coder 7B", hint: "code-focused" },
  { value: "qwen2.5-coder:14b", label: "Qwen 2.5 Coder 14B", hint: "code-focused, larger" },
  { value: "codellama:latest", label: "Code Llama", hint: "code generation" },
  { value: "mistral:latest", label: "Mistral", hint: "general purpose" },
];

/**
 * Strip /v1 suffix to get the native Ollama API base URL.
 */
export function deriveOllamaApiBase(chatUrl: string): string {
  return chatUrl.replace(/\/v1\/?$/, "");
}

/**
 * Fetch already-pulled models from a running Ollama instance.
 * Returns null if the server is unreachable.
 */
export async function fetchOllamaModels(apiBase: string): Promise<OllamaModel[] | null> {
  try {
    const response = await fetch(`${apiBase}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as OllamaTagsResponse;
    // Filter out cloud/remote models — they require external API keys
    return (data.models ?? []).filter((m) => !m.remote_host && !m.remote_model);
  } catch {
    return null;
  }
}

/**
 * Pull a model from the Ollama registry via POST /api/pull.
 * Streams NDJSON progress and invokes onProgress callback.
 */
export async function pullOllamaModel(
  apiBase: string,
  modelName: string,
  onProgress?: (status: string) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(`${apiBase}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName }),
      signal: AbortSignal.timeout(600_000),
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const reader = response.body?.getReader();
    if (!reader) return { ok: false, error: "No response body" };

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const progress = JSON.parse(line) as {
            status?: string;
            completed?: number;
            total?: number;
            error?: string;
          };
          if (progress.error) {
            return { ok: false, error: progress.error };
          }
          if (onProgress && progress.status) {
            if (progress.completed && progress.total) {
              const pct = Math.round((progress.completed / progress.total) * 100);
              onProgress(`${progress.status} (${pct}%)`);
            } else {
              onProgress(progress.status);
            }
          }
        } catch {
          // skip malformed lines
        }
      }
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}
