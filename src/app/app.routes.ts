import { Routes } from '@angular/router';

import { IdentityLoginComponent } from './features/auth/pages/login/identity-login.component';
import { IdentityDashboardComponent } from './features/identity/pages/home/identity-dashboard.component';
import { IdentityHomeComponent } from './features/identity/pages/home/identity-home.component';
import { IdentityModuleComponent } from './features/identity/pages/module/identity-module.component';
import { IdentityRolesComponent } from './features/identity/pages/roles/identity-roles.component';
import { IdentityUserFormComponent } from './features/identity/pages/users/identity-user-form.component';
import { IdentityUsersComponent } from './features/identity/pages/users/identity-users.component';

export const routes: Routes = [
  {
    path: '',
    component: IdentityHomeComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      { path: 'inicio', title: 'Identidad UPRIT', component: IdentityDashboardComponent },
      { path: 'usuarios', title: 'Usuarios · Identidad UPRIT', component: IdentityUsersComponent },
      { path: 'usuarios/crear', title: 'Registrar usuario · Identidad UPRIT', component: IdentityUserFormComponent },
      { path: 'usuarios/:id/editar', title: 'Editar usuario · Identidad UPRIT', component: IdentityUserFormComponent },
      { path: 'aplicaciones', title: 'Aplicaciones · Identidad UPRIT', component: IdentityModuleComponent, data: { section: 'aplicaciones' } },
      { path: 'roles', title: 'Roles · Identidad UPRIT', component: IdentityRolesComponent },
      { path: 'auditoria', title: 'Auditoría · Identidad UPRIT', component: IdentityModuleComponent, data: { section: 'auditoria' } },
    ],
  },
  { path: 'login', title: 'Iniciar sesión', component: IdentityLoginComponent },
  { path: '**', redirectTo: '' },
];
