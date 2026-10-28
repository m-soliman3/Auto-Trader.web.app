import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { provideTranslateService } from '@ngx-translate/core';
import { App } from './app';
import { AuthService, User } from './services/auth.service';
import { UsageAnalyticsService } from './services/usage-analytics.service';

class MockAuthService {
  private readonly user = signal<User | null>(null);
  currentUser = computed(() => this.user());
  isLoggedIn = computed(() => this.user() !== null);

  logout() {}

  setUser(user: User | null) {
    this.user.set(user);
  }
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        // LanguageService redirects to the locale prefix (/en) on boot; let any URL match.
        provideRouter([{ path: '**', children: [] }]),
        ...provideTranslateService({ fallbackLang: 'en' }),
        { provide: Auth, useValue: { currentUser: null } },
        // Several services the shell pulls in (tour, onboarding, exchanges) inject Firestore.
        { provide: Firestore, useValue: {} },
        { provide: AuthService, useClass: MockAuthService },
        // App injects this eagerly at boot, and it writes visits to Firestore on navigation.
        { provide: UsageAnalyticsService, useValue: {} },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render navbar brand', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('auto-Trading');
  });

  it('should hide account mode switch when logged out', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.account-mode-toggle')).toBeNull();
  });

  it('should show account mode switch when logged in', async () => {
    const auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    auth.setUser({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      createdAt: new Date().toISOString(),
    });

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector('.account-mode-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle?.textContent).toContain('nav.real');
    expect(toggle?.textContent).toContain('nav.paper');
  });
});
