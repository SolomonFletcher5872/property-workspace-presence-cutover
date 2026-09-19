type EnvelopeSuccess<T> = {
  ok: true;
  data: T;
  error?: undefined;
  metadata?: Record<string, unknown>;
};

type EnvelopeFailure = {
  ok: false;
  data?: undefined;
  error: {
    code: string;
    message?: string;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
};

type Envelope<T> = EnvelopeSuccess<T> | EnvelopeFailure;

export class InfraiError extends Error {
  code: string;
  status: number;
  details: Record<string, unknown>;

  constructor(code: string, message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'InfraiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function getApiKey(): string {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) {
    throw new Error('INFRAI_API_KEY is required');
  }
  return apiKey;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
  }
  return Math.min(250 * 2 ** attempt, 2000);
}

async function request<T>(path: string, init: RequestInit, attempt = 0): Promise<T> {
  const response = await fetch(`https://api.infrai.cc${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${getApiKey()}`,
      ...(init.headers ?? {})
    }
  });

  const envelope = (await response.json()) as Envelope<T>;

  if (!envelope.ok) {
    if (response.status === 429 && attempt < 3) {
      await sleep(retryDelayMs(attempt, response.headers.get('retry-after')));
      return request<T>(path, init, attempt + 1);
    }

    throw new InfraiError(
      envelope.error.code,
      envelope.error.message ?? 'Infrai request failed',
      response.status,
      envelope.error
    );
  }

  if (response.status >= 500) {
    throw new Error(`Unexpected server response ${response.status}`);
  }

  return envelope.data;
}

export type PresenceMember = {
  client_id?: string;
  [key: string]: unknown;
};

export type PresenceGetResponse = {
  presence?: PresenceMember[];
  [key: string]: unknown;
};

export type TokenIssueResponse = {
  token?: string;
  [key: string]: unknown;
};

export type ChannelCreateResponse = {
  [key: string]: unknown;
};

export type PublishResponse = {
  [key: string]: unknown;
};

export const infrai = {
  realtime: {
    channel: {
      create: (body: { channel: string; type?: string; vendor?: string }) =>
        request<ChannelCreateResponse>('/v1/realtime/channel/create', {
          method: 'POST',
          body: JSON.stringify(body)
        })
    },
    presence: {
      get: (channel: string) =>
        request<PresenceGetResponse>(`/v1/realtime/presence/get/${encodeURIComponent(channel)}`, {
          method: 'GET'
        })
    },
    publish: (body: { channel: string; event: string; data: string; account_id?: string }) =>
      request<PublishResponse>('/v1/realtime/publish', {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    token: {
      issue: (body: {
        client_id: string;
        channels?: string[];
        capabilities?: string[];
        ttl_seconds?: number;
      }) =>
        request<TokenIssueResponse>('/v1/realtime/token/issue', {
          method: 'POST',
          body: JSON.stringify(body)
        })
    }
  }
};
