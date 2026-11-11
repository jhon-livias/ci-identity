import { Component, OnInit, computed, inject, signal } from '@angular/core';

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

interface UserGrant { readonly permissionId: string; readonly name: string; readonly enabled: boolean; }

interface UserDetail {
  readonly id: string;
  readonly documentType: string;
  readonly documentNumber: string;
  readonly firstName: string;
  readonly paternalLastName: string;
  readonly maternalLastName: string;
  readonly siteId: string;
  readonly phone: string;
  readonly mobileCountry: string;
  readonly mobile: string;
  readonly email: string;
  readonly enabled: boolean;
  readonly grants: readonly UserGrant[];
}

interface AccessItem {
  readonly key: string;
  readonly permissionId: string;
  readonly moduleName: string;
  readonly permissionName: string;
  readonly name: string;
  enabled: boolean;
}

interface SiteOption { readonly id: string; readonly name: string; }

interface Draft {
  documentType: string;
  documentNumber: string;
  firstName: string;
  paternalLastName: string;
  maternalLastName: string;
  siteId: string;
  phone: string;
  mobileCountry: string;
  mobile: string;
  email: string;
  password: string;
  enabled: boolean;
}

const MODULES = [
  { code: 'estudiante', name: 'Estudiante' },
  { code: 'docente', name: 'Docente' },
  { code: 'asesora', name: 'Asesora' },
  { code: 'director', name: 'Director' },
  { code: 'administrador', name: 'Administrador' },
] as const;

const emptyDraft = (): Draft => ({
  documentType: 'DNI', documentNumber: '', firstName: '', paternalLastName: '', maternalLastName: '',
  siteId: '', phone: '', mobileCountry: '+51', mobile: '', email: '', password: '', enabled: true,
});

@Component({
  selector: 'app-identity-users',
  imports: [UiButtonComponent, UiConfirmComponent, UiTableComponent],
  templateUrl: './identity-users.component.html',
})
export class IdentityUsersComponent implements OnInit {
  private readonly http = inject(IdentityHttp);
  readonly columns = [
    { key: 'document', label: 'Documento' },
    { key: 'name', label: 'Nombre' },
    { key: 'type', label: 'Acceso' },
  ];
  readonly documentTypes = [
    { value: 'DNI', label: 'DNI' },
    { value: 'CE', label: 'Carné de extranjería' },
    { value: 'PASSPORT', label: 'Pasaporte' },
  ];
  readonly countries = ['+51', '+1', '+52', '+54', '+56', '+57', '+58', '+593', '+34'];
  readonly search = signal('');
  readonly page = signal(0);
  readonly pageSize = signal<5 | 10 | 20>(10);
  readonly total = signal(0);
  readonly rows = signal<readonly UiTableRow[]>([]);
  readonly notice = signal('');
  readonly saving = signal(false);
  readonly editorOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly draft = signal<Draft>(emptyDraft());
  readonly sites = signal<readonly SiteOption[]>([]);
  readonly access = signal<readonly AccessItem[]>([]);
  readonly resetNotice = signal<{ username: string; password: string } | null>(null);
  readonly pendingDelete = signal<UiTableRow | null>(null);
  readonly groupedAccess = computed(() => {
    const groups = new Map<string, AccessItem[]>();
    for (const item of this.access()) {
      const list = groups.get(item.moduleName) ?? [];
      list.push(item);
      groups.set(item.moduleName, list);
    }
    return [...groups.entries()].map(([moduleName, items]) => ({ moduleName, items }));
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.load(), this.loadSites(), this.loadAccess()]);
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
        name: `${user.firstName} ${user.paternalLastName} ${user.maternalLastName}`.replace(/\s+/g, ' ').trim(),
        type: user.typeName || 'Sin acceso',
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

  async startCreate(): Promise<void> {
    this.editingId.set(null);
    this.draft.set({ ...emptyDraft(), siteId: this.sites()[0]?.id ?? '' });
    this.access.update((items) => items.map((item) => ({ ...item, enabled: false })));
    this.notice.set('');
    this.editorOpen.set(true);
  }

