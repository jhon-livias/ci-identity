import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IdentityAuthService } from '../../../../core/auth/identity-auth.service';

@Component({
  selector: 'app-identity-home',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './identity-home.component.html',
})
export class IdentityHomeComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(IdentityAuthService);
  readonly menuOpen = signal(false);
  readonly profileOpen = signal(false);
  readonly notificationsOpen = signal(false);
  readonly displayName = computed(() => this.auth.user()?.displayName || this.auth.user()?.username || 'Usuario');

  async ngOnInit(): Promise<void> {
    try {
      if (!await this.auth.restore()) await this.router.navigateByUrl('/login');
    } catch {
      await this.router.navigateByUrl('/login');
    }
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
  openSecurity(): void {
    this.profileOpen.set(false);
    void this.router.navigateByUrl('/seguridad');
  }

  async logout(): Promise<void> {
    try {
      await this.auth.logout();
    } finally {
      await this.router.navigateByUrl('/login');
    }
  }
}
