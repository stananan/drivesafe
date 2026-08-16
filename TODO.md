# DriveSafe TODO

Running list of what is outstanding. `ROADMAP.md` is the product vision; this is
the things that will actually bite us, roughly in the order they will bite.

Convention: `[ ]` open, `[x]` done, `[!]` blocked on something outside the code.

---

## Do before any App Store submission

- [!] **Fill in the privacy contact email.** Marked `TODO` in
  `src/constants/privacy.ts` (`PrivacyContactEmail`) and in
  `docs/privacy-policy.md`. App Review emails this address.
- [!] **Host the privacy policy at a public URL.** `docs/privacy-policy.md` is
  written for this; GitHub Pages off this repo is free. Paste the URL into App
  Store Connect *and* Google Play.
- [!] **Apple Developer Program enrolment.** $99/yr, and the enrollee must be 18+.
  A parent or guardian enrols, or we enrol as an organisation (needs a D-U-N-S
  number). Apple's identity check can take several days — start this first.
- [ ] **Re-run `supabase/schema.sql`** against the live project. Account deletion,
  the live-drive columns, `loud_audio`, `push_token`, and the realtime
  publication all live there. The file is idempotent; re-running it is safe.
- [ ] **Fill in the privacy nutrition labels** in App Store Connect. We collect
  precise location tied to identity, plus a push token. Answer honestly — this
  is the section reviewers check hardest for a teen-location app.
- [ ] **Do not opt into the Kids Category.** Age rating 4+ is fine; "Made for
  Kids" adds rules we do not want and cannot meet.
- [x] In-app account deletion (guideline 5.1.1(v)).
- [x] Privacy policy in the app (guideline 5.1.1(i)).
- [x] Removed the unused background-location entitlement (guideline 2.5.4).

## Before the first real road test

- [ ] **Calibrate the audio thresholds.** `LOUD_THRESHOLD_DBFS = -12`,
  `SUSTAIN_MS = 1500`, and `COOLDOWN_MS = 60000` in
  `src/lib/use-audio-monitor.ts` are guesses. Both the drive screen and the
  parent dashboard draw the level graph with the alert line on it: sit in the
  car, watch where normal conversation, the stereo, and actual shouting land
  relative to the line, and move the constant between them. Different phones and
  mounting positions read very differently. The safety score depends on this
  being right — see the distraction term in `SCORING.md`. Note the numeric dBFS
  readout was removed from the UI, so calibration is now by eye against the
  line, or by temporarily logging `audio.level`.
- [ ] **Test push end to end on a dev build.** Expo Go dropped remote push in
  SDK 53, so notifications will not arrive there. `eas build --profile
  development` on both a parent phone and a driver phone, then trigger a loud
  event. Until then the parent's live dashboard is the demonstrable path.
- [ ] **`eas init`,** so `Constants.expoConfig.extra.eas.projectId` exists.
  `registerForPushNotifications` returns null without it and push silently never
  works.
- [ ] Decide whether the driver should be able to end a drive from a locked
  phone, or whether the screen staying on is acceptable for now.

## Known gaps in what is built

- [ ] **Recording is foreground-only.** `use-drive-tracker.ts` uses
  `watchPositionAsync` with a when-in-use permission and holds the screen awake.
  Lock the phone or switch apps and point collection stops. Fixing it means a
  `TaskManager` background task, re-adding `UIBackgroundModes: ["location"]` and
  the Android foreground-service permissions, and justifying all of it to App
  Review. This is the single biggest gap between the app and the pitch.
- [ ] **No offline queue for a finished drive.** `finishDrive` writes straight to
  Supabase. End a drive in a dead zone and the trip is lost — the tracker state
  is already torn down by then. Persist the summary to AsyncStorage on failure
  and retry on next launch.
- [ ] **The live route is not streamed.** The parent dashboard follows the
  driver's published position; `drive_points` are only uploaded when the drive
  ends, so there is no live polyline. Fine for now, worth knowing.
- [ ] **A crashed or force-quit app leaves a drive open forever.** Nothing sets
  `ended_at` if the phone dies mid-drive. Consider a "stale drive" sweep, or
  treat a drive with no heartbeat for N minutes as ended.
- [ ] **Parent alert preferences are cosmetic.** The toggles in
  `(parent)/settings.tsx` are local state that nothing reads. Either wire them
  to the profile row and honour them in `notifyFamilyParents`, or remove them.
- [ ] **Loudness readings are one row a second.** An hour-long drive writes about
  3,600 rows to `drive_audio_levels`. The graph downsamples to 60 bars anyway, so
  bucketing on the phone before upload — a peak every five seconds, say — would
  cut this by 5× with no visible difference.
- [ ] **The parent's live graph refreshes on the 5 s poll,** so it lags the car
  by up to five seconds. Fine for a noise graph; worth knowing before anyone
  reads it as instantaneous.
- [ ] **Push tokens are never cleaned up.** A parent who reinstalls leaves a dead
  token behind. Expo's push receipts report `DeviceNotRegistered`; we do not
  read receipts at all yet.
- [ ] Audio monitoring stops if the driver backgrounds the app, same as GPS.

## Nice to have

- [ ] Rolling-buffer dashcam and the `"DriveSafe, save that"` voice trigger —
  still listed as Coming Soon on the drive screen.
- [ ] `phone_distraction` is in the event enum and the scoring docs but nothing
  ever raises one.
- [ ] Speed limits are not real. `SCORING.md` explains the assumption; a real
  limit lookup would make the speeding events meaningful.
