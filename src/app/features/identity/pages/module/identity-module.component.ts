import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { IdentityAuthService } from '../../../../core/auth/identity-auth.service';

type ModuleSection = 'usuarios' | 'aplicaciones' | 'roles' | 'auditoria';

const content: Record<ModuleSection, { readonly title: string; readonly description: string; readonly url: string }> = {
  usuarios: { title: 'Directorio de usuarios', description: 'Identidades registradas y su tipo de acceso.', url: '/api/v1/auth/admin/users?page=1&pageSize=20' },
  aplicaciones: { title: 'Aplicaciones', description: 'Grupos de personas que usan la identidad institucional.', url: '/api/v1/auth/admin/modules?page=1&pageSize=20' },
  roles: { title: 'Roles y permisos', description: 'Permisos definidos para las aplicaciones.', url: '/api/v1/auth/admin/permissions?page=1&pageSize=20' },
  auditoria: { title: 'Auditoría', description: 'Cambios de acceso y operaciones administrativas.', url: '/api/v1/auth/admin/audit?page=1&pageSize=20' },
};

const isSection = (value: string): value is ModuleSection => value in content;

@Component({ selector: 'app-identity-module', templateUrl: './identity-module.component.html' })
export class IdentityModuleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(IdentityAuthService);
  readonly section = isSection(String(this.route.snapshot.data['section'] ?? '')) ? this.route.snapshot.data['section'] as ModuleSection : 'usuarios';
  readonly copy = content[this.section];
  readonly rows = signal<readonly string[]>([]);
  readonly notice = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    if (!await this.auth.restore()) {
      await this.router.navigateByUrl('/login');
      return;
    }
    const response = await fetch(this.copy.url, { credentials: 'include' });
    if (!response.ok) {
      this.notice.set('No pudimos cargar este módulo.');
      return;
    }
    this.rows.set(lines(this.section, await response.json() as unknown));
  }
}

const text = (value: unknown): string => typeof value === 'string' ? value : '';

const lines = (section: ModuleSection, payload: unknown): readonly string[] => {
  if (!payload || typeof payload !== 'object') return [];
  const body = payload as Record<string, unknown>;
  if (section === 'usuarios' && Array.isArray(body['users'])) {
    return body['users'].map((item) => {
      if (!item || typeof item !== 'object') return '';
      const user = item as Record<string, unknown>;
      return `${text(user['firstName'])} ${text(user['paternalLastName'])} · ${text(user['documentNumber'])} · ${text(user['typeName'])}`.trim();
    }).filter(Boolean);
  }
  if (section === 'aplicaciones' && Array.isArray(body['modules'])) {
    return body['modules'].map((item) => {
      if (!item || typeof item !== 'object') return '';
      const module = item as Record<string, unknown>;
      return `${text(module['name'])} · ${typeof module['users'] === 'number' ? module['users'] : 0} usuarios`;
    }).filter(Boolean);
  }
  if (section === 'roles' && Array.isArray(body['items'])) {
    return body['items'].map((item) => {
      if (!item || typeof item !== 'object') return '';
      const role = item as Record<string, unknown>;
      return `${text(role['name'])}${role['enabled'] === false ? ' · deshabilitado' : ''}`;
    }).filter(Boolean);
  }
  if (section === 'auditoria' && Array.isArray(body['events'])) {
    return body['events'].map((item) => {
      if (!item || typeof item !== 'object') return '';
      const event = item as Record<string, unknown>;
      return `${text(event['occurredAt']).replace('T', ' ').slice(0, 16)} · ${text(event['actorName'])} · ${text(event['action'])}`;
    }).filter(Boolean);
  }
  return [];
};
