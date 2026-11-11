import { Component, OnInit, inject, signal } from '@angular/core';

import { IdentityHttp } from '../../../../core/http/identity-http';
import { UiButtonComponent } from '../../../../shared/ui/button/ui-button.component';
import { UiConfirmComponent } from '../../../../shared/ui/confirm/ui-confirm.component';
import { UiTableComponent, type UiTablePageChange, type UiTableRow } from '../../../../shared/ui/table/ui-table.component';

interface CatalogOption { readonly id: string; readonly name: string; }
interface UserTypeItem { readonly id: string; readonly name: string; readonly moduleName: string; readonly enabled: boolean; readonly permissions: readonly string[]; }
interface PermissionItem { readonly id: string; readonly moduleCode: string; readonly name: string; readonly enabled: boolean; readonly functionalities: readonly { name: string; enabled: boolean }[]; }

const MODULES = [
  { code: 'estudiante', name: 'Estudiante' },
  { code: 'docente', name: 'Docente' },
  { code: 'asesora', name: 'Asesora' },
  { code: 'director', name: 'Director' },
  { code: 'administrador', name: 'Administrador' },
] as const;

@Component({
  selector: 'app-identity-roles',
  imports: [UiButtonComponent, UiConfirmComponent, UiTableComponent],
  templateUrl: './identity-roles.component.html',
})
export class IdentityRolesComponent implements OnInit {
  private readonly http = inject(IdentityHttp);
  readonly modules = MODULES;
  readonly typeColumns = [
    { key: 'name', label: 'Tipo de usuario' },
    { key: 'module', label: 'Módulo' },
    { key: 'permissions', label: 'Permisos' },
    { key: 'enabled', label: 'Activo', kind: 'switch' as const },
  ];
  readonly permissionColumns = [
    { key: 'module', label: 'Módulo' },
    { key: 'name', label: 'Permiso' },
    { key: 'features', label: 'Funcionalidades' },
    { key: 'enabled', label: 'Activo', kind: 'switch' as const },
  ];
  readonly notice = signal('');
  readonly catalog = signal<readonly CatalogOption[]>([]);
  readonly types = signal<readonly UserTypeItem[]>([]);
  readonly typeRows = signal<readonly UiTableRow[]>([]);
  readonly typeTotal = signal(0);
  readonly typePage = signal(0);
  readonly typePageSize = signal<5 | 10 | 20>(10);
  readonly permissions = signal<readonly PermissionItem[]>([]);
  readonly permissionRows = signal<readonly UiTableRow[]>([]);
  readonly permissionTotal = signal(0);
  readonly permissionPage = signal(0);
  readonly permissionPageSize = signal<5 | 10 | 20>(10);
  readonly typeOpen = signal(false);
  readonly permissionOpen = signal(false);
  readonly editingTypeId = signal<string | null>(null);
  readonly editingPermissionId = signal<string | null>(null);
  readonly typeName = signal('');
  readonly selectedPermissions = signal<ReadonlySet<string>>(new Set());
  readonly permissionModule = signal<string>('administrador');
  readonly permissionName = signal('');
  readonly featureDraft = signal('');
  readonly features = signal<readonly string[]>([]);
  readonly saving = signal(false);
  readonly pending = signal<{ kind: 'type' | 'permission'; row: UiTableRow } | null>(null);

  async ngOnInit(): Promise<void> { await Promise.all([this.loadTypes(), this.loadPermissions()]); }

  async loadTypes(): Promise<void> {
    const body = await this.http.get<{ total?: number; catalog?: unknown; items?: unknown }>(`/api/v1/auth/admin/user-types?page=${this.typePage() + 1}&pageSize=${this.typePageSize()}`).catch(() => null);
    if (!body) { this.notice.set('No pudimos cargar los tipos de usuario.'); return; }
    const catalog = Array.isArray(body.catalog) ? body.catalog.filter(isOption) : [];
    const items = Array.isArray(body.items) ? body.items.filter(isType) : [];
    this.catalog.set(catalog);
    this.types.set(items);
    this.typeTotal.set(typeof body.total === 'number' ? body.total : items.length);
    this.typeRows.set(items.map((item) => ({ id: item.id, name: item.name, module: item.moduleName, permissions: item.permissions.join(', '), enabled: item.enabled })));
  }

