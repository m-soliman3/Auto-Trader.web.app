import { Routes } from '@angular/router';
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
import { authGuard } from './guards/auth.guard';
import { ResolveFn } from '@angular/router';
import { ActivatedRouteSnapshot } from '@angular/router';

const dashboardTitleResolver: ResolveFn<string> = (route: ActivatedRouteSnapshot) => {
  const mode = route.paramMap.get('mode');
  return mode === 'paper'
    ? 'Paper Trading Dashboard — AutoTrader | Simulate & Backtest Your Strategies'
    : 'Live Trading Dashboard — AutoTrader | Real-Time Strategy Execution';
};

export const routes: Routes = [
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
    path: 'features/:slug',
    component: FeatureDetailPage,
    title: 'Feature — AutoTrader',
  },
  { path: '**', redirectTo: '' },
];
