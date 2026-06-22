# Feature TODO

Planned features, not yet built. Checkboxes track progress. Writing style follows
the project rule: no em dashes.

---

## Player Accounts + Cloud Save

Let players create an account so their game progress syncs across devices.
Accounts are separate from the admin login (admin stays a hardcoded whitelist).

### Decisions locked
- [x] Auth via **Firebase Auth**: Google + Email/Password (Firebase stores/hashes passwords, we never see them)
- [x] **Dedicated pages** for `/login` and `/signup` (not a modal)
- [x] Date of birth picker = **Day / Month / Year dropdowns** (optional field)
- [x] Game stays fully playable as a guest; accounts only add cross-device save
- [x] Email signups must **verify their email**; profile is not written to our
      database until verified (see Phase C)

### Data model (Firestore)
```
users/{uid}            { name, email, dob: {y,m,d}|null, provider, createdAt }
pending_signups/{uid}  { name, dob, email, expiresAt }   // TTL, deleted after a few days
saves/{uid}_{game}     { game, blob, score, updatedAt }  // cloud progress
```

### Phase A: Auth foundation
- [ ] Extend Firebase client SDK (`src/lib/firebase/index.ts`) for email/password + Google
- [ ] `player_session` httpOnly JWT cookie (mirrors the admin pattern, no whitelist)
- [ ] `src/lib/auth/requireUser.ts` (reads + verifies `player_session`)
- [ ] `POST /api/auth/session` (verify Firebase ID token, set cookie) and `DELETE` (logout)
- [ ] `GET /api/auth/me` (current user for the NavBar / pages)
- [ ] These endpoints run in production, gated by the player's own session (like `/api/stats`)

### Phase B: Signup / Login pages + DOB picker
- [ ] `/signup` page: name, email, password, confirm password, optional DOB
- [ ] Client validation: email format, password length, passwords match
- [ ] `components/ui/DateOfBirthPicker.tsx`: 3 styled selects, day adjusts to month/year,
      year range ~1900 to today, blank = null
- [ ] `/login` page: email/password + "Continue with Google"
- [ ] Google flow: popup, ID token, session, create/merge user doc
- [ ] NavBar: Login / account link / Logout

### Phase C: Email verification (email signups only)
- [ ] On email signup: create the Firebase auth user, send verification email,
      DO NOT write `users/{uid}` yet
- [ ] Stash name + DOB in `pending_signups/{uid}` with an `expiresAt` (TTL ~3 days)
- [ ] Enable a Firestore **TTL policy** on `expiresAt` so unverified pending signups
      auto-delete after a few days (the "keep for a couple of days" fallback)
- [ ] Block session creation for email/password users until `emailVerified` is true;
      show a "verify your email / resend" state instead
- [ ] On first verified login: promote `pending_signups/{uid}` -> `users/{uid}`,
      then delete the pending doc
- [ ] "Resend verification email" button, throttled (see security)
- [ ] (Optional) scheduled cleanup of unverified Firebase auth users older than N days
- [ ] Note: Google sign-ins are already verified, so they skip the pending step

### Phase D: Profile / account
- [ ] `/account` page: view/edit name and DOB
- [ ] `GET/PUT /api/profile`
- [ ] Account delete (also needed for GDPR erasure once live)

### Phase E: Cloud save
- [ ] `GET/PUT /api/progress` (per uid + game), gated by `requireUser`
- [ ] planet-merge: logged-in "Save Progress" writes to cloud; start screen offers
      "Continue (synced)"
- [ ] Guests keep the existing localStorage save unchanged
- [ ] On first login, offer to import an existing local save into the cloud

### Security and anti-spam
- [ ] Per-IP rate limiting on `/api/auth/session`, signup, and resend-verification
      (reuse the `abuseGuard` pattern from `src/lib/stats/abuseGuard.ts`)
- [ ] Throttle verification-email resends per account + per IP (stop email-bombing)
- [ ] Bot protection on the signup form (Cloudflare Turnstile or reCAPTCHA, both have free tiers)
- [ ] Turn on Firebase Auth protections: Email Enumeration Protection + reCAPTCHA/App Check
- [ ] Validate + bound all inputs server-side (name length, DOB sanity, email format)
- [ ] The TTL on `pending_signups` also caps how much junk an attacker can leave behind

### Firebase console setup (one time)
- [ ] Authentication -> enable **Email/Password** provider
- [ ] Authentication -> add authorized domains: `brzio.com`, `localhost`
- [ ] Configure the verification email template / sender
- [ ] Firestore -> add a **TTL policy** on `pending_signups.expiresAt`

### Legal / compliance (before going live)
- [ ] Privacy policy page (email + DOB are personal data)
- [ ] Account-delete (right to erasure)
- [ ] Keep DOB optional and non-gating (minors' data carries extra weight)

### Open questions
- [ ] Password reset flow (Firebase `sendPasswordResetEmail`): include? (recommended)
- [ ] Email verification: hard block play until verified, or soft? (recommended soft,
      but profile/cloud-save still require verification)

---

## Rewarded Video Ads (Monetization)

Optional "watch a short ad to unlock a power" model, e.g. an extra eliminate-planet
charge. Standard rewarded-video pattern for games.

### Reality check
- Google's web option is **H5 Games Ads via AdSense**, so it needs an approved
  AdSense account (the same wall as display ads).
- Mobile networks (AdMob, Unity Ads, AppLovin, ironSource) are **app-only**, not for web.
- Most accessible right now: **HTML5 game ad SDKs** (GameDistribution, GameMonetize).
  Lower barrier to entry than AdSense.
- Revenue is tiny at low traffic; the value now is building the capability.

### Build now (no ad network needed)
- [ ] Rewarded-unlock flow in planet-merge: a "Watch to unlock eliminate-planet" button
- [ ] Placeholder "ad" screen (short countdown) that grants the reward on completion
- [ ] Isolate the ad call behind one function (e.g. `showRewardedAd()`) so a real SDK
      swaps in cleanly later
- [ ] Reward logic: add one destroy-power charge on completion; cap uses per game
- [ ] Keep it an EXTRA path (skill chains still earn the power); never pay-to-win or naggy

### Integrate a real SDK (later)
- [ ] Pick and apply to an HTML5 game ad network (GameDistribution / GameMonetize, or
      AdSense H5 Games Ads if/when approved)
- [ ] Swap the placeholder `showRewardedAd()` for the real SDK call
- [ ] Handle no-fill / error / ad-blocked: fail gracefully, never grant if the ad did
      not actually complete
- [ ] Frequency caps + per-session limits to comply with network policy

### Prerequisites for real ads (shared with accounts/privacy work)
- [ ] Privacy policy page (third-party ad scripts = personal data)
- [ ] Consent mechanism (GDPR/CCPA) for EU/CA traffic
- [ ] Verify the chosen network's current traffic + content requirements before applying
