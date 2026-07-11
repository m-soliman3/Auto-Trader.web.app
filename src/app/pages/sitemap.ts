import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../services/language.service';
import { LEARN_PAGES } from './learn/learn-detail';

@Component({
  selector: 'app-sitemap',
  standalone: true,
  imports: [RouterLink, CommonModule, TranslateModule],
  templateUrl: './sitemap.html',
  styleUrl: './sitemap.scss',
})
export class SitemapPage {
  languageService = inject(LanguageService);

  strategies = Object.values(LEARN_PAGES).filter(p => p.category === 'strategy');
  signals    = Object.values(LEARN_PAGES).filter(p => p.category === 'signal');
  blogPosts  = Object.values(LEARN_PAGES).filter(p => p.category === 'blog');

  localizedHref(...segments: string[]): string {
    return `/${[this.languageService.currentLang(), ...segments].join('/')}`;
  }

  localizedLink(...segments: string[]): string[] {
    return ['/', this.languageService.currentLang(), ...segments];
  }
}
