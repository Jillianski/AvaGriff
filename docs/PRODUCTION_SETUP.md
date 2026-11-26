# AvaGriff production setup — zero-purchase preparation

This repository contains preparation code, not a deployed production backend. No external account, paid plan, API key, payment account or store listing has been created.

## 1. Secure accounts and cloud sync

The initial database schema is in `supabase/migrations/001_initial_secure_schema.sql`.

To activate it:
1. The owner creates a Supabase project in an account they control. Review the current free-tier terms and limits before selecting a plan; no paid upgrade is required or authorized by this repository.
2. In the Supabase SQL editor, review and apply the migration.
3. Configure email confirmation, password reset redirect URLs, allowed origins, rate limits and any MFA requirements in Supabase Auth.
4. Keep the project URL and publishable/anon key in local environment configuration. Never place the service-role key in browser code, the app bundle or Git.
5. Add integration tests proving users cannot read or mutate another user's private rows or a household they do not belong to.
6. Implement and security-review server-side invite creation and acceptance, including single-use random tokens stored only as hashes, expiry, email matching and rate limiting. Do not expose raw invite tokens in analytics or logs.
7. Configure backups, retention, export and account deletion workflows before inviting real customers.

The SQL provides base tables and row-level security policies for profiles, households, membership, invitations, tasks, dates and subscription state. It does **not** implement signup screens, login, password reset, invitation emails, realtime sync, account deletion, billing webhooks or an operational backend. Do not treat schema presence as proof that these functions work.

### Important schema notes
- The household creator is automatically inserted as owner.
- Membership role changes are server-managed; client-side role escalation is not enabled.
- Subscription rows have read-only self access from clients. A trusted server/webhook must manage entitlements.
- Have a qualified security reviewer inspect the migration and policies before production. Run tests against two separate test users and two households.

## 2. Family Hub
Implement invite creation and acceptance in trusted server functions. Require authenticated household admins to invite; verify the recipient email and expiry on acceptance; make tokens single-use; prevent self-invites and privilege escalation. Add an audit trail for invitations, membership changes and shared record changes. Define household ownership transfer and leave/delete behavior before launch.

## 3. Premium subscriptions
Current proposed prices are experiments: $4.99/month and $39.99/year. The Plans screen is informational only. There is no checkout or feature gating.

Before web billing, choose a merchant/payment provider, create products/prices in the owner's account, implement server-created checkout sessions and signed webhook verification, handle renewals/cancellations/refunds/payment failures, and derive access from verified server-side subscription state. Never trust a client-supplied `plan` value.

For native iOS and Android apps, review the current Apple App Store and Google Play billing rules for digital subscriptions before choosing an in-app purchase implementation. Do not assume a web checkout link is permitted in every storefront or region. No billing provider is connected and no payments can be taken in this version.

## 4. iOS and Android preparation
Capacitor configuration and npm scripts are included. From a developer machine:
```sh
npm install
npm run build
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios
npx cap open android
```
The iOS build requires macOS and Xcode; Android requires Android Studio and an appropriate SDK. Native projects are not checked in yet. Validate safe-area layout, keyboard behavior, navigation, offline states, accessibility, push-notification permissions and secure token storage on physical devices. Store developer enrollment and any paid tooling require separate owner approval; none is purchased here.

## 5. Release gates
- Privacy policy, terms, support contact and data-retention/deletion policy reviewed.
- Threat model and independent security review completed.
- Auth, password reset, household invite and row-level isolation tests pass.
- Backups and restore test completed.
- Subscription webhooks and entitlement lifecycle tested in sandbox.
- Accessibility, performance, crash and device compatibility tests pass.
- App icon and splash assets exported in platform-specific sizes.
- Store metadata, screenshots, age ratings and privacy disclosures prepared.
- Trademark/name clearance completed before commercial release.

## Current state
- Existing browser demo still stores tasks and dates locally in the current browser.
- Supabase migration is a starter schema only; no project credentials exist in this repository.
- Pricing preview is not connected to checkout.
- Capacitor config/build scripts are preparation only; iOS and Android projects are not generated.
- No customer data has been migrated, no users can register through this code, and no family sharing or cross-device sync is active.
