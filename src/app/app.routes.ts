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
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: 'contact', component: Contact },
  { path: 'terms', component: TermsPage },
  { path: 'privacy', component: PrivacyPage },
  { path: 'disclaimer', component: DisclaimerPage },
  { path: 'exchanges', component: ExchangesPage, canActivate: [authGuard] },
  { path: 'bots', component: BotsPage, canActivate: [authGuard] },
  { path: 'strategies', component: StrategiesPage, canActivate: [authGuard] },
  { path: 'portfolio-management', component: PortfolioManagementPage, canActivate: [authGuard] },
  { path: 'backend-runner', component: BackendRunnerPage, canActivate: [authGuard] },
  { path: 'dashboard', pathMatch: 'full', redirectTo: 'dashboard/real' },
  { path: 'dashboard/:mode', component: Dashboard, canActivate: [authGuard] },
  { path: 'trade/:id', component: TradeDetails, canActivate: [authGuard] },
  {
    path: 'settings',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'display' },
      { path: ':section', component: Settings, canActivate: [authGuard] },
    ],
  },
  { path: '**', redirectTo: '' }
];
