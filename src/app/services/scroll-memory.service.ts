import { inject, Injectable } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class ScrollMemoryService {
  private readonly router = inject(Router);
  private readonly viewportScroller = inject(ViewportScroller);

  private readonly scrollPositions = new Map<string, [number, number]>();
  private currentUrl = this.router.url;

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationStart || event instanceof NavigationEnd))
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.scrollPositions.set(this.currentUrl, this.viewportScroller.getScrollPosition());
          return;
        }

        const nextUrl = event.urlAfterRedirects;
        this.currentUrl = nextUrl;

        const urlTree = this.router.parseUrl(nextUrl);
        if (urlTree.fragment) {
          queueMicrotask(() => this.viewportScroller.scrollToAnchor(urlTree.fragment!));
          return;
        }

        const savedPosition = this.scrollPositions.get(nextUrl);
        queueMicrotask(() => {
          if (savedPosition) {
            this.viewportScroller.scrollToPosition(savedPosition);
            return;
          }
          this.viewportScroller.scrollToPosition([0, 0]);
        });
      });
  }
}
