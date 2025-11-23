import { appEnv } from '@/config/env';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions extends RequestInit {
  method?: HttpMethod;
  path: string;
  parseJson?: boolean;
}

export class HttpError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

const jsonHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

export async function apiRequest<TResponse>({
  path,
  method = 'GET',
  parseJson = true,
  headers,
  body,
  ...rest
}: ApiRequestOptions): Promise<TResponse> {
  const response = await fetch(`${appEnv.apiBaseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...jsonHeaders,
      ...headers,
    },
    body,
    ...rest,
  });

  if (!response.ok) {
    let errorBody: unknown = null;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    throw new HttpError('API request failed', response.status, errorBody);
  }

  if (!parseJson) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}
