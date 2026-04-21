import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { Home } from './pages/home';
import { Login } from './pages/login';
import { Signup } from './pages/signup';
import { Dashboard } from './pages/dashboard';
import { Contact } from './pages/contact';
import { TradeDetails } from './pages/tradeDetails';
import { Settings } from './pages/settings';
import { TermsPage } from './pages/terms';
import { PrivacyPage } from './pages/privacy';
import { DisclaimerPage } from './pages/disclaimer';
import { ExchangesPage } from './pages/exchanges';
import { BotsPage } from './pages/bots';
import { StrategiesPage } from './pages/strategies';
import { PortfolioManagementPage } from './pages/portfolio-management';
import { BackendRunnerPage } from './pages/backend-runner';
import { FeatureDetailPage } from './pages/features/feature-detail';
import { BillingCheckoutPage } from './pages/billing-checkout';
import { BillingManagePage } from './pages/billing-manage';
import { BinanceCallbackPage } from './pages/binance-callback';
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
  return mode === 'paper'
    ? 'Paper Trading Dashboard — AutoTrader | Simulate & Backtest Your Strategies'
    : 'Live Trading Dashboard — AutoTrader | Real-Time Strategy Execution';
};

const coreRoutes: Routes = [
  {
    path: '',
    component: Home,
    title: 'AutoTrader — Automate Your Trading Strategy with Smart Bots & AI Signals',
  },
  {
    path: 'login',
    component: Login,
    title: 'Login — AutoTrader | Access Your Automated Trading Platform',
  },
  {
    path: 'signup',
    component: Signup,
    title: 'Sign Up — AutoTrader | Start Automating Your Trades Today',
  },
  {
    path: 'auth/binance/callback',
    component: BinanceCallbackPage,
    title: 'Connecting Binance — AutoTrader',
  },
  {
    path: 'contact',
    component: Contact,
    title: 'Contact Us — AutoTrader | Trading Automation Support',
  },
  {
    path: 'terms',
    component: TermsPage,
    title: 'Terms of Service — AutoTrader | Trading Platform Terms & Conditions',
  },
  {
    path: 'privacy',
    component: PrivacyPage,
    title: 'Privacy Policy — AutoTrader | How We Protect Your Data',
  },
  {
    path: 'disclaimer',
    component: DisclaimerPage,
    title: 'Trading Risk Disclaimer — AutoTrader | Important Risk Disclosure',
  },
  {
    path: 'exchanges',
    component: ExchangesPage,
    canActivate: [authGuard],
    title: 'Connected Exchanges — AutoTrader | Manage 30+ Exchange Integrations',
  },
  {
    path: 'bots',
    component: BotsPage,
    canActivate: [authGuard],
    title: 'Trading Bots — AutoTrader | Create & Run Automated Strategy Bots',
  },
  {
    path: 'strategies',
    component: StrategiesPage,
    canActivate: [authGuard],
    title: 'Trading Strategies — AutoTrader | Build & Execute Strategy Automation',
  },
  {
    path: 'portfolio-management',
    component: PortfolioManagementPage,
    canActivate: [authGuard],
    title: 'Portfolio Management — AutoTrader | Track Performance & Live Holdings',
  },
  {
    path: 'backend-runner',
    component: BackendRunnerPage,
    canActivate: [authGuard],
    title: 'Strategy Runner — AutoTrader | Monitor Automated Execution Logs',
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
    title: 'Trade Details — AutoTrader | Strategy Execution Summary',
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
        title: 'Settings — AutoTrader | Account & Platform Preferences',
      },
    ],
  },
  {
    path: 'billing/checkout',
    component: BillingCheckoutPage,
    canActivate: [authGuard],
    title: 'Secure Checkout — AutoTrader | Upgrade to Premium',
  },
  {
    path: 'billing/manage',
    component: BillingManagePage,
    canActivate: [authGuard],
    title: 'Billing Management — AutoTrader | History & Subscription Controls',
  },
  {
    path: 'features/:slug',
    component: FeatureDetailPage,
    title: 'Feature — AutoTrader',
  },
];

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'en',
  },
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
