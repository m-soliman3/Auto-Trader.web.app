import { Injectable, inject } from '@angular/core';
import { TitleStrategy, RouterStateSnapshot } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  private currentTitleKey: string | undefined;

  constructor() {
    super();
    this.translate.onLangChange.subscribe(() => {
      if (this.currentTitleKey) {
        this.setTranslatedTitle(this.currentTitleKey);
      }
    });
  }

  override updateTitle(routerState: RouterStateSnapshot): void {
    const titleKey = this.buildTitle(routerState);
    if (!titleKey) {
      return;
    }
    this.currentTitleKey = titleKey;
    this.setTranslatedTitle(titleKey);
  }

  private setTranslatedTitle(key: string): void {
    this.translate.get(key).subscribe((translated: string) => {
      this.document.title = translated === key ? key : translated;
    });
  }
}
