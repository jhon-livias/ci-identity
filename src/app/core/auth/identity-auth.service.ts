import { Injectable, signal } from '@angular/core';

export interface IdentityUser {
  readonly id: string;
  readonly username: string;
  readonly displayName: string | null;
}

interface LoginResponse {
  readonly csrfToken: string;
  readonly user: { readonly id: string; readonly username: string; readonly profile: { readonly firstName: string; readonly paternalLastName: string } | null };
}

// La consola de identidad usa el Gateway bajo su mismo origen, sin exponer
// cookies de sesión ni requerir peticiones CORS entre aplicaciones.
const authBaseUrl = '/api/v1/auth';

@Injectable({ providedIn: 'root' })
export class IdentityAuthService {
  readonly user = signal<IdentityUser | null>(null);
  private csrfToken: string | null = null;

  async login(username: string, password: string, recaptchaToken: string): Promise<void> {
    const response = await fetch(`${authBaseUrl}/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, recaptchaToken }),
    });
    if (!response.ok) throw new Error('No pudimos iniciar sesión. Verifica tus credenciales e inténtalo nuevamente.');
    const session = toSession(await response.json() as unknown);
    this.csrfToken = session.csrfToken;
    this.user.set(session.user);
  }

  async restore(): Promise<boolean> {
    const current = await this.session();
    if (current) {
      this.csrfToken = current.csrfToken;
      this.user.set(current.user);
      return true;
    }

    const refreshed = await fetch(`${authBaseUrl}/refresh`, { method: 'POST', credentials: 'include' });
    if (!refreshed.ok || refreshed.status === 204) return false;
    const session = toSession(await refreshed.json() as unknown);
    this.csrfToken = session.csrfToken;
    this.user.set(session.user);
    return true;
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${authBaseUrl}/logout`, { method: 'POST', credentials: 'include', headers: this.csrfToken ? { 'X-CSRF-Token': this.csrfToken } : {} });
    } finally { this.csrfToken = null; this.user.set(null); }
  }

  private async session(): Promise<{ readonly csrfToken: string; readonly user: IdentityUser } | null> {
    const response = await fetch(`${authBaseUrl}/session`, { credentials: 'include' });
    if (!response.ok || response.status === 204) return null;
    return toSession(await response.json() as unknown);
  }
}

const toSession = (value: unknown): { readonly csrfToken: string; readonly user: IdentityUser } => {
  if (!value || typeof value !== 'object') throw new Error('Respuesta de autenticación inválida.');
  const user = (value as Record<string, unknown>)['user'];
  if (!user || typeof user !== 'object') throw new Error('Respuesta de autenticación inválida.');
  const candidate = user as Record<string, unknown>;
  if (typeof candidate['id'] !== 'string' || typeof candidate['username'] !== 'string') {
    throw new Error('Respuesta de autenticación inválida.');
  }
  const profile = candidate['profile'];
  const displayName = profile && typeof profile === 'object' &&
    typeof (profile as Record<string, unknown>)['firstName'] === 'string' &&
    typeof (profile as Record<string, unknown>)['paternalLastName'] === 'string'
    ? `${(profile as Record<string, string>)['firstName']} ${(profile as Record<string, string>)['paternalLastName']}` : null;
  const csrfToken = (value as Record<string, unknown>)['csrfToken'];
  if (typeof csrfToken !== 'string') throw new Error('Respuesta de autenticación inválida.');
  return { csrfToken, user: { id: candidate['id'], username: candidate['username'], displayName } };
};
