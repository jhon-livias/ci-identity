import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { IdentityHttp } from '../../../../core/http/identity-http';
import { UiButtonComponent } from '../../../../shared/ui/button/ui-button.component';
import { UiConfirmComponent } from '../../../../shared/ui/confirm/ui-confirm.component';
import { UiTableComponent, type UiTablePageChange, type UiTableRow } from '../../../../shared/ui/table/ui-table.component';

interface DirectoryUser {
  readonly id: string;
  readonly documentNumber: string;
  readonly firstName: string;
  readonly paternalLastName: string;
  readonly maternalLastName: string;
  readonly typeName: string;
}

@Component({
  selector: 'app-identity-users',
  imports: [UiButtonComponent, UiConfirmComponent, UiTableComponent],
  templateUrl: './identity-users.component.html',
})
export class IdentityUsersComponent implements OnInit {
  private readonly http = inject(IdentityHttp);
  private readonly router = inject(Router);
  readonly columns = [
    { key: 'document', label: 'Documento' },
    { key: 'name', label: 'Nombre' },
    { key: 'type', label: 'Acceso' },
  ];
  readonly search = signal('');
  readonly page = signal(0);
  readonly pageSize = signal<5 | 10 | 20>(10);
  readonly total = signal(0);
  readonly rows = signal<readonly UiTableRow[]>([]);
  readonly notice = signal('');
  readonly resetNotice = signal<{ username: string; password: string } | null>(null);
  readonly pendingDelete = signal<UiTableRow | null>(null);

  async ngOnInit(): Promise<void> {
    const state = history.state as { notice?: unknown };
    if (typeof state.notice === 'string') this.notice.set(state.notice);
    await this.load();
  }

  async load(): Promise<void> {
    const params = new URLSearchParams({ page: String(this.page() + 1), pageSize: String(this.pageSize()) });
    const term = this.search().trim();
    if (term) params.set('search', term);
    try {
      const body = await this.http.get<{ total?: number; users?: unknown }>(`/api/v1/auth/admin/users?${params}`);
      const users = Array.isArray(body.users) ? body.users.filter(isUser) : [];
      this.total.set(typeof body.total === 'number' ? body.total : users.length);
      this.rows.set(users.map((user) => ({
        id: user.id,
        document: user.documentNumber,
        name: `${user.firstName} ${user.paternalLastName} ${text(user.maternalLastName) ? user.maternalLastName : ''}`.replace(/\s+/g, ' ').trim(),
        type: text(user.typeName) && user.typeName ? user.typeName : 'Sin acceso',
      })));
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'No pudimos cargar los usuarios.');
    }
  }

  searchUsers(): void {
    this.page.set(0);
    void this.load();
  }

  changePage(event: UiTablePageChange): void {
    this.page.set(event.page);
    if (event.pageSize === 5 || event.pageSize === 10 || event.pageSize === 20) this.pageSize.set(event.pageSize);
    void this.load();
  }

  startCreate(): void { void this.router.navigateByUrl('/usuarios/crear'); }
  startEdit(row: UiTableRow): void { void this.router.navigateByUrl(`/usuarios/${String(row['id'])}/editar`); }
  askDelete(row: UiTableRow): void { this.pendingDelete.set(row); }

  async confirmDelete(): Promise<void> {
    const row = this.pendingDelete();
    this.pendingDelete.set(null);
    if (!row) return;
    try {
      await this.http.send('DELETE', `/api/v1/auth/admin/users/${String(row['id'])}`);
      this.notice.set('Usuario eliminado.');
      await this.load();
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'No se pudo eliminar el usuario.');
    }
  }

  async resetPassword(row: UiTableRow): Promise<void> {
    try {
      const result = await this.http.sendJson<{ username?: string; password?: string }>('POST', `/api/v1/auth/admin/users/${String(row['id'])}/password-reset`);
      if (!result.username || !result.password) throw new Error('No se pudo restablecer la contraseña.');
      this.resetNotice.set({ username: result.username, password: result.password });
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'No se pudo restablecer la contraseña.');
    }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const text = (value: unknown): value is string => typeof value === 'string';
const isUser = (value: unknown): value is DirectoryUser =>
  isRecord(value) && text(value['id']) && text(value['documentNumber']) && text(value['firstName']) && text(value['paternalLastName']);
