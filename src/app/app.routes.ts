import { Routes } from '@angular/router';

import { IdentityLoginComponent } from './features/auth/pages/login/identity-login.component';
import { IdentityHomeComponent } from './features/identity/pages/home/identity-home.component';
import { IdentityModuleComponent } from './features/identity/pages/module/identity-module.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inicio' },
  { path: 'inicio', title: 'Identidad UPRIT', component: IdentityHomeComponent },
  { path: 'usuarios', title: 'Usuarios · Identidad UPRIT', component: IdentityModuleComponent, data: { section: 'usuarios' } },
  { path: 'aplicaciones', title: 'Aplicaciones · Identidad UPRIT', component: IdentityModuleComponent, data: { section: 'aplicaciones' } },
  { path: 'roles', title: 'Roles · Identidad UPRIT', component: IdentityModuleComponent, data: { section: 'roles' } },
  { path: 'auditoria', title: 'Auditoría · Identidad UPRIT', component: IdentityModuleComponent, data: { section: 'auditoria' } },
  { path: 'login', title: 'Iniciar sesión', component: IdentityLoginComponent },
  { path: '**', redirectTo: '' },
];
