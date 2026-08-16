# DriveSafe Privacy Policy

_Last updated: August 15, 2026_

> This is the copy meant for public hosting — App Store Connect requires a
> privacy policy URL, and Google Play requires one too. Publish it somewhere
> stable (GitHub Pages off this repo is free and works) and paste that URL into
> the store listing. It mirrors `src/constants/privacy.ts`, which is what the
> in-app Privacy screen renders; change both together.

## The short version

DriveSafe records a drive so a teen driver and their parent can both see how it went. Location is collected only while a drive is recording, it is visible only to members of your own family, and deleting your account erases all of it.

We do not sell your data, show ads, or use third-party analytics.

## What DriveSafe collects

- **Account details** — your email address, your username, and whether you signed up as a parent or a driver. Your password is handled by our authentication provider and DriveSafe never sees it in readable form.
- **Recorded drives** — while a drive is recording, DriveSafe saves GPS coordinates, speed, accuracy, and timestamps as your position updates. Together these make the route shown on the drive detail screen.
- **Drive summaries** — distance, duration, top speed, average speed, a safety score, and flagged moments such as speeding, hard braking, or rapid acceleration.
- **Live location** — while location sharing is on, DriveSafe stores your most recent position so your family can see you on the map. Only the latest position is kept; each update overwrites the one before it, so this is not a location history.
- **How loud it is** — only if you turn audio alerts on. See the section below.
- **Notification tokens** — if you allow notifications, DriveSafe stores the anonymous token your phone issues, so a driver's phone can send an alert to their parents.

## Audio distraction alerts

This feature is off by default. A driver turns it on themselves, one drive at a time, and can turn it off mid-drive.

While it is on, DriveSafe reads your microphone's level meter — a single number describing how loud the car is. It does not listen to, transcribe, analyse, store, or upload the audio itself. Because phones will only produce a level meter while a recording is active, a temporary file is written to your phone; DriveSafe deletes it as soon as monitoring stops, and it never leaves the device.

If the car stays loud for a few seconds, DriveSafe warns the driver on screen and tells their parents that it happened. What gets saved and shared is the fact of the alert, when it happened, how loud it was, and where — never any sound.

While alerts are on, DriveSafe also saves a loudness reading about once a second for the drive, so your family can see a graph of how noisy the car was — both while you are driving and afterwards on the drive. These readings are numbers only. They are deleted along with the drive, and deleting your account removes them entirely.

## What DriveSafe does not collect

DriveSafe does not use your camera, contacts, or photos, and does not collect advertising identifiers. It contains no third-party analytics, advertising, or tracking software.

It never records, keeps, or transmits audio. The microphone is read only as a loudness meter, only during a drive, and only when the driver has switched audio alerts on.

## When location is collected

Only while you are recording a drive and DriveSafe is open on screen. The app does not track location in the background — if you lock your phone or switch to another app, recording stops.

You can turn live location sharing off at any time from the toggle on the Map screen. You can also decline or revoke the location permission in your device settings, though drive recording cannot work without it.

## Who can see your data

Only you and the members of your family. Family membership is enforced in the database itself through row-level security, so one family can never read another family's drives, positions, or profiles.

Parents in your family can see your recorded drives and their routes, your safety scores, your live position while sharing is on, whether a drive is happening right now, and any alerts raised during it.

We do not share personal data with anyone else, and we never sell it.

## Where your data is stored

DriveSafe stores accounts and drive data with Supabase, which provides our database, authentication, and hosting. Supabase processes this data on our behalf. Data travels over encrypted connections.

## Deleting your data

You can delete your account at any time — drivers from the Profile tab, parents from Settings. Deletion is immediate and permanent: your account, your recorded drives, their routes, and your stored position are erased and cannot be recovered.

If you are a parent, deleting your account also deletes the family. Other members keep their own accounts and drives, but the family code stops working and they will need a new one.

If you only want to stop sharing, leaving the family keeps your drives and stops your family seeing new ones.

## Children's privacy

DriveSafe is built for teen drivers and the parents who set up their family. It is not directed to children under 13 and we do not knowingly collect personal information from them. If you believe a child under 13 has created an account, contact us and we will delete it.

## Changes to this policy

If this policy changes, we will update the date at the top and post the new version both in the app and at this address.

## Contact

**TODO before submitting:** add the email address you want App Review and users to reach you at, and set the same one in `PrivacyContactEmail` in `src/constants/privacy.ts`.
