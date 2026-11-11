import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { IdentityAuthService } from '../../../../core/auth/identity-auth.service';

@Component({
  selector: 'app-identity-dashboard',
  templateUrl: './identity-dashboard.component.html',
})
export class IdentityDashboardComponent implements OnInit {
  private readonly auth = inject(IdentityAuthService);
  readonly displayName = computed(() => this.auth.user()?.displayName || this.auth.user()?.username || 'Usuario');
  readonly users = signal(0);
  readonly applications = signal(0);
  readonly events = signal(0);

  async ngOnInit(): Promise<void> {
    const [users, applications, events] = await Promise.all([
      readTotal('/api/v1/auth/admin/users?page=1&pageSize=5'),
      readTotal('/api/v1/auth/admin/modules?page=1&pageSize=5'),
      readTotal('/api/v1/auth/admin/audit?page=1&pageSize=5'),
    ]);
    this.users.set(users);
    this.applications.set(applications);
    this.events.set(events);
  }
}

const readTotal = async (url: string): Promise<number> => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) return 0;
  const payload: unknown = await response.json();
  const total = payload && typeof payload === 'object' ? (payload as { total?: unknown }).total : 0;
  return typeof total === 'number' ? total : 0;
};