  async loadPermissions(): Promise<void> {
    const body = await this.http.get<{ total?: number; items?: unknown }>(`/api/v1/auth/admin/permissions?page=${this.permissionPage() + 1}&pageSize=${this.permissionPageSize()}`).catch(() => null);
    if (!body) { this.notice.set('No pudimos cargar los permisos.'); return; }
    const items = Array.isArray(body.items) ? body.items.filter(isPermission) : [];
    this.permissions.set(items);
    this.permissionTotal.set(typeof body.total === 'number' ? body.total : items.length);
    this.permissionRows.set(items.map((item) => ({
      id: item.id,
      module: MODULES.find((module) => module.code === item.moduleCode)?.name ?? item.moduleCode,
      name: item.name,
      features: item.functionalities.map((feature) => feature.name).join(', '),
      enabled: item.enabled,
    })));
  }

  changeTypePage(event: UiTablePageChange): void { this.applyPage('type', event); }
  changePermissionPage(event: UiTablePageChange): void { this.applyPage('permission', event); }

  startType(): void {
    this.editingTypeId.set(null);
    this.typeName.set('');
    this.selectedPermissions.set(new Set());
    this.typeOpen.set(true);
  }

  editType(row: UiTableRow): void {
    const current = this.types().find((item) => item.id === row['id']);
    if (!current) return;
    const names = new Set(current.permissions.map((name) => name.toLocaleLowerCase('es')));
    this.editingTypeId.set(current.id);
    this.typeName.set(current.name);
    this.selectedPermissions.set(new Set(this.catalog().filter((option) => names.has(option.name.toLocaleLowerCase('es'))).map((option) => option.id)));
    this.typeOpen.set(true);
  }

