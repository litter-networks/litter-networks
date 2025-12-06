// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

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

/**
 * Perform an HTTP request against the configured API base URL and return the parsed JSON response.
 *
 * @param path - Path appended to the configured API base URL (should begin with `/` when appropriate)
 * @param parseJson - If `false`, the function does not parse the response body and returns `undefined`; defaults to `true`
 * @returns The response body parsed as JSON and typed as `TResponse`, or `undefined` when `parseJson` is `false`
 * @throws HttpError when the response has a non-OK status; the error includes the HTTP status and the parsed error body (JSON or text)
 */
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
