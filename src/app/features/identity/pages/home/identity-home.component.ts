import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IdentityAuthService } from '../../../../core/auth/identity-auth.service';

@Component({
  selector: 'app-identity-home',
  imports: [RouterLink],
  templateUrl: './identity-home.component.html',
})
export class IdentityHomeComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(IdentityAuthService);
  readonly menuOpen = signal(false);
  readonly profileOpen = signal(false);
  readonly notificationsOpen = signal(false);
  readonly displayName = computed(() => this.auth.user()?.displayName || this.auth.user()?.username || 'Usuario');
  readonly users = signal(0);
  readonly applications = signal(0);
  readonly events = signal(0);

  async ngOnInit(): Promise<void> {
    try {
      if (!await this.auth.restore()) {
        await this.router.navigateByUrl('/login');
        return;
      }
      await this.loadTotals();
    } catch {
      await this.router.navigateByUrl('/login');
    }
  }

  private async loadTotals(): Promise<void> {
    const [users, applications, events] = await Promise.all([
      readTotal('/api/v1/auth/admin/users?page=1&pageSize=5'),
      readTotal('/api/v1/auth/admin/modules?page=1&pageSize=5'),
      readTotal('/api/v1/auth/admin/audit?page=1&pageSize=5'),
    ]);
    this.users.set(users);
    this.applications.set(applications);
    this.events.set(events);
  }

  toggleMenu(): void { this.menuOpen.update((value) => !value); }
  toggleProfile(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationsOpen.set(false);
    this.profileOpen.update((value) => !value);
  }
  toggleNotifications(event: MouseEvent): void {
    event.stopPropagation();
    this.profileOpen.set(false);
    this.notificationsOpen.update((value) => !value);
  }
  closePanels(): void { this.profileOpen.set(false); this.notificationsOpen.set(false); }
  async logout(): Promise<void> {
    try {
      await this.auth.logout();
    } finally {
      await this.router.navigateByUrl('/login');
    }
  }
}

const readTotal = async (url: string): Promise<number> => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) return 0;
  const payload: unknown = await response.json();
  const total = payload && typeof payload === 'object' ? (payload as { total?: unknown }).total : 0;
  return typeof total === 'number' ? total : 0;
};
