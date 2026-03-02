import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AuthService, User } from './services/auth.service';

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
        provideRouter([]),
        { provide: AuthService, useClass: MockAuthService },
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
    expect(compiled.textContent).toContain('AutoTrader');
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
    expect(toggle?.textContent).toContain('Real');
    expect(toggle?.textContent).toContain('Paper');
  });
});
