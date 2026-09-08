import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { PaperOnboardingService } from './paper-onboarding.service';
import { RealMoneyOnboardingService } from './real-money-onboarding.service';

export interface TourStep {
  /** DOM element ID to spotlight. Null = centered (no spotlight). */
  anchorId: string | null;
  titleKey: string;
  descKey: string;
  /** Which side of the anchor element the tooltip appears on. */
  position: 'bottom' | 'top' | 'right' | 'left' | 'center';
}

export const TOUR_STEPS: TourStep[] = [
  {
    anchorId: null,
    titleKey: 'tour.step1Title',
    descKey: 'tour.step1Desc',
    position: 'center',
  },
  {
    anchorId: 'tour-portfolio',
    titleKey: 'tour.step2Title',
    descKey: 'tour.step2Desc',
    position: 'bottom',
  },
  {
    anchorId: 'tour-nav-exchanges',
    titleKey: 'tour.step3Title',
    descKey: 'tour.step3Desc',
    position: 'right',
  },
  {
    anchorId: 'tour-nav-bots',
    titleKey: 'tour.step4Title',
    descKey: 'tour.step4Desc',
    position: 'right',
  },
  {
    anchorId: 'tour-nav-strategies',
    titleKey: 'tour.step5Title',
    descKey: 'tour.step5Desc',
    position: 'right',
  },
  {
    anchorId: 'tour-quick-actions',
    titleKey: 'tour.step6Title',
    descKey: 'tour.step6Desc',
    position: 'top',
  },
  {
    anchorId: 'tour-nav-runner',
    titleKey: 'tour.step7Title',
    descKey: 'tour.step7Desc',
    position: 'right',
  },
];

@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly auth = inject(AuthService);
  private readonly paperOnboarding = inject(PaperOnboardingService);
  private readonly realMoneyOnboarding = inject(RealMoneyOnboardingService);

  readonly steps = TOUR_STEPS;
  readonly isActive = signal(false);
  readonly currentIndex = signal(0);

  readonly currentStep = computed(() => this.steps[this.currentIndex()]);
  readonly progress = computed(() => ({
    current: this.currentIndex() + 1,
    total: this.steps.length,
  }));
  readonly isLastStep = computed(() => this.currentIndex() === this.steps.length - 1);
  readonly isFirstStep = computed(() => this.currentIndex() === 0);

  /** True once the user has completed real-money OR paper-money onboarding. */
  readonly isOnboarded = computed(() => {
    const user = this.auth.currentUser();
    return !!(user?.realMoneyOnboarded || user?.paperOnboarded);
  });

  /** True while either onboarding modal is visible. */
  private readonly isAnyModalOpen = computed(
    () => this.paperOnboarding.needsOnboarding() || this.realMoneyOnboarding.needsOnboarding(),
  );

  /** Set to true by scheduleTourStart(); cleared once the modal closes and tour fires. */
  private readonly pendingTour = signal(false);

  constructor() {
    // Fire the first-visit tour as soon as all onboarding modals are gone.
    effect(() => {
      if (this.pendingTour() && !this.isAnyModalOpen()) {
        this.pendingTour.set(false);
        this.startIfFirstVisit();
      }
    });
  }

  /**
   * Request a first-visit tour start.
   * If an onboarding modal is currently open it defers until the modal closes;
   * otherwise starts immediately.
   */
  scheduleTourStart(): void {
    if (!this.isAnyModalOpen()) {
      this.startIfFirstVisit();
    } else {
      this.pendingTour.set(true);
    }
  }

  /** Starts the tour from step 0. */
  start(): void {
    this.currentIndex.set(0);
    this.isActive.set(true);
  }

  next(): void {
    const next = this.currentIndex() + 1;
    if (next < this.steps.length) {
      this.currentIndex.set(next);
    } else {
      this.end();
    }
  }

  prev(): void {
    const prev = this.currentIndex() - 1;
    if (prev >= 0) {
      this.currentIndex.set(prev);
    }
  }

  end(): void {
    this.isActive.set(false);
    this.markSeen();
  }

  /** Starts the tour only if the user has never seen it before. */
  startIfFirstVisit(): void {
    if (!this.hasSeenTour()) {
      this.start();
    }
  }

  hasSeenTour(): boolean {
    return this.auth.currentUser()?.tourCompleted === true;
  }

  private markSeen(): void {
    void this.auth.markTourCompleted();
  }
}
