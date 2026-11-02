# Setting up Firebase

Firebase gives the project real sign-in (email and password, or Google) and push notifications. Photos and builder previews don't use Firebase: they go to our own API (`POST /uploads`), so **no card or billing is needed**. Stay on the free **Spark** plan and don't upgrade.

Until this is done, everything keeps working with the test login (`AUTH_DEV_BYPASS=true`).

Do this once, with a Google account the team can keep using after the course (not a personal account someone might lose access to). About 20 minutes.

## 1. Create the project

1. Go to <https://console.firebase.google.com> and click **Create a project**.
2. Name it `bakery-orders`. Google Analytics isn't needed; you can turn it off.
3. When it's ready, check the plan in the bottom left says **Spark**.

## 2. Turn on sign-in

1. **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Email/Password** (only the first switch, not "Email link").
3. Enable **Google** too. Pick a support email and save.
4. Under **Settings → Authorized domains**, `localhost` is already there. If you use Codespaces, add your codespace's dashboard address too (copy it from the browser, it looks like `something-5173.app.github.dev`). Each codespace has its own address.

Don't enable **Phone**: text messages cost money.

5. Add the production dashboard's domain under **Authorized domains** too. The emails below link back to it, and Firebase refuses links to domains that aren't listed.

### The emails Firebase sends

The dashboard uses Firebase's own emails, so no email service is needed:

- **Email address verification**, sent when someone creates a dashboard account. Bakeries only add staff and owners by a verified email.
- **Password reset**, also sent when an admin approves a bakery application. The backend creates the applicant's account, and this email lets them choose a password.

Under **Authentication → Templates** you can reword them. Worth doing for **Password reset**, since new owners get it as their welcome: for example a subject like "Set up your bakery account" and a line saying their application was approved.

## 3. Add the dashboard (web app)

1. **Project settings** (the gear next to Project Overview) → **Your apps** → the **Web** icon (`</>`).
2. Nickname `dashboard`. Don't tick Firebase Hosting. Click **Register app**.
3. Firebase shows a `firebaseConfig` with `apiKey`, `authDomain`, `projectId`, `messagingSenderId` and `appId`. **Send these five values** to whoever is wiring up sign-in, or put them in `dashboard/.env.local` (see `dashboard/.env.example`).

These values aren't secret: they end up in every visitor's browser anyway. Sign-in is protected by the authorized domains list instead.

## 4. Push notifications for the dashboard

1. **Project settings → Cloud Messaging**.
2. Under **Web configuration → Web Push certificates**, click **Generate key pair**.
3. Copy the key that appears. It goes in `dashboard/.env.local` as `VITE_FIREBASE_VAPID_KEY`. Also safe to share.

## 5. Add the Android app

1. **Project settings → Your apps → Add app → Android**.
2. Package name: `com.bakeryorders.bakery_orders` (it has to match exactly).
3. **Debug signing certificate SHA-1**: needed for Google sign-in. On the computer that builds the app, run:
   ```bash
   cd mobile/android && ./gradlew signingReport
   ```
   Copy the `SHA1` line under `Variant: debug`. **Each teammate who builds the app has their own**, so add everyone's later under the Android app's settings (**Add fingerprint**).
4. Download **`google-services.json`** and put it in `mobile/android/app/`. It's in `.gitignore`, so share it with teammates directly (it isn't secret, it's just tied to this project).

iOS can wait until someone has a Mac.

## 6. Let the backend check sign-ins

**This file is secret.** Never paste it in chat, commit it, or upload it anywhere.

1. **Project settings → Service accounts → Generate new private key**.
2. Save the file as `backend/secrets/firebase-service-account.json` (the `secrets` folder is ignored by git).
3. In `backend/.env`, uncomment and set:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=./secrets/firebase-service-account.json
   ```
4. Only the computer or server running the backend needs it. If you lose it or it leaks, delete the key on the same page and make a new one.

## 7. Switch to real sign-in

1. In `backend/.env`, set `AUTH_DEV_BYPASS=false` and restart the backend.
2. In `dashboard/.env.local`, remove `VITE_DEV_USER`. In the app, run with `--dart-define=DEV_USER=` (empty).
3. Sign in to the dashboard once with your email. You'll see "You're not on a bakery's staff yet". That's expected.
4. Make yourself the owner of the pilot bakery:
   ```bash
   cd backend && npm run make-owner -- you@example.com sweet-crumbs
   ```
5. Reload the dashboard. From **Settings → Staff**, you can now add teammates (they need to sign in once first).

To grant the first platform administrator access to bakery onboarding, run this against the production database after that account has signed in once:

```bash
cd backend
npm run make-admin -- you@example.com
```

The dashboard route is `/admin/applications`. The backend still requires a Firebase ID token and the user's database role to be `ADMIN`; knowing the URL alone does not grant access.

## What to send, and what not to

| Item | Safe to share in the team chat? |
|---|---|
| Web config (`apiKey`, `authDomain`, `projectId`, `messagingSenderId`, `appId`) | Yes |
| Web Push key (VAPID) | Yes |
| `google-services.json` | Yes, but keep it out of git |
| Service account `.json` | **No.** Copy it to the backend computer directly |
