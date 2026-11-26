# AvaGriff — Plan. Focus. Thrive.

AvaGriff is a responsive personal-life organizer concept for individuals and families, based on the founder's supplied product reference artwork.

## Product direction

The supplied reference establishes the product identity:
- AvaGriff wordmark in gold on a royal-purple sky.
- The founder-approved white-headed, golden-winged griffin wearing a royal-purple cape and gold A medallion.
- Mobile and tablet experiences sharing one visual language.
- Core navigation: Dashboard, My Tasks, Family Hub, Calendar, Rewards and Settings.
- Dashboard cards for tasks, upcoming events, goal progress and streaks.
- Family activity, daily encouragement and reward moments.

## Current code status

Implemented in this web preview:
- Responsive dashboard layout inspired by the supplied phone/tablet concept.
- My Tasks: add, complete and delete tasks.
- Calendar: add and delete important dates.
- Local browser storage for personal demo data.
- Responsive navigation and PWA manifest.

Not yet implemented:
- The founder-approved griffin artwork is committed at `assets/avagriff-griffin.webp` and is used in the mobile brand header, dashboard mascot area, favicon and loading screen. The service worker caches the mascot asset for repeat/offline visits.
- User registration/sign-in, password recovery, cloud synchronization or family sharing. The starter Supabase schema is in `supabase/migrations/001_initial_secure_schema.sql`; it is not activated and has not been security-reviewed.
- Real family activity feed, invitations, household roles or notifications.
- Rewards, points, badges, streak calculations or purchases.
- Payment processing, subscription enforcement, analytics, backups or native app-store builds. Capacitor preparation files are present, but iOS/Android projects still need to be generated and tested.

The task and date demo data is stored only in the current browser/device. Clearing browser site data may erase it. Avoid entering sensitive information. This preview is not ready for paid customer launch.

## Deploy with GitHub Pages

1. Open repository Settings → Pages.
2. Set Build and deployment source to GitHub Actions.
3. Ensure repository Actions permissions allow deployment.
4. Push to the default branch or run the Pages workflow.
5. Confirm a successful workflow and open the published URL in Settings → Pages.

## Initial monetization experiment

- Free plan: $0, with the current personal task and important-date preview.
- Premium monthly: proposed $4.99/month.
- Premium annual: proposed $39.99/year (about 33% less than paying monthly for 12 months).
- The Plans & Pricing screen is a non-transactional preview only. It stores a plan selection locally; there is no checkout, subscription, customer account or paid feature gating. Prices are hypotheses to validate with users, not guaranteed revenue.

## Zero-cost technical preparation

- Supabase starter schema with row-level security policies: `supabase/migrations/001_initial_secure_schema.sql`.
- Backend activation, secure invitations, billing and mobile release checklist: `docs/PRODUCTION_SETUP.md`.
- Capacitor configuration and static web build script: `capacitor.config.json`, `scripts/build.mjs`.
- Local setup template: `.env.example` (contains no credentials).

No backend project, payment provider, app-store account, API key or paid service has been created or connected. Do not enter customer information in the browser demo.

## Production roadmap

1. Confirm final artwork export dimensions and prepare dedicated square 512px/1024px store icons plus platform-specific splash screens; the current approved WebP is used in the web app.
2. Validate the product with real individual and family users.
3. Implement secure accounts, a production database, cloud sync and data export/deletion.
4. Implement family invitations, household permissions and shared activity.
5. Add tested reminders, rewards and accessibility support.
6. Complete privacy, security, trademark and legal reviews.
7. Test pricing and willingness to pay before enabling subscriptions.
8. Build and submit iOS and Android apps after production testing.

Keep all repository, domain, hosting, backend, payment and app-store accounts under the founder's control. Do not activate paid services without explicit approval.
