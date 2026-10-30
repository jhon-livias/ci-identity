import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

type ModuleSection = 'usuarios' | 'aplicaciones' | 'roles' | 'auditoria';

const content: Record<ModuleSection, { readonly title: string; readonly description: string; readonly action: string }> = {
  usuarios: { title: 'Directorio de usuarios', description: 'Busca una identidad y asigna o revoca su acceso por aplicación.', action: 'Crear usuario' },
  aplicaciones: { title: 'Aplicaciones', description: 'Registra las aplicaciones que consumen la identidad institucional.', action: 'Registrar aplicación' },
  roles: { title: 'Roles y permisos', description: 'Define roles específicos por aplicación sin mezclar privilegios.', action: 'Crear rol' },
  auditoria: { title: 'Auditoría', description: 'Consulta cambios de acceso, sesiones y operaciones administrativas.', action: 'Exportar registros' },
};

@Component({ selector: 'app-identity-module', imports: [RouterLink], templateUrl: './identity-module.component.html' })
export class IdentityModuleComponent {
  private readonly route = inject(ActivatedRoute);
  readonly section = (this.route.snapshot.data['section'] as ModuleSection) ?? 'usuarios';
  readonly copy = content[this.section];
}
