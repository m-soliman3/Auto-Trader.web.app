import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Navbar } from './navbar';
import { AuthService, User } from '../services/auth.service';
import { ThemeService } from '../services/theme.service';
import { AccountMode, AccountModeService } from '../services/account-mode.service';

@Component({ template: '', standalone: true })
class DummyPage {}

class MockAuthService {
  private readonly user = signal<User | null>(null);
  currentUser = computed(() => this.user());
  isLoggedIn = computed(() => this.user() !== null);

  async logout() {}

  setUser(user: User | null) {
    this.user.set(user);
  }
}

class MockThemeService {
  isDark = signal(true);

  toggle() {
    this.isDark.update(v => !v);
  }

  themeName(): 'dark' | 'light' {
    return this.isDark() ? 'dark' : 'light';
  }
}

class MockAccountModeService {
  private readonly modeSignal = signal<AccountMode>('real');
  mode = computed(() => this.modeSignal());

  setMode(mode: AccountMode) {
    this.modeSignal.set(mode);
  }
}

describe('Navbar interactions', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        provideRouter([
          { path: '', component: DummyPage },
          { path: 'dashboard', component: DummyPage },
          { path: 'settings', component: DummyPage },
          { path: 'login', component: DummyPage },
          { path: 'signup', component: DummyPage },
        ]),
        ...provideTranslateService({ fallbackLang: 'en' }),
        { provide: AuthService, useClass: MockAuthService },
        { provide: ThemeService, useClass: MockThemeService },
        { provide: AccountModeService, useClass: MockAccountModeService },
      ],
    }).compileComponents();
  });

  function setupLoggedInNavbar() {
    const auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    auth.setUser({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      createdAt: new Date().toISOString(),
    });

    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
    return fixture;
  }

  it('closes the user menu when clicking outside the navbar', () => {
    const fixture = setupLoggedInNavbar();
    const compiled = fixture.nativeElement as HTMLElement;

    const trigger = compiled.querySelector('.user-menu-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    expect(compiled.querySelector('.user-menu')).not.toBeNull();

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(compiled.querySelector('.user-menu')).toBeNull();
  });

  it('closes menus when pressing Escape', () => {
    const fixture = setupLoggedInNavbar();
    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    component.menuOpen.set(true);
    component.userMenuOpen.set(true);
    fixture.detectChanges();
    expect(compiled.querySelector('.user-menu')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(component.menuOpen()).toBe(false);
    expect(component.userMenuOpen()).toBe(false);
    expect(compiled.querySelector('.user-menu')).toBeNull();
  });

  it('closes open menus after route navigation', async () => {
    const fixture = setupLoggedInNavbar();
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);

    component.menuOpen.set(true);
    component.userMenuOpen.set(true);
    fixture.detectChanges();

    await router.navigateByUrl('/settings');
    fixture.detectChanges();

    expect(component.menuOpen()).toBe(false);
    expect(component.userMenuOpen()).toBe(false);
  });
});
