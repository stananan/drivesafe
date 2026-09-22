# DriveSafe Privacy Policy

_Last updated: September 22, 2026_

> Hosting copy, for the privacy policy URL the App Store and Google Play both
> require. It mirrors `src/constants/privacy.ts`, which the in-app Privacy
> screen renders — change both together.

## The short version

DriveSafe records a drive so a teen driver and their parent can both see how it went. Location is collected only while a drive is recording, everything is visible only to your own family, and deleting your account erases all of it.

We do not sell your data, show ads, or use third-party analytics.

## What DriveSafe collects

- **Account details** — email address, username, and whether you signed up as a parent or a driver. Your password is handled by our authentication provider and DriveSafe never sees it in readable form.
- **Recorded drives** — GPS coordinates, speed, accuracy and timestamps while a drive is recording, which together make the route.
- **Drive summaries** — distance, duration, top speed, average speed, a safety score, and flagged moments such as speeding or hard braking.
- **Live location** — your most recent position while location sharing is on, so your family can see you on the map. Each update overwrites the last, so this is not a location history.
- **How loud it is** — only if you turn audio alerts on. See below.
- **Notification tokens** — if you allow notifications, the anonymous token your phone issues, so a driver's phone can alert their parents.

Location is collected only while you are recording a drive and DriveSafe is open on screen. There is no background tracking: locking your phone or switching apps stops the recording. You can turn sharing off from the Map screen, or revoke the permission in your device settings.

## Microphone and camera

Both are off by default, and only a driver can turn either on from their profile.

**Audio alerts** read your microphone's level meter — a single number describing how loud the car is. DriveSafe does not listen to, transcribe, store or upload the audio itself. Phones only produce a level meter while a recording is active, so a temporary file is written to your phone and deleted the moment monitoring stops; it never leaves the device. If the car stays loud, the driver is warned on screen and their parents are told. What gets saved is the fact of the alert, when it happened, how loud it was, and where — never any sound. A loudness reading is also saved about once a second so your family can see a graph of the drive. These are numbers only.

**The dashcam** records continuously and keeps only the most recent stretch, roughly the last twenty to forty seconds. Everything older is deleted on the phone and never sent anywhere. Footage leaves the phone only when a clip is deliberately kept — because the driver asked for it, or because DriveSafe flagged the car as loud. Saved clips include sound, as a dashcam normally would, which means anyone riding along can be heard on a clip the driver keeps.

Outside a saved clip, audio is never kept. The camera runs only with the dashcam switched on, and only while a drive is recording.

## What DriveSafe does not collect

No contacts, no photos, no advertising identifiers, and no third-party analytics, advertising or tracking software.

## Who can see your data

Only you and the members of your family. Family membership is enforced in the database itself through row-level security, so one family can never read another's drives, positions or profiles.

Parents in your family can see your recorded drives and routes, your safety scores, your live position while sharing is on, whether a drive is happening right now, and any alerts raised during it.

We do not share personal data with anyone else, and we never sell it.

## Where your data is stored

With Supabase, which provides our database, authentication and hosting, and processes this data on our behalf. Data travels over encrypted connections.

## Deleting your data

You can delete your account at any time — drivers from the Profile tab, parents from Settings. Deletion is immediate and permanent: your account, drives, routes and stored position are erased and cannot be recovered.

A parent deleting their account also deletes the family. Other members keep their own accounts and drives, but the family code stops working.

If you only want to stop sharing, leaving the family keeps your drives and stops your family seeing new ones.

## Children's privacy

DriveSafe is built for teen drivers and the parents who set up their family. It is not directed to children under 13 and we do not knowingly collect personal information from them. If you believe a child under 13 has created an account, email us and we will delete it.

## Changes to this policy

If this policy changes, we will update the date at the top and post the new version both in the app and at this address.

## Contact

Questions about this policy, or about your data: **stanleyho862@gmail.com**
