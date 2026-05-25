import { bootstrapApplication } from '@angular/platform-browser';
import type { BootstrapContext } from '@angular/platform-browser';
import { App } from './app/app';
import { config } from './app/app.config.server';

// @angular/ssr calls this function and passes { platformRef } so that
// bootstrapApplication uses the server platform instead of the browser platform.
const bootstrap = (context?: BootstrapContext) => bootstrapApplication(App, config, context);

export default bootstrap;
