export const USER_AGENT = 'PolicyRateAtlas/2.0 (+https://github.com/ashwingopalsamy/repo-rate-visualizer)';

export type Fetched = { body: string; url: string; status: number; contentType: string; fetchedAt: string };

export class HttpStatusError extends Error {
  readonly status: number;
  constructor(url: string, status: number) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}

const retryable = (error: unknown) => !(error instanceof HttpStatusError) || error.status >= 500;

/** Fetch a text resource with the pipeline's identifying user-agent. Retries network errors and 5xx responses only. */
export async function fetchText(
  url: string,
  { timeoutMs = 20_000, retries = 2, fetchImpl = globalThis.fetch }: { timeoutMs?: number; retries?: number; fetchImpl?: typeof fetch } = {},
): Promise<Fetched> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchImpl(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,text/csv,application/json;q=0.9,*/*;q=0.8' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
      if (!response.ok) throw new HttpStatusError(url, response.status);
      return {
        body: await response.text(),
        url: response.url || url,
        status: response.status,
        contentType: response.headers.get('content-type') ?? '',
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      lastError = error;
      if (!retryable(error) || attempt === retries) break;
      await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }
  throw lastError;
}
