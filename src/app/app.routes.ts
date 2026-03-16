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
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: 'contact', component: Contact },
  { path: 'terms', component: TermsPage },
  { path: 'privacy', component: PrivacyPage },
  { path: 'disclaimer', component: DisclaimerPage },
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
