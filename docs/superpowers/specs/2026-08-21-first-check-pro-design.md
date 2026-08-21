# First Check Pro 1.1 Design

Date: 2026-08-21
Status: Approved design, pending implementation plan

## Purpose

First Check Pro 1.1 adds a small, reliable subscription layer to the existing First Check mobile app without redesigning the product or expanding scope unnecessarily. The goal is to monetize the strongest existing workflows while keeping the free product genuinely useful and preserving the current production stability.

## Current Release Contract

The Pro release continues the existing First Check identity and release line:

- App version: `1.1.0`
- Android package: `com.stormandme.firstcheck`
- Android versionCode: `4`
- iOS bundle identifier: `com.stormandme.firstcheck`
- iOS buildNumber: `2`
- RevenueCat SDK: `react-native-purchases` pinned to `10.5.0`
- RevenueCat entitlement: `pro`
- Existing clean-launch routing fix must remain intact for signed-out and signed-in users.

No Pro change may regress the already-published free Android experience or silently change package identity.

## Product Model

First Check has one paid entitlement: `pro`.

### Free

Free users retain the core First Check workflow, including normal daily checks and the core evidence-first operational flow. The free experience must remain useful on its own rather than acting as a nonfunctional demo.

### Pro

An active `pro` entitlement unlocks:

- Ask AI with verified evidence
- Full operational history
- Advanced reports and exports
- Multiple environments

The application gates these capabilities by entitlement, not by purchase SKU, platform, or locally stored subscription flags.

## Pricing and Store Products

### Google Play

Subscription product:

- Product ID: `firstcheck_pro`

Base plans:

- `monthly`: $9.99 USD per month
- `annual`: $79.99 USD per year

Introductory offer:

- Offer ID: `trial-7d`
- Eligibility: new customers who have never had this subscription
- Trial duration: 7 days

The annual option should be visually emphasized as the best-value plan, but the interface must not make false savings claims or hard-code localized store pricing when the store provides localized price strings.

### RevenueCat

RevenueCat remains the subscription abstraction layer across Android and iOS.

- Entitlement ID: `pro`
- Google Play monthly base plan maps to the monthly package
- Google Play annual base plan maps to the annual package
- iOS products will map to the same logical monthly and annual packages when iOS store setup begins

Application access is determined only from current RevenueCat customer information and the active `pro` entitlement.

## Billing Architecture

### Billing provider boundary

The mobile app owns a small billing layer around RevenueCat. UI screens and feature gates do not call RevenueCat directly. They consume an app-level subscription state/provider that exposes:

- billing readiness
- current Pro status
- available monthly and annual packages
- purchase state
- restore state
- refresh state
- nonfatal billing errors

This keeps purchase implementation isolated from product screens and makes billing behavior testable without scattering SDK calls throughout the app.

### Source of truth

RevenueCat customer information is the source of truth for access.

The app must not permanently unlock Pro because a purchase button returned success. After purchase or restore, the app refreshes customer information and confirms that `pro` is active.

Likewise, cancellation, billing failure, refund, expiration, or revocation removes Pro access once RevenueCat reports the entitlement inactive.

A temporary network failure does not grant Pro and does not crash or sign the user out.

### Identity

Whenever a stable First Check user identity is available, RevenueCat should be associated with that user so entitlements can be recovered across reinstall and compatible devices. Anonymous or guest behavior must not create a second, conflicting entitlement state when the user later signs in.

No private RevenueCat secret belongs in client source control. The mobile app uses only the appropriate public platform SDK key supplied through approved app configuration/environment handling.

## Paywall Experience

The Pro paywall stays within the existing premium First Check visual language rather than introducing a new brand direction.

The paywall contains:

- Clear `First Check Pro` heading
- Short benefit explanation tied to the four Pro capabilities
- Monthly plan with store-provided localized price
- Annual plan with store-provided localized price and best-value emphasis
- Clear 7-day trial language when the selected store offer is actually available to the customer
- Primary subscribe action
- Restore Purchases action
- Close/back path that returns the user to the free experience
- Terms/privacy links where required by platform policy

The app must never claim a trial is available when the store does not return an eligible trial/offer for that customer.

## Feature-Gate Behavior

A free user may encounter a Pro capability from its normal navigation context. In that case:

1. The app explains that the capability is part of First Check Pro.
2. The user can open the Pro paywall.
3. Dismissing the paywall returns the user safely to the free experience.
4. A successful entitlement refresh unlocks the requested Pro capability without requiring an app reinstall.

Feature gates use the same centralized entitlement policy so different screens cannot disagree about whether the user is Pro.

## Purchase Flow

1. Billing state loads RevenueCat customer information and current offering/packages.
2. User selects monthly or annual.
3. App starts the RevenueCat purchase for the selected package.
4. User cancellation is treated as a normal, non-error exit.
5. Purchase failures show a useful retryable message and leave access unchanged.
6. Purchase success triggers customer-info refresh.
7. App unlocks Pro only when the refreshed `pro` entitlement is active.
8. UI updates immediately from the shared subscription state.

Duplicate taps must not start overlapping purchase transactions.

## Restore Flow

1. User selects Restore Purchases.
2. App calls RevenueCat restore.
3. App refreshes customer information.
4. If `pro` is active, Pro features unlock immediately.
5. If no active entitlement exists, the app explains that no active Pro purchase was found.
6. Restore/network failures are nonfatal and retryable.