  togglePermission(id: string): void {
    this.selectedPermissions.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async saveType(): Promise<void> {
    const name = this.typeName().trim();
    const permissions = this.catalog().map((option) => ({ id: option.id, enabled: this.selectedPermissions().has(option.id) }));
    if (!name || !permissions.some((item) => item.enabled)) { this.notice.set('Indica el nombre y al menos un permiso.'); return; }
    this.saving.set(true);
    try {
      const id = this.editingTypeId();
      if (id) await this.http.send('PATCH', `/api/v1/auth/admin/user-types/${id}`, { name, permissions });
      else await this.http.send('POST', '/api/v1/auth/admin/user-types', { name, permissions });
      this.typeOpen.set(false);
      this.notice.set(id ? 'Tipo de usuario actualizado.' : 'Tipo de usuario creado.');
      await this.loadTypes();
    } catch (error) { this.notice.set(error instanceof Error ? error.message : 'No se pudo guardar el tipo.'); }
    finally { this.saving.set(false); }
  }

  async toggleType(row: UiTableRow): Promise<void> {
    const current = this.types().find((item) => item.id === row['id']);
    if (!current) return;
    try {
      await this.http.send('PATCH', `/api/v1/auth/admin/user-types/${current.id}`, { enabled: !current.enabled });
      await this.loadTypes();
    } catch (error) { this.notice.set(error instanceof Error ? error.message : 'No se pudo cambiar el estado.'); }
  }

  startPermission(): void {
    this.editingPermissionId.set(null);
    this.permissionModule.set('administrador');
    this.permissionName.set('');
    this.features.set([]);
    this.featureDraft.set('');
    this.permissionOpen.set(true);
  }

  editPermission(row: UiTableRow): void {
    const current = this.permissions().find((item) => item.id === row['id']);
    if (!current) return;
    this.editingPermissionId.set(current.id);
    this.permissionModule.set(current.moduleCode);
    this.permissionName.set(current.name);
    this.features.set(current.functionalities.map((feature) => feature.name));
    this.permissionOpen.set(true);
  }

  addFeature(): void {
    const name = this.featureDraft().trim();
    if (!name || this.features().some((item) => item.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) return;
    this.features.update((items) => [...items, name]);
    this.featureDraft.set('');
  }

  removeFeature(name: string): void { this.features.update((items) => items.filter((item) => item !== name)); }

  async savePermission(): Promise<void> {
    const name = this.permissionName().trim();
    const functionalities = this.features().map((feature) => ({ name: feature, enabled: true }));
    if (!name || functionalities.length === 0) { this.notice.set('Indica el permiso y al menos una funcionalidad.'); return; }
    this.saving.set(true);
    try {
      const id = this.editingPermissionId();
      const payload = { moduleCode: this.permissionModule(), name, enabled: true, functionalities };
      if (id) await this.http.send('PATCH', `/api/v1/auth/admin/permissions/${id}`, payload);
      else await this.http.send('POST', '/api/v1/auth/admin/permissions', payload);
      this.permissionOpen.set(false);
      this.notice.set(id ? 'Permiso actualizado.' : 'Permiso creado. Ya puedes asignarlo al crear un usuario.');
      await Promise.all([this.loadPermissions(), this.loadTypes()]);
    } catch (error) { this.notice.set(error instanceof Error ? error.message : 'No se pudo guardar el permiso.'); }
    finally { this.saving.set(false); }
  }

  async togglePermissionState(row: UiTableRow): Promise<void> {
    const current = this.permissions().find((item) => item.id === row['id']);
    if (!current) return;
    try {
      await this.http.send('PATCH', `/api/v1/auth/admin/permissions/${current.id}`, { enabled: !current.enabled });
      await this.loadPermissions();
    } catch (error) { this.notice.set(error instanceof Error ? error.message : 'No se pudo cambiar el estado.'); }
  }

  askDelete(kind: 'type' | 'permission', row: UiTableRow): void { this.pending.set({ kind, row }); }

  async confirmDelete(): Promise<void> {
    const current = this.pending();
    this.pending.set(null);
    if (!current) return;
    const url = current.kind === 'type' ? `/api/v1/auth/admin/user-types/${String(current.row['id'])}` : `/api/v1/auth/admin/permissions/${String(current.row['id'])}`;
    try {
      await this.http.send('DELETE', url);
      this.notice.set('Registro eliminado.');
      await Promise.all([this.loadTypes(), this.loadPermissions()]);
    } catch (error) { this.notice.set(error instanceof Error ? error.message : 'No se pudo eliminar.'); }
  }

  private applyPage(kind: 'type' | 'permission', event: UiTablePageChange): void {
    if (event.pageSize === 5 || event.pageSize === 10 || event.pageSize === 20) {
      if (kind === 'type') this.typePageSize.set(event.pageSize);
      else this.permissionPageSize.set(event.pageSize);
    }
    if (kind === 'type') { this.typePage.set(event.page); void this.loadTypes(); }
    else { this.permissionPage.set(event.page); void this.loadPermissions(); }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const text = (value: unknown): value is string => typeof value === 'string';
const isOption = (value: unknown): value is CatalogOption => isRecord(value) && text(value['id']) && text(value['name']);
const isType = (value: unknown): value is UserTypeItem =>
  isRecord(value) && text(value['id']) && text(value['name']) && text(value['moduleName']) && typeof value['enabled'] === 'boolean' && Array.isArray(value['permissions']);
const isPermission = (value: unknown): value is PermissionItem =>
  isRecord(value) && text(value['id']) && text(value['moduleCode']) && text(value['name']) && typeof value['enabled'] === 'boolean' && Array.isArray(value['functionalities']);
