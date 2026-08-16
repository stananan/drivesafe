/**
 * The privacy policy text, in one place.
 *
 * App Store Review guideline 5.1.1(i) wants the policy in two places: a public
 * URL in App Store Connect, and somewhere easily reachable inside the app. This
 * module is what the in-app screen renders; `docs/privacy-policy.md` is the
 * copy meant for hosting, and the two are kept in step by hand.
 *
 * Everything here describes what the code actually does today. If DriveSafe
 * starts collecting something new — background location, audio, push tokens —
 * this file has to change in the same commit.
 */

export const PrivacyPolicyUpdated = 'August 15, 2026';

/** Fill this in before submitting; App Review will email it. */
export const PrivacyContactEmail = 'TODO — add a monitored email address';

export type PrivacySection = {
  title: string;
  paragraphs: string[];
};

export const PrivacyPolicySections: PrivacySection[] = [
  {
    title: 'The short version',
    paragraphs: [
      'DriveSafe records a drive so a teen driver and their parent can both see how it went. Location is collected only while a drive is recording, it is visible only to members of your own family, and deleting your account erases all of it.',
      'We do not sell your data, show ads, or use third-party analytics.',
    ],
  },
  {
    title: 'What DriveSafe collects',
    paragraphs: [
      'Account details: your email address, your username, and whether you signed up as a parent or a driver. Your password is handled by our authentication provider and DriveSafe never sees it in readable form.',
      'Recorded drives: while a drive is recording, DriveSafe saves GPS coordinates, speed, accuracy, and timestamps as your position updates. Together these make the route shown on the drive detail screen.',
      'Drive summaries: distance, duration, top speed, average speed, a safety score, and flagged moments such as speeding, hard braking, or rapid acceleration.',
      'Live location: while location sharing is on, DriveSafe stores your most recent position so your family can see you on the map. Only the latest position is kept — each update overwrites the one before it, so this is not a location history.',
      'How loud it is, only if you turn audio alerts on: see the section below.',
      'Notification tokens: if you allow notifications, DriveSafe stores the anonymous token your phone issues, so a driver’s phone can send an alert to their parents.',
    ],
  },
  {
    title: 'Audio distraction alerts',
    paragraphs: [
      'This feature is off by default. A driver turns it on themselves, one drive at a time, and can turn it off mid-drive.',
      'While it is on, DriveSafe reads your microphone’s level meter — a single number describing how loud the car is. It does not listen to, transcribe, analyse, store, or upload the audio itself. Because phones will only produce a level meter while a recording is active, a temporary file is written to your phone; DriveSafe deletes it as soon as monitoring stops, and it never leaves the device.',
      'If the car stays loud for a few seconds, DriveSafe warns the driver on screen and tells their parents that it happened. What gets saved and shared is the fact of the alert, when it happened, how loud it was, and where — never any sound.',
      'While alerts are on, DriveSafe also saves a loudness reading about once a second for the drive, so your family can see a graph of how noisy the car was — both while you are driving and afterwards on the drive. These readings are numbers only. They are deleted along with the drive, and deleting your account removes them entirely.',
    ],
  },
  {
    title: 'Dashcam',
    paragraphs: [
      'This feature is off by default and only a driver can turn it on, from their profile.',
      'While it is on and a drive is recording, the camera records continuously in short segments and keeps only the last minute. Everything older is deleted on the phone and is never sent anywhere. Footage leaves the phone only when a clip is deliberately kept — either because the driver tapped Save that, or because DriveSafe flagged the car as loud.',
      'Saved clips are video only. They have no sound, because the microphone is used to measure loudness and nothing else. Clips are stored privately and are visible to your family, nobody else. Deleting the drive or your account deletes them.',
    ],
  },
  {
    title: 'What DriveSafe does not collect',
    paragraphs: [
      'DriveSafe does not use your contacts or photos, and does not collect advertising identifiers. It contains no third-party analytics, advertising, or tracking software.',
      'It never records, keeps, or transmits audio — not from the microphone, and not on dashcam clips. The microphone is read only as a loudness meter, only during a drive, and only when the driver has switched audio alerts on.',
      'The camera is used only when the driver has switched the dashcam on, and only while a drive is recording.',
    ],
  },
  {
    title: 'When location is collected',
    paragraphs: [
      'Only while you are recording a drive and DriveSafe is open on screen. The app does not track location in the background — if you lock your phone or switch to another app, recording stops.',
      'You can turn live location sharing off at any time from the toggle on the Map screen. You can also decline or revoke the location permission in your device settings, though drive recording cannot work without it.',
    ],
  },
  {
    title: 'Who can see your data',
    paragraphs: [
      "Only you and the members of your family. Family membership is enforced in the database itself through row-level security, so one family can never read another family's drives, positions, or profiles.",
      'Parents in your family can see your recorded drives and their routes, your safety scores, your live position while sharing is on, whether a drive is happening right now, and any alerts raised during it.',
      'We do not share personal data with anyone else, and we never sell it.',
    ],
  },
  {
    title: 'Where your data is stored',
    paragraphs: [
      'DriveSafe stores accounts and drive data with Supabase, which provides our database, authentication, and hosting. Supabase processes this data on our behalf. Data travels over encrypted connections.',
    ],
  },
  {
    title: 'Deleting your data',
    paragraphs: [
      'You can delete your account at any time — drivers from the Profile tab, parents from Settings. Deletion is immediate and permanent: your account, your recorded drives, their routes, and your stored position are erased and cannot be recovered.',
      'If you are a parent, deleting your account also deletes the family. Other members keep their own accounts and drives, but the family code stops working and they will need a new one.',
      'If you only want to stop sharing, leaving the family keeps your drives and stops your family seeing new ones.',
    ],
  },
  {
    title: "Children's privacy",
    paragraphs: [
      'DriveSafe is built for teen drivers and the parents who set up their family. It is not directed to children under 13 and we do not knowingly collect personal information from them. If you believe a child under 13 has created an account, contact us and we will delete it.',
    ],
  },
  {
    title: 'Changes to this policy',
    paragraphs: [
      'If this policy changes, we will update the date at the top and post the new version both in the app and at the public policy address.',
    ],
  },
];
