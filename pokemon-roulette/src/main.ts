/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    // Lightweight runtime caching for remote sprites/audio used by this project.
    // (Kept as a plain JS SW in /public so it works on GitHub Pages without extra config.)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('./sw.js', { scope: './' })
        .catch((err) => console.error('SW registration failed', err));
    }
  })
  .catch((err) => console.error(err));