  async startEdit(row: UiTableRow): Promise<void> {
    const id = String(row['id'] ?? '');
    this.notice.set('');
    try {
      const detail = await this.http.get<UserDetail>(`/api/v1/auth/admin/users/${id}`);
      this.editingId.set(id);
      this.draft.set({
        documentType: detail.documentType, documentNumber: detail.documentNumber, firstName: detail.firstName,
        paternalLastName: detail.paternalLastName, maternalLastName: detail.maternalLastName, siteId: detail.siteId,
        phone: detail.phone, mobileCountry: detail.mobileCountry || '+51', mobile: detail.mobile, email: detail.email,
        password: '', enabled: detail.enabled,
      });
      const enabled = new Set(detail.grants.filter((grant) => grant.enabled).map((grant) => `${grant.permissionId}:${grant.name.toLocaleLowerCase('es')}`));
      this.access.update((items) => items.map((item) => ({ ...item, enabled: enabled.has(item.key) })));
      this.editorOpen.set(true);
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'No pudimos abrir el usuario.');
    }
  }

  closeEditor(): void { this.editorOpen.set(false); }

  setField(field: keyof Draft, value: string): void {
    this.draft.update((current) => ({ ...current, [field]: field === 'enabled' ? value === 'true' : value }));
  }

  toggleAccess(item: AccessItem): void {
    this.access.update((items) => items.map((current) => current.key === item.key ? { ...current, enabled: !current.enabled } : current));
  }

  async save(): Promise<void> {
    const draft = this.draft();
    const grants = this.access().filter((item) => item.enabled).map((item) => ({ permissionId: item.permissionId, name: item.name, enabled: true }));
    const problem = validate(draft, grants.length > 0, this.editingId() !== null);
    if (problem) { this.notice.set(problem); return; }
    const payload = {
      documentType: draft.documentType,
      documentNumber: draft.documentNumber.trim(),
      firstName: draft.firstName.trim(),
      paternalLastName: draft.paternalLastName.trim(),
      maternalLastName: draft.maternalLastName.trim(),
      siteId: draft.siteId,
      phone: draft.phone.trim() || undefined,
      mobileCountry: draft.mobileCountry,
      mobile: draft.mobile.trim(),
      email: draft.email.trim().toLowerCase(),
      password: draft.password || undefined,
      enabled: draft.enabled,
      grants,
    };
    this.saving.set(true);
    this.notice.set('');
    try {
      const id = this.editingId();
      if (id) await this.http.send('PATCH', `/api/v1/auth/admin/users/${id}`, payload);
      else await this.http.send('POST', '/api/v1/auth/admin/users', payload);
      this.editorOpen.set(false);
      this.notice.set(id ? 'Usuario actualizado.' : 'Usuario creado. El nombre de usuario es su documento.');
      await this.load();
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'No se pudo guardar el usuario.');
    } finally { this.saving.set(false); }
  }

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

  private async loadSites(): Promise<void> {
    try {
      const body = await this.http.get<unknown>('/api/v1/auth/admin/sites');
      this.sites.set(Array.isArray(body) ? body.filter(isSite) : []);
    } catch { this.sites.set([]); }
  }

  private async loadAccess(): Promise<void> {
    const collected: AccessItem[] = [];
    for (let page = 1; page <= 20; page += 1) {
      const body = await this.http.get<{ items?: unknown }>(`/api/v1/auth/admin/permissions?page=${page}&pageSize=20`).catch(() => ({ items: [] }));
      const items = Array.isArray(body.items) ? body.items : [];
      for (const item of items) {
        if (!isPermission(item)) continue;
        const moduleName = MODULES.find((module) => module.code === item.moduleCode)?.name ?? item.moduleCode;
        for (const feature of item.functionalities) {
          collected.push({
            key: `${item.id}:${feature.name.toLocaleLowerCase('es')}`,
            permissionId: item.id,
            moduleName,
            permissionName: item.name,
            name: feature.name,
            enabled: false,
          });
        }
      }
      if (items.length < 20) break;
    }
    this.access.set(collected);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const text = (value: unknown): value is string => typeof value === 'string';
const isUser = (value: unknown): value is DirectoryUser =>
  isRecord(value) && text(value['id']) && text(value['documentNumber']) && text(value['firstName']) && text(value['paternalLastName']);
const isSite = (value: unknown): value is SiteOption => isRecord(value) && text(value['id']) && text(value['name']);
const isPermission = (value: unknown): value is { id: string; moduleCode: string; name: string; functionalities: readonly { name: string }[] } =>
  isRecord(value) && text(value['id']) && text(value['moduleCode']) && text(value['name']) && Array.isArray(value['functionalities']);

const validate = (draft: Draft, hasGrant: boolean, editing: boolean): string | null => {
  if (!draft.firstName.trim() || !draft.paternalLastName.trim() || !draft.maternalLastName.trim()) return 'Completa nombres y apellidos.';
  const document = draft.documentNumber.trim();
  if (draft.documentType === 'DNI' ? !/^\d{8}$/.test(document) : !/^[A-Za-z0-9]{6,12}$/.test(document)) return 'Revisa el documento.';
  if (!draft.siteId) return 'Selecciona una sede. Si no hay sedes, créala antes en el centro de idiomas.';
  if (!/^\d{6,15}$/.test(draft.mobile.trim())) return 'Ingresa un celular válido.';
  if (!/^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?@uprit\.edu\.pe$/i.test(draft.email.trim())) return 'Solo se acepta el dominio @uprit.edu.pe.';
  if (!editing && draft.password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (editing && draft.password && draft.password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!hasGrant) return 'Activa al menos una funcionalidad para definir el acceso.';
  return null;
};
