import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ThemeService } from '../services/theme.service';
import { DashboardLayoutService, DashboardSectionDefinition, DashboardSectionId } from '../services/dashboard-layout.service';

const DEFAULT_DASHBOARD_SECTION_ORDER: DashboardSectionId[] = [
  'connectedExchanges',
  'strategies',
  'bots',
  'mainGrid',
  'portfolioPerformance',
];

type SettingsSectionId = 'display' | 'account' | 'security' | 'billing' | 'legal';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class Settings {
  auth = inject(AuthService);
  theme = inject(ThemeService);
  dashboardLayout = inject(DashboardLayoutService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  newEmail = signal('');
  emailStatus = signal('');
  emailError = signal('');
  emailLoading = signal(false);

  resetStatus = signal('');
  resetError = signal('');
  resetLoading = signal(false);
  billingStatus = signal('');
  activeSection = signal<SettingsSectionId>('display');

  draftTheme = signal<'dark' | 'light'>(this.theme.themeName());
  draftDashboardSections = signal<DashboardSectionDefinition[]>(this.cloneSections(this.dashboardLayout.sections()));

  themeLabel = computed(() => this.draftTheme() === 'dark' ? 'Dark' : 'Bright');
  dashboardSections = computed(() => this.draftDashboardSections());
  displayDirty = computed(() => {
    if (this.draftTheme() !== this.theme.themeName()) {
      return true;
    }

    const persisted = this.dashboardLayout.sections();
    const draft = this.draftDashboardSections();
    if (persisted.length !== draft.length) {
      return true;
    }

    return persisted.some((section, index) => {
      const draftSection = draft[index];
      return !draftSection || draftSection.id !== section.id || draftSection.visible !== section.visible;
    });
  });

  draggingSectionId = signal<DashboardSectionId | null>(null);
  dropTargetSectionId = signal<DashboardSectionId | null>(null);
  saveToastMessage = signal('');
  private saveToastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const section = params.get('section');
        if (this.isSettingsSection(section)) {
          this.activeSection.set(section);
          return;
        }

        void this.router.navigate(['/settings', 'display'], { replaceUrl: true });
      });
  }

  setTheme(theme: 'dark' | 'light') {
    this.draftTheme.set(theme);
  }

  setDashboardSectionVisible(sectionId: DashboardSectionId, visible: boolean) {
    this.draftDashboardSections.update((sections) =>
      sections.map((section) =>
        section.id === sectionId ? { ...section, visible } : section,
      ),
    );
  }

  moveDashboardSectionUp(sectionId: DashboardSectionId) {
    this.draftDashboardSections.update((sections) => {
      const index = sections.findIndex((section) => section.id === sectionId);
      if (index <= 0) return sections;
      const next = [...sections];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  moveDashboardSectionDown(sectionId: DashboardSectionId) {
    this.draftDashboardSections.update((sections) => {
      const index = sections.findIndex((section) => section.id === sectionId);
      if (index < 0 || index >= sections.length - 1) return sections;
      const next = [...sections];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  canMoveDashboardSectionUp(sectionId: DashboardSectionId): boolean {
    return this.draftDashboardSections().findIndex((section) => section.id === sectionId) > 0;
  }

  canMoveDashboardSectionDown(sectionId: DashboardSectionId): boolean {
    const sections = this.draftDashboardSections();
    const index = sections.findIndex((section) => section.id === sectionId);
    return index >= 0 && index < sections.length - 1;
  }

  resetDashboardLayout() {
    const byId = new Map(this.dashboardLayout.sections().map((section) => [section.id, section]));
    this.draftDashboardSections.set(
      DEFAULT_DASHBOARD_SECTION_ORDER.map((id) => {
        const source = byId.get(id);
        return {
          id,
          label: source?.label ?? id,
          description: source?.description ?? '',
          visible: true,
        };
      }),
    );
  }

  onSectionDragStart(event: DragEvent, sectionId: DashboardSectionId) {
    this.draggingSectionId.set(sectionId);
    this.dropTargetSectionId.set(null);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', sectionId);
    }
  }

  onSectionDragOver(event: DragEvent, sectionId: DashboardSectionId) {
    if (!this.draggingSectionId() || this.draggingSectionId() === sectionId) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dropTargetSectionId.set(sectionId);
  }

  onSectionDrop(event: DragEvent, sectionId: DashboardSectionId) {
    event.preventDefault();
    const draggingId = this.draggingSectionId();
    if (!draggingId || draggingId === sectionId) {
      this.onSectionDragEnd();
      return;
    }

    this.draftDashboardSections.update((sections) => {
      const fromIndex = sections.findIndex((section) => section.id === draggingId);
      const toIndex = sections.findIndex((section) => section.id === sectionId);
      if (fromIndex < 0 || toIndex < 0) return sections;
      const next = [...sections];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    this.onSectionDragEnd();
  }

  onSectionDragLeave(event: DragEvent, sectionId: DashboardSectionId) {
    const target = event.currentTarget as HTMLElement | null;
    const related = event.relatedTarget as Node | null;
    if (target && related && target.contains(related)) {
      return;
    }

    if (this.dropTargetSectionId() === sectionId) {
      this.dropTargetSectionId.set(null);
    }
  }

  onSectionDragEnd() {
    this.draggingSectionId.set(null);
    this.dropTargetSectionId.set(null);
  }

  sectionDragLabel(section: DashboardSectionDefinition): string {
    return `Drag to reorder ${section.label}`;
  }

  setSection(event: Event, sectionId: SettingsSectionId) {
    event.preventDefault();
    event.stopPropagation();
    if (this.activeSection() === sectionId) {
      return;
    }

    void this.router.navigate(['/settings', sectionId]);
  }

  saveDisplaySettings() {
    this.theme.setTheme(this.draftTheme());
    this.dashboardLayout.replaceLayout(
      this.draftDashboardSections().map((section) => ({
        id: section.id,
        visible: section.visible,
      })),
    );
    this.syncDisplayDraftFromPersisted();
    this.showSaveToast('Settings saved.');
  }

  cancelDisplaySettings() {
    this.syncDisplayDraftFromPersisted();
  }

  async changeEmail() {
    this.emailStatus.set('');
    this.emailError.set('');
    this.emailLoading.set(true);

    const result = await this.auth.changeEmailAddress(this.newEmail());
    this.emailLoading.set(false);

    if (result) {
      this.emailError.set(result);
      return;
    }

    this.emailStatus.set('Verification email sent to your new address. Confirm it to complete the change.');
    this.newEmail.set('');
  }

  async sendResetEmail() {
    this.resetStatus.set('');
    this.resetError.set('');
    this.resetLoading.set(true);

    const result = await this.auth.sendPasswordResetForCurrentUser();
    this.resetLoading.set(false);

    if (result) {
      this.resetError.set(result);
      return;
    }

    this.resetStatus.set('Password reset email sent. Check your inbox.');
  }

  triggerDummyCheckout() {
    this.billingStatus.set('Demo checkout only: no payment was processed. Premium activation is handled manually by admin.');
  }

  private syncDisplayDraftFromPersisted() {
    this.draftTheme.set(this.theme.themeName());
    this.draftDashboardSections.set(this.cloneSections(this.dashboardLayout.sections()));
    this.onSectionDragEnd();
  }

  private cloneSections(sections: DashboardSectionDefinition[]): DashboardSectionDefinition[] {
    return sections.map((section) => ({ ...section }));
  }

  closeSaveToast() {
    this.saveToastMessage.set('');
    if (this.saveToastTimer) {
      clearTimeout(this.saveToastTimer);
      this.saveToastTimer = null;
    }
  }

  private showSaveToast(message: string) {
    this.saveToastMessage.set(message);
    if (this.saveToastTimer) {
      clearTimeout(this.saveToastTimer);
    }

    this.saveToastTimer = setTimeout(() => {
      this.saveToastMessage.set('');
      this.saveToastTimer = null;
    }, 3500);
  }

  private isSettingsSection(value: string | null): value is SettingsSectionId {
    return value === 'display' || value === 'account' || value === 'security' || value === 'billing' || value === 'legal';
  }
}
