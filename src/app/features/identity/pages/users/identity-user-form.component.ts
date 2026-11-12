import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { IdentityHttp } from '../../../../core/http/identity-http';
import { UiButtonComponent } from '../../../../shared/ui/button/ui-button.component';

interface UserGrant { readonly permissionId: string; readonly name: string; readonly enabled: boolean; }

interface UserDetail {
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
  readonly studyPlans?: { readonly role?: unknown; readonly careerCodes?: unknown };
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
  selector: 'app-identity-user-form',
  imports: [UiButtonComponent],
  templateUrl: './identity-user-form.component.html',
})
export class IdentityUserFormComponent implements OnInit {
  private readonly http = inject(IdentityHttp);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly documentTypes = [
    { value: 'DNI', label: 'DNI' },
    { value: 'CE', label: 'Carné de extranjería' },
    { value: 'PASSPORT', label: 'Pasaporte' },
  ];
  readonly countries = ['+51', '+1', '+52', '+54', '+56', '+57', '+58', '+593', '+34'];
  readonly editingId = signal<string | null>(null);
  readonly ready = signal(false);
  readonly notice = signal('');
  readonly saving = signal(false);
  readonly draft = signal<Draft>(emptyDraft());
  readonly sites = signal<readonly SiteOption[]>([]);
  readonly access = signal<readonly AccessItem[]>([]);
  readonly studyRole = signal<'none' | 'faculty' | 'teacher'>('none');
  readonly careerCodes = signal('');
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
    const id = this.route.snapshot.paramMap.get('id');
    this.editingId.set(id);
    await Promise.all([this.loadSites(), this.loadAccess()]);
    if (!id) {
      this.draft.update((current) => ({ ...current, siteId: this.sites()[0]?.id ?? '' }));
      this.ready.set(true);
      return;
    }
    try {
      const detail = await this.http.get<UserDetail>(`/api/v1/auth/admin/users/${id}`);
      this.draft.set({
        documentType: detail.documentType, documentNumber: detail.documentNumber, firstName: detail.firstName,
        paternalLastName: detail.paternalLastName, maternalLastName: detail.maternalLastName, siteId: detail.siteId,
        phone: detail.phone, mobileCountry: detail.mobileCountry || '+51', mobile: detail.mobile, email: detail.email,
        password: '', enabled: detail.enabled,
      });
      const enabled = new Set(detail.grants.filter((grant) => grant.enabled).map((grant) => `${grant.permissionId}:${grant.name.toLocaleLowerCase('es')}`));
      this.access.update((items) => items.map((item) => ({ ...item, enabled: enabled.has(item.key) })));
      const role = detail.studyPlans?.role;
      this.studyRole.set(role === 'faculty' || role === 'teacher' ? role : 'none');
      this.careerCodes.set(Array.isArray(detail.studyPlans?.careerCodes) ? detail.studyPlans.careerCodes.filter((code): code is string => typeof code === 'string').join(', ') : '');
      this.ready.set(true);
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'No pudimos abrir el usuario.');
    }
  }

  text(event: Event): string {
    const target = event.target;
    return target instanceof HTMLInputElement || target instanceof HTMLSelectElement ? target.value : '';
  }

  choice(event: Event): 'none' | 'faculty' | 'teacher' {
    const value = this.text(event);
    return value === 'faculty' || value === 'teacher' ? value : 'none';
  }

  setField(field: keyof Draft, value: string): void {
    this.draft.update((current) => ({ ...current, [field]: field === 'enabled' ? value === 'true' : value }));
  }

  toggleAccess(item: AccessItem): void {
    this.access.update((items) => items.map((current) => current.key === item.key ? { ...current, enabled: !current.enabled } : current));
  }

  cancel(): void { void this.router.navigateByUrl('/usuarios'); }

  async save(): Promise<void> {
    const draft = this.draft();
    const grants = this.access().filter((item) => item.enabled).map((item) => ({ permissionId: item.permissionId, name: item.name, enabled: true }));
    const careers = this.careerCodes().split(',').map((code) => code.trim().toUpperCase()).filter((code) => code.length > 0);
    const studyRole = this.studyRole();
    const problem = validate(draft, grants.length > 0 || studyRole !== 'none', this.editingId() !== null)
      ?? (studyRole !== 'none' && (careers.length === 0 || careers.some((code) => !/^[A-Z]{2,8}$/.test(code))) ? 'Indica las carreras con su código, por ejemplo IC, AU.' : null);
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
      studyPlans: { role: studyRole, careerCodes: studyRole === 'none' ? [] : careers },
    };
    this.saving.set(true);
    this.notice.set('');
    try {
      const id = this.editingId();
      if (id) await this.http.send('PATCH', `/api/v1/auth/admin/users/${id}`, payload);
      else await this.http.send('POST', '/api/v1/auth/admin/users', payload);
      await this.router.navigateByUrl('/usuarios', { state: { notice: id ? 'Usuario actualizado.' : 'Usuario creado. El nombre de usuario es su documento.' } });
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'No se pudo guardar el usuario.');
      this.saving.set(false);
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
          if (!feature || typeof feature !== 'object' || typeof (feature as { name?: unknown }).name !== 'string') continue;
          const name = (feature as { name: string }).name;
          collected.push({
            key: `${item.id}:${name.toLocaleLowerCase('es')}`,
            permissionId: item.id,
            moduleName,
            permissionName: item.name,
            name,
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
const isSite = (value: unknown): value is SiteOption => isRecord(value) && text(value['id']) && text(value['name']);
const isPermission = (value: unknown): value is { id: string; moduleCode: string; name: string; functionalities: readonly unknown[] } =>
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