Restore must be accessible from the paywall and from an appropriate settings/account location if one exists in the current app structure.

## Renewal, Cancellation, Expiration, Refund, and Revocation

The app does not attempt to predict store billing state locally.

On app startup, foreground/session refresh, purchase, and restore, the billing layer refreshes customer information at appropriate points. If RevenueCat reports `pro` inactive, Pro gates return to Free behavior. Previously downloaded or generated data should not be destructively deleted solely because a subscription expired; access to Pro-only views/actions can be restricted without corrupting user data.

## Offline and Error Handling

- Billing initialization failure must not block app startup.
- Failure to load offerings must not crash the paywall; it shows a retry path.
- Failure to refresh customer info preserves the last known in-memory state only for the current session where safe, while avoiding a false permanent entitlement grant.
- Store-unavailable and network errors are surfaced as understandable messages.
- User-cancelled purchases do not show alarming failure UI.
- No billing error may sign the user out, erase operational data, or block the free workflow.

## Release and Runtime Safety

The existing clean-launch recovery is a hard regression gate for Pro 1.1.

A previous Pro runtime smoke receipt was gated because it referenced an older failed source build even though a later Android code-4 AAB build succeeded. The release process must correct that linkage and execute runtime testing against the successful code-4 artifact rather than accepting the skipped receipt.

The exact release artifact that passes runtime testing is the artifact eligible for store submission. Artifact identity must be tracked by SHA-256 so testing cannot silently occur against a different AAB than the one prepared for release.

## Test Strategy

### Contract tests

Verify:

- version `1.1.0`
- Android versionCode `4`
- iOS buildNumber `2`
- package/bundle identifiers unchanged
- `react-native-purchases` pinned as expected
- entitlement ID exactly `pro`
- clean-launch routes retained
- Pro feature definitions remain centralized

### Unit tests

Test app-level entitlement policy and billing-state transitions for:

- inactive entitlement
- active entitlement
- purchase success with active entitlement
- purchase result without active entitlement
- restore success
- restore with no active entitlement
- expiration/revocation transition
- user-cancelled purchase
- network/store errors
- duplicate purchase suppression

### Integration/UI tests

Verify:

- Free users can complete the core workflow
- Pro-gated actions open the paywall
- Monthly and annual packages render from store/RevenueCat data
- Eligible trial messaging is accurate
- Ineligible users are not promised a trial
- Purchase unlocks all Pro gates consistently
- Restore unlocks Pro after reinstall/session recovery
- Expired/revoked entitlement returns the product to Free gates without data loss
- Billing errors do not crash or block Free

### Android runtime gate

Run the successful code-4 AAB through the existing Android runtime smoke path, including repeated cold launches on the supported test API levels used by the project. Record the tested AAB SHA-256 and require it to match the release candidate artifact.

### Store purchase test

Before production submission, verify a real Google Play test purchase/restore lifecycle using an authorized license tester/test track and the configured `firstcheck_pro` product. Production rollout is blocked until the entitlement is proven end-to-end through Google Play and RevenueCat.

## Rollout Order

1. Keep the currently published Android free release untouched while Pro is prepared.
2. Complete app-side Pro billing and feature-gate verification.
3. Correct and rerun the exact code-4 runtime gate.
4. Configure/verify Google Play subscription product and base plans.
5. Configure/verify RevenueCat offering, packages, product mapping, and public Android SDK key.
6. Run Google Play test purchase, restore, and entitlement checks.
7. Build and verify the final Android 1.1.0/code-4 release candidate.
8. Submit Android Pro 1.1 only after all gates are green.
9. Carry the same entitlement model and product behavior into iOS with Apple subscription products and StoreKit/TestFlight verification.
10. Address Windows distribution after the mobile Pro release is stable; Windows billing is a separate store-integration decision and is not part of this 1.1 scope.

## User-Input Minimization

Implementation should proceed without repeatedly stopping for routine engineering decisions. User interaction is required only for account-owner actions or irreversible external-store choices, specifically:

- Google Play subscription/base-plan/offer creation or confirmation
- RevenueCat project/store connection and retrieval of the required public mobile SDK key/configuration
- Authorized test-account/store actions that cannot be performed from code
- Final store submission approval when required

Everything else—billing integration, feature gates, error handling, tests, build verification, artifact checks, and release preparation—should be completed and verified before asking the user to intervene.

## Non-Goals for Pro 1.1

- No broad redesign of the current First Check visual system
- No additional subscription tiers
- No lifetime purchase
- No new backend billing system replacing RevenueCat
- No large new feature set beyond the four approved Pro capabilities
- No Windows billing implementation in this release
- No release approval based only on static contracts when runtime/store purchase verification is still missing

## Definition of Done

First Check Pro 1.1 is ready for Android submission only when all of the following are true:

- Free workflow regression tests pass
- Central `pro` entitlement gates all approved paid capabilities
- Monthly and annual store packages load correctly
- Eligible 7-day trial behavior is verified
- Purchase and restore activate Pro from RevenueCat customer information
- Cancellation/expiration/revocation correctly remove Pro access
- Billing/network failures are nonfatal
- Clean launch remains stable
- Exact code-4 AAB runtime smoke passes and its SHA-256 matches the release candidate
- Google Play test purchase and restore pass end to end
- Final release contract checks pass with no package/version drift

Only then should Android 1.1.0/code 4 be submitted to production.
