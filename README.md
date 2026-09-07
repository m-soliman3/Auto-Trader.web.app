# Invest-Begin.com
## Backend / Firestore setup

This project now persists user data (accounts, exchanges, bots, saved strategies) in Firebase Firestore instead of `localStorage`.
To finish the migration:

1. **Enable Firestore** in the Firebase console for the project.
2. Use the following security rules to restrict access to each user's own documents:

```firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // you may want a top-level "users/{userId}" doc as well for savedStrategies
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Deploy the rules with `firebase deploy --only firestore:rules`.

Once Firestore is active, the Angular app will automatically read/write data under `users/{uid}`.

## Building & Deployment

After making changes:

```bash
npm install          # ensure dependencies are up to date
npm run build        # compile Angular
firebase deploy      # deploy hosting (and functions/rules if configured)
```

For rules only use `firebase deploy --only firestore:rules`.

## Parallel Staging App (Safe Feature Testing)

This repository supports a parallel staging web app using a separate Firebase Hosting target.

One-time setup (already wired in config files, run only once per Firebase project):

```bash
# Create a separate hosting site for staging
firebase hosting:sites:create autotrader-b8851-staging

# Ensure target mappings are applied (if needed)
firebase target:apply hosting prod autotrader-b8851
firebase target:apply hosting staging autotrader-b8851-staging
```

Deploy commands:

```bash
# Production app (main branch)
npm run deploy:prod

# Parallel staging app (feature/staging branch)
npm run deploy:staging

# Optional temporary preview channel on staging target
npm run deploy:staging:preview
```

Recommended branch flow:

- Use `main` for production deployments.
- Use a dedicated branch (for example `staging` or `develop`) for testing new features.
- Deploy that branch to the staging target so production remains unchanged.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.1.5.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## MCP Server
We have created an MCP Server that can be used by AI for analysis of stocks, Forex and Crypto.
to connect, add MCP server connector with URL : https://www.invest-begin.com/mcp
We are published on Smithery: https://smithery.ai/servers/invest-begin/investBegin-TradeAnalyzer

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

