import admin from 'firebase-admin';
import { config } from './config';

function resolveCredential(): admin.credential.Credential {
  const raw = config.firebaseServiceAccountJson;
  if (!raw) {
    return admin.credential.applicationDefault();
  }

  const parsed = JSON.parse(raw) as admin.ServiceAccount;
  return admin.credential.cert(parsed);
}

const existing = admin.apps.find((app): app is admin.app.App => !!app && app.name === config.firebaseAppName);
const firebaseApp = existing ?? admin.initializeApp(
  {
    credential: resolveCredential(),
    projectId: config.firebaseProjectId,
  },
  config.firebaseAppName,
);

export const auth = admin.auth(firebaseApp);
