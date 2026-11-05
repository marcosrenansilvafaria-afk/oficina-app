export const OS_BASE_URL =
  process.env.OS_SERVICE_URL ?? 'http://localhost:3001';
export const BILLING_BASE_URL =
  process.env.BILLING_SERVICE_URL ?? 'http://localhost:3002';
export const EXECUTION_BASE_URL =
  process.env.EXECUTION_SERVICE_URL ?? 'http://localhost:3003';

interface HttpResponse<T> {
  status: number;
  body: T;
}

async function request<T = unknown>(
  baseUrl: string,
  method: 'GET' | 'POST',
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<HttpResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const body = (text ? JSON.parse(text) : {}) as T;
  return { status: res.status, body };
}

export const get = <T = unknown>(
  baseUrl: string,
  path: string,
  token?: string,
) => request<T>(baseUrl, 'GET', path, { token });

export const post = <T = unknown>(
  baseUrl: string,
  path: string,
  body?: unknown,
  token?: string,
) => request<T>(baseUrl, 'POST', path, { token, body });

/**
 * Credenciais seed identicas nos 3 microsservicos (ver auth.service.ts de
 * cada um) - cada servico emite/valida seu proprio JWT, nao ha SSO entre
 * eles.
 */
export async function login(
  baseUrl: string,
  email: string,
  senha: string,
): Promise<string> {
  const res = await post<{ access_token: string }>(baseUrl, '/auth/login', {
    email,
    senha,
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Login falhou em ${baseUrl} (status ${res.status})`);
  }
  return res.body.access_token;
}

export const ATENDENTE = {
  email: 'atendente@oficina.com',
  senha: 'atendente123',
};
export const MECANICO = { email: 'mecanico@oficina.com', senha: 'mecanico123' };
