import {
  Component,
  DestroyRef,
  HostListener,
  OnDestroy,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TourService, TourStep } from '../services/tour.service';

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TooltipPos {
  top: string;
  left: string;
  transform: string;
}

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './tour-overlay.html',
  styleUrl: './tour-overlay.scss',
})
export class TourOverlay implements OnDestroy {
  readonly tour = inject(TourService);

  readonly spotlightRect = signal<SpotlightRect | null>(null);
  readonly tooltipPos = signal<TooltipPos>({
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  });

  private positionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Re-position the spotlight every time the active step changes.
    effect(() => {
      const active = this.tour.isActive();
      const _idx = this.tour.currentIndex(); // read to react
      if (active) {
        this.schedulePositionUpdate();
      } else {
        this.spotlightRect.set(null);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.positionTimer) clearTimeout(this.positionTimer);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.tour.isActive()) {
      this.schedulePositionUpdate();
    }
  }

  private schedulePositionUpdate(): void {
    if (this.positionTimer) clearTimeout(this.positionTimer);
    // Small delay so that the DOM has updated after the step signal change.
    this.positionTimer = setTimeout(() => this.updatePosition(), 60);
  }

  private updatePosition(): void {
    const step = this.tour.currentStep();
    if (!step) return;

    if (!step.anchorId) {
      // Centered step — no spotlight
      this.spotlightRect.set(null);
      this.tooltipPos.set({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      });
      return;
    }

    const el = document.getElementById(step.anchorId);
    if (!el) {
      // Element not in DOM (section may be hidden) — center the tooltip
      this.spotlightRect.set(null);
      this.tooltipPos.set({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      });
      return;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Wait for any scroll animation before computing rects.
    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      const pad = 8;

      this.spotlightRect.set({
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      });

      this.tooltipPos.set(this.computeTooltipPos(rect, step.position, pad));
    }, 320);
  }

  private computeTooltipPos(rect: DOMRect, pos: TourStep['position'], pad: number): TooltipPos {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 14;
    const tooltipWidth = 310;

    switch (pos) {
      case 'bottom': {
        const rawLeft = rect.left + rect.width / 2;
        const clampedLeft = Math.max(tooltipWidth / 2 + 8, Math.min(rawLeft, vw - tooltipWidth / 2 - 8));
        const rawTop = rect.bottom + pad + gap;
        const clampedTop = Math.min(rawTop, vh - 220);
        return {
          top: `${clampedTop}px`,
          left: `${clampedLeft}px`,
          transform: 'translateX(-50%)',
        };
      }
      case 'top': {
        const rawLeft = rect.left + rect.width / 2;
        const clampedLeft = Math.max(tooltipWidth / 2 + 8, Math.min(rawLeft, vw - tooltipWidth / 2 - 8));
        const rawTop = rect.top - pad - gap;
        const clampedTop = Math.max(80, rawTop);
        return {
          top: `${clampedTop}px`,
          left: `${clampedLeft}px`,
          transform: 'translate(-50%, -100%)',
        };
      }
      case 'right': {
        const rawTop = rect.top + rect.height / 2;
        const clampedTop = Math.max(80, Math.min(rawTop, vh - 220));
        const rawLeft = rect.right + pad + gap;
        const clampedLeft = Math.min(rawLeft, vw - tooltipWidth - 8);
        return {
          top: `${clampedTop}px`,
          left: `${clampedLeft}px`,
          transform: 'translateY(-50%)',
        };
      }
      case 'left': {
        const rawTop = rect.top + rect.height / 2;
        const clampedTop = Math.max(80, Math.min(rawTop, vh - 220));
        return {
          top: `${clampedTop}px`,
          left: `${rect.left - pad - gap}px`,
          transform: 'translate(-100%, -50%)',
        };
      }
      default:
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  }
}
