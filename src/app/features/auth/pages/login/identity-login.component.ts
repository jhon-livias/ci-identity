import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormField, FormRoot, form, minLength, required } from '@angular/forms/signals';
import { Router } from '@angular/router';

import { IdentityAuthService } from '../../../../core/auth/identity-auth.service';
import { RecaptchaService } from '../../../../core/security/recaptcha.service';
import { AuthLayoutComponent } from '../../../../layouts/auth-layout/auth-layout.component';
import { UiAlertComponent, type AlertTone } from '../../../../shared/ui/alert/ui-alert.component';
import { UiButtonComponent } from '../../../../shared/ui/button/ui-button.component';
import { UiFieldComponent } from '../../../../shared/ui/field/ui-field.component';
import type { LoginCredentials } from '../../models/login-credentials.model';

@Component({
  selector: 'app-identity-login',
  imports: [FormField, FormRoot, AuthLayoutComponent, UiAlertComponent, UiButtonComponent, UiFieldComponent],
  templateUrl: './identity-login.component.html',
})
export class IdentityLoginComponent {
  private readonly auth = inject(IdentityAuthService);
  private readonly recaptcha = inject(RecaptchaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly credentials = signal<LoginCredentials>({ username: '', password: '' });
  readonly totpCode = signal('');
  readonly needsCode = signal(this.route.snapshot.queryParamMap.get('google') === 'totp');
  readonly enrollment = signal<{ token: string; secret: string; qr: string } | null>(null);
  readonly enrollCode = signal('');
  readonly loginForm = form(this.credentials, (path) => {
    required(path.username, { message: 'Ingresa tu usuario institucional.' });
    required(path.password, { message: 'Ingresa tu contraseña.' });
    minLength(path.password, 8, { message: 'La contraseña debe tener al menos 8 caracteres.' });
  });
  readonly submitting = signal(false);
  readonly notice = signal<{ readonly text: string; readonly tone: AlertTone } | null>(
    this.route.snapshot.queryParamMap.get('google') === 'totp'
      ? { text: 'Esta cuenta usa autenticación de dos pasos. Ingresa con tu contraseña y el código de la aplicación.', tone: 'warning' }
      : this.route.snapshot.queryParamMap.get('google') === 'enroll'
        ? { text: 'Debes activar la autenticación de dos pasos. Ingresa con tu usuario y contraseña.', tone: 'warning' }
        : null,
  );

  async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.loginForm().markAsTouched();
    if (this.loginForm().invalid()) {
      this.notice.set({ text: 'Revisa los datos marcados para continuar.', tone: 'warning' });
      return;
    }
    this.submitting.set(true);
    this.notice.set(null);
    try {
      const enrollmentToken = await this.auth.login(this.credentials().username.trim(), this.credentials().password, await this.recaptcha.executeLogin(), this.totpCode().trim() || undefined);
      if (enrollmentToken) {
        const setup = await this.auth.beginEnrollment(enrollmentToken);
        this.enrollment.set({ token: enrollmentToken, secret: setup.secret, qr: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(setup.qrSvg)}` });
        return;
      }
      await this.router.navigateByUrl('/');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'No pudimos iniciar sesión.';
      if (text.includes('código')) this.needsCode.set(true);
      this.notice.set({ text, tone: 'error' });
    } finally {
      this.submitting.set(false);
    }
  }

  async confirmEnrollment(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const current = this.enrollment();
    if (!current || !/^\d{6}$/.test(this.enrollCode().trim())) {
      this.notice.set({ text: 'Ingresa el código de 6 dígitos que muestra la aplicación.', tone: 'warning' });
      return;
    }
    this.submitting.set(true);
    this.notice.set(null);
    try {
      await this.auth.finishEnrollment(current.token, this.enrollCode().trim());
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.notice.set({ text: error instanceof Error ? error.message : 'No se pudo activar la autenticación.', tone: 'error' });
    } finally { this.submitting.set(false); }
  }

  continueWithGoogle(): void {
    window.location.assign('/api/v1/auth/google?application=identity');
  }
}
