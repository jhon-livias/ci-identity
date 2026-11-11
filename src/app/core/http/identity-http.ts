import { Injectable, inject } from '@angular/core';

import { IdentityAuthService } from '../auth/identity-auth.service';

@Injectable({ providedIn: 'root' })
export class IdentityHttp {
  private readonly auth = inject(IdentityAuthService);

  async get<T>(url: string): Promise<T> {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error(await errorMessage(response));
    return await response.json() as T;
  }

  async send(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, body?: unknown): Promise<void> {
    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers: { ...this.auth.csrfHeaders(), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await errorMessage(response));
  }

  async sendJson<T>(method: 'POST' | 'PATCH', url: string, body?: unknown): Promise<T> {
    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers: { ...this.auth.csrfHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    if (!response.ok) throw new Error(await errorMessage(response));
    return await response.json() as T;
  }
}

const errorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json() as { message?: unknown };
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;
    if (Array.isArray(payload.message)) return payload.message.filter((item) => typeof item === 'string').join(' ');
  } catch { /* el cuerpo no es JSON */ }
  return 'No se pudo completar la operación.';
};
