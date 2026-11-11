import { Component, OnInit, inject, signal } from '@angular/core';

import { IdentityHttp } from '../../../../core/http/identity-http';
import { UiButtonComponent } from '../../../../shared/ui/button/ui-button.component';

@Component({
  selector: 'app-identity-security',
  imports: [UiButtonComponent],
  templateUrl: './identity-security.component.html',
})
export class IdentitySecurityComponent implements OnInit {
  private readonly http = inject(IdentityHttp);
  readonly enabled = signal(false);
  readonly notice = signal('');
  readonly secret = signal('');
  readonly qr = signal('');
  readonly code = signal('');
  readonly password = signal('');
  readonly saving = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const status = await this.http.get<{ enabled?: boolean }>('/api/v1/auth/profile/totp');
      this.enabled.set(status.enabled === true);
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'No pudimos consultar la autenticación de dos pasos.');
    }
  }

  async begin(): Promise<void> {
    this.saving.set(true);
    this.notice.set('');
    try {
      const setup = await this.http.sendJson<{ secret?: string; otpauthUrl?: string }>('POST', '/api/v1/auth/profile/totp');
      if (!setup.secret || !setup.otpauthUrl) throw new Error('No se pudo preparar la configuración.');
      this.secret.set(setup.secret);
      const qr = await import('qrcode');
      this.qr.set(await qr.toDataURL(setup.otpauthUrl, { margin: 1, width: 220 }));
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'No se pudo preparar la configuración.');
    } finally { this.saving.set(false); }
  }

  async confirm(): Promise<void> {
    if (!/^\d{6}$/.test(this.code().trim())) { this.notice.set('Ingresa el código de 6 dígitos que muestra la aplicación.'); return; }
    this.saving.set(true);
    this.notice.set('');
    try {
      await this.http.send('POST', '/api/v1/auth/profile/totp/confirm', { code: this.code().trim() });
      this.enabled.set(true);
      this.secret.set('');
      this.qr.set('');
      this.code.set('');
      this.notice.set('Autenticación de dos pasos activa. El próximo ingreso pedirá el código.');
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'No se pudo activar.');
    } finally { this.saving.set(false); }
  }

  async disable(): Promise<void> {
    if (!this.password() || !/^\d{6}$/.test(this.code().trim())) { this.notice.set('Ingresa tu contraseña y el código actual.'); return; }
    this.saving.set(true);
    this.notice.set('');
    try {
      await this.http.send('POST', '/api/v1/auth/profile/totp/disable', { password: this.password(), code: this.code().trim() });
      this.enabled.set(false);
      this.password.set('');
      this.code.set('');
      this.notice.set('Autenticación de dos pasos desactivada.');
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'No se pudo desactivar.');
    } finally { this.saving.set(false); }
  }
}
