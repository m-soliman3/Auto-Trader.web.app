import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { Home } from './pages/home';
import { Login } from './pages/login';
import { Signup } from './pages/signup';
import { SignupGuide } from './pages/signup-guide';
import { Dashboard } from './pages/dashboard';
import { Contact } from './pages/contact';
import { TradeDetails } from './pages/tradeDetails';
import { Settings } from './pages/settings';
import { TermsPage } from './pages/terms';
import { PrivacyPage } from './pages/privacy';
import { DisclaimerPage } from './pages/disclaimer';
import { ExchangesPage } from './pages/exchanges';
import { StrategiesPage } from './pages/strategies';
import { PortfolioManagementPage } from './pages/portfolio-management';
import { BackendRunnerPage } from './pages/backend-runner';
import { FeatureDetailPage } from './pages/features/feature-detail';
import { BillingCheckoutPage } from './pages/billing-checkout';
import { BillingManagePage } from './pages/billing-manage';
import { CollectingDataPage } from './pages/collecting-data';
import { SitemapPage } from './pages/sitemap';
import { LearnDetailPage } from './pages/learn/learn-detail';
import { authGuard } from './guards/auth.guard';
import { ResolveFn } from '@angular/router';
import { ActivatedRouteSnapshot } from '@angular/router';
import { LANGUAGES } from './services/language.service';

const SUPPORTED_LANG_CODES = new Set(LANGUAGES.map((lang) => lang.code));

export function languagePrefixMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments.length === 0) {
    return null;
  }

  const [first] = segments;
  if (!SUPPORTED_LANG_CODES.has(first.path)) {
    return null;
  }

  return {
    consumed: [first],
    posParams: {
      lang: first,
    },
  };
}

const dashboardTitleResolver: ResolveFn<string> = (route: ActivatedRouteSnapshot) => {
  const mode = route.paramMap.get('mode');
  return mode === 'paper' ? 'pageTitle.dashboardPaper' : 'pageTitle.dashboardReal';
};

const coreRoutes: Routes = [
  {
    path: '',
    component: Home,
    title: 'pageTitle.home',
  },
  {
    path: 'login',
    component: Login,
    title: 'pageTitle.login',
  },
  {
    path: 'signup',
    component: Signup,
    title: 'pageTitle.signup',
  },
  {
    path: 'signup-guide',
    component: SignupGuide,
    title: 'pageTitle.signupGuide',
  },
  {
    path: 'contact',
    component: Contact,
    title: 'pageTitle.contact',
  },
  {
    path: 'terms',
    component: TermsPage,
    title: 'pageTitle.terms',
  },
  {
    path: 'privacy',
    component: PrivacyPage,
    title: 'pageTitle.privacy',
  },
  {
    path: 'disclaimer',
    component: DisclaimerPage,
    title: 'pageTitle.disclaimer',
  },
  {
    path: 'collecting-data',
    component: CollectingDataPage,
    title: 'pageTitle.collectingData',
  },
  {
    path: 'exchanges',
    component: ExchangesPage,
    canActivate: [authGuard],
    title: 'pageTitle.exchanges',
  },
  {
    path: 'bots',
    redirectTo: 'strategies',
    pathMatch: 'full',
  },
  {
    path: 'strategies',
    component: StrategiesPage,
    canActivate: [authGuard],
    title: 'pageTitle.strategies',
  },
  {
    path: 'portfolio-management',
    component: PortfolioManagementPage,
    canActivate: [authGuard],
    title: 'pageTitle.portfolioManagement',
  },
  {
    path: 'backend-runner',
    component: BackendRunnerPage,
    canActivate: [authGuard],
    title: 'pageTitle.backendRunner',
  },
  { path: 'dashboard', pathMatch: 'full', redirectTo: 'dashboard/real' },
  {
    path: 'dashboard/:mode',
    component: Dashboard,
    canActivate: [authGuard],
    title: dashboardTitleResolver,
  },
  {
    path: 'trade/:id',
    component: TradeDetails,
    canActivate: [authGuard],
    title: 'pageTitle.tradeDetails',
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'display' },
      {
        path: ':section',
        component: Settings,
        canActivate: [authGuard],
        title: 'pageTitle.settings',
      },
    ],
  },
  {
    path: 'billing/checkout',
    component: BillingCheckoutPage,
    canActivate: [authGuard],
    title: 'pageTitle.billingCheckout',
  },
  {
    path: 'billing/manage',
    component: BillingManagePage,
    canActivate: [authGuard],
    title: 'pageTitle.billingManage',
  },
  {
    path: 'features/:slug',
    component: FeatureDetailPage,
    title: 'pageTitle.feature',
  },
  {
    path: 'knowledge-base',
    component: SitemapPage,
    title: 'pageTitle.sitemap',
  },
  {
    path: 'learn/:slug',
    component: LearnDetailPage,
    title: 'pageTitle.learn',
  },
  {
    path: 'blog/:slug',
    component: LearnDetailPage,
    title: 'pageTitle.blog',
  },
];

export const routes: Routes = [
  {
    matcher: languagePrefixMatcher,
    children: [
      ...coreRoutes,
      { path: '**', redirectTo: '' },
    ],
  },
  ...coreRoutes,
  { path: '**', redirectTo: 'en' },
];
