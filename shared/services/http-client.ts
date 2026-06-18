import { bullfyEnv } from "@/shared/config";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean | null | undefined>;

export type HttpRequestOptions = {
  method?: HttpMethod;
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  timeoutMs?: number;
  cache?: RequestCache;
  credentials?: RequestCredentials;
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
};

export type HttpClientOptions = {
  baseUrl?: string;
  defaultHeaders?: HeadersInit;
  timeoutMs?: number;
  getAuthToken?: () => Promise<string | null | undefined> | string | null | undefined;
  fetcher?: typeof fetch;
};

export class HttpError extends Error {
  readonly body: unknown;
  readonly method: HttpMethod;
  readonly status: number;
  readonly statusText: string;
  readonly url: string;

  constructor(params: {
    body: unknown;
    method: HttpMethod;
    status: number;
    statusText: string;
    url: string;
  }) {
    super(
      `HTTP ${params.status} ${params.statusText} for ${params.method} ${params.url}`,
    );
    this.name = "HttpError";
    this.body = params.body;
    this.method = params.method;
    this.status = params.status;
    this.statusText = params.statusText;
    this.url = params.url;
  }
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: HeadersInit;
  private readonly fetcher: typeof fetch;
  private readonly getAuthToken?: HttpClientOptions["getAuthToken"];
  private readonly timeoutMs: number;

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? bullfyEnv.apiBaseUrl;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.fetcher = options.fetcher ?? fetch;
    this.getAuthToken = options.getAuthToken;
    this.timeoutMs = options.timeoutMs ?? bullfyEnv.requestTimeoutMs;
  }

  get<T>(path: string, options: Omit<HttpRequestOptions, "method" | "body"> = {}) {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T>(
    path: string,
    body?: unknown,
    options: Omit<HttpRequestOptions, "method" | "body"> = {},
  ) {
    return this.request<T>(path, { ...options, body, method: "POST" });
  }

  put<T>(
    path: string,
    body?: unknown,
    options: Omit<HttpRequestOptions, "method" | "body"> = {},
  ) {
    return this.request<T>(path, { ...options, body, method: "PUT" });
  }

  patch<T>(
    path: string,
    body?: unknown,
    options: Omit<HttpRequestOptions, "method" | "body"> = {},
  ) {
    return this.request<T>(path, { ...options, body, method: "PATCH" });
  }

  delete<T>(
    path: string,
    options: Omit<HttpRequestOptions, "method" | "body"> = {},
  ) {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }

  async request<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    const method = options.method ?? "GET";
    const url = this.buildUrl(path, options.query);
    const headers = new Headers(this.defaultHeaders);

    mergeHeaders(headers, options.headers);

    const token = await this.getAuthToken?.();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const init: RequestInit & HttpRequestOptions = {
      cache: options.cache,
      credentials: options.credentials,
      headers,
      method,
      next: options.next,
    };

    if (options.body !== undefined) {
      init.body = serializeBody(options.body, headers);
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? this.timeoutMs,
    );
    const removeAbortListener = linkAbortSignals(options.signal, controller);

    init.signal = controller.signal;

    try {
      const response = await this.fetcher(url, init);
      const body = await parseResponseBody(response);

      if (!response.ok) {
        throw new HttpError({
          body,
          method,
          status: response.status,
          statusText: response.statusText,
          url,
        });
      }

      return body as T;
    } finally {
      clearTimeout(timeout);
      removeAbortListener();
    }
  }

  private buildUrl(path: string, query?: Record<string, QueryValue>): string {
    const url = path.startsWith("http")
      ? new URL(path)
      : new URL(path, normalizeBaseUrl(this.baseUrl));

    appendQueryParams(url, query);

    return url.toString();
  }
}

export const httpClient = new HttpClient();

function normalizeBaseUrl(baseUrl: string): string {
  if (baseUrl) {
    return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  }

  return "http://localhost/";
}

function appendQueryParams(url: URL, query?: Record<string, QueryValue>) {
  if (!query) {
    return;
  }

  for (const [key, value] of Object.entries(query)) {
    const values = Array.isArray(value) ? value : [value];

    for (const item of values) {
      if (item !== null && item !== undefined) {
        url.searchParams.append(key, String(item));
      }
    }
  }
}

function linkAbortSignals(
  signal: AbortSignal | undefined,
  controller: AbortController,
) {
  if (!signal) {
    return () => undefined;
  }

  if (signal.aborted) {
    controller.abort();
    return () => undefined;
  }

  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });

  return () => signal.removeEventListener("abort", abort);
}

function mergeHeaders(headers: Headers, nextHeaders?: HeadersInit) {
  if (!nextHeaders) {
    return;
  }

  new Headers(nextHeaders).forEach((value, key) => {
    headers.set(key, value);
  });
}

function serializeBody(body: unknown, headers: Headers): BodyInit {
  if (
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof URLSearchParams ||
    typeof body === "string"
  ) {
    return body;
  }

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return JSON.stringify(body);
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}
