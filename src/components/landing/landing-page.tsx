import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

import { Landing, LandingBreakpoint, LandingWidth } from './landing-tokens';
import { ClipVisual, LiveDriveVisual, NoiseVisual, ScoreVisual } from './landing-visuals';

/**
 * The page a stranger lands on.
 *
 * Web only, and deliberately not built like the app: the app is a tool used at
 * a glance while driving, this is a document read once by someone deciding
 * whether to trust it with their family. So it gets a dark ground to open on, a
 * type scale the app has no use for, and a rhythm that changes between sections.
 *
 * Three things it avoids on purpose, because they are what a generated landing
 * page looks like: a row of three icons in coloured circles, everything centred,
 * and copy that could describe any product. Every claim here is a detail from
 * the implementation — the twenty-second buffer, the OpenStreetMap limits, the
 * two terms in the score — because specifics are the only thing that reads as
 * built rather than assembled.
 */
export function LandingPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const wide = width >= LandingBreakpoint;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <Nav onSignIn={() => router.push('/(auth)/sign-in' as never)} />

      <Hero
        wide={wide}
        onStart={() => router.push('/(auth)/sign-up' as never)}
        onSignIn={() => router.push('/(auth)/sign-in' as never)}
      />

      <Mission wide={wide} />
      <Features wide={wide} />
      <Restraint wide={wide} />
      <Scoring wide={wide} />
      <Creators wide={wide} />
      <Footer wide={wide} />
    </ScrollView>
  );
}

/* ---------------------------------------------------------------- nav ---- */

function Nav({ onSignIn }: { onSignIn: () => void }) {
  return (
    <View style={styles.navBand}>
      <View style={styles.navInner}>
        <View style={styles.wordmarkRow}>
          <View style={styles.mark} />
          <ThemedText style={styles.wordmark}>DriveSafe</ThemedText>
        </View>

        <Pressable onPress={onSignIn} style={styles.navLink}>
          <ThemedText style={styles.navLinkText}>Sign in</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

/* --------------------------------------------------------------- hero ---- */

function Hero({
  wide,
  onStart,
  onSignIn,
}: {
  wide: boolean;
  onStart: () => void;
  onSignIn: () => void;
}) {
  return (
    <View style={styles.heroBand}>
      <View style={[styles.inner, styles.heroInner, wide && styles.heroInnerWide]}>
        <View style={[styles.heroCopy, wide && styles.heroCopyWide]}>
          <ThemedText style={styles.eyebrow}>
            Congressional App Challenge · California District 2
          </ThemedText>

          <ThemedText style={[styles.display, !wide && styles.displayNarrow]}>
            The most dangerous thing a teenager does is drive.
          </ThemedText>

          <ThemedText style={styles.heroLede}>
            Per mile driven, drivers aged 16 to 19 crash at nearly three times the rate of drivers
            over 20. DriveSafe is what two of them built about it — a dashcam, a coach and a shared
            map, for families who would rather talk about a drive than argue about one.
          </ThemedText>

          <View style={styles.actions}>
            <Pressable
              onPress={onStart}
              style={({ hovered }) => [styles.primary, hovered && styles.primaryHovered]}>
              <ThemedText style={styles.primaryText}>Create a parent account</ThemedText>
            </Pressable>

            <Pressable
              onPress={onSignIn}
              style={({ hovered }) => [styles.secondary, hovered && styles.secondaryHovered]}>
              <ThemedText style={styles.secondaryText}>Sign in</ThemedText>
            </Pressable>
          </View>

          <ThemedText style={styles.heroFootnote}>
            Drivers record on their phone. Parents watch from here.
          </ThemedText>
        </View>

        <View style={[styles.heroRail, wide && styles.heroRailWide]}>
          <RailStat figure="3×" note="the crash rate per mile for drivers 16–19" />
          <RailStat figure="20s" note="of footage kept on the phone, and no more" />
          <RailStat figure="0" note="words recorded, on any drive, ever" last />
        </View>
      </View>

      <View style={[styles.inner, styles.heroVisual]}>
        <LiveDriveVisual />
      </View>
    </View>
  );
}

function RailStat({ figure, note, last }: { figure: string; note: string; last?: boolean }) {
  return (
    <View style={[styles.railStat, !last && styles.railStatDivided]}>
      <ThemedText style={styles.railFigure}>{figure}</ThemedText>
      <ThemedText style={styles.railNote}>{note}</ThemedText>
    </View>
  );
}

/* ------------------------------------------------------------ mission ---- */

function Mission({ wide }: { wide: boolean }) {
  return (
    <View style={[styles.band, styles.paperBand]}>
      <View style={[styles.inner, wide && styles.missionWide]}>
        <View style={wide ? styles.missionLeft : undefined}>
          <SectionLabel tone="paper">The idea</SectionLabel>
          <ThemedText style={[styles.heading, !wide && styles.headingNarrow]}>
            Parents want to know. Teenagers don’t want to be watched.
          </ThemedText>
        </View>

        <View style={wide ? styles.missionRight : styles.missionRightNarrow}>
          <ThemedText style={styles.prose}>
            Most monitoring apps resolve that by siding with the parent. They record everything,
            report everything, and leave the driver with no reason to keep the app installed — which
            is how a safety tool ends up switched off in a glovebox.
          </ThemedText>
          <ThemedText style={styles.prose}>
            DriveSafe takes the other side of the trade. A parent sees the drive: the route, the
            speed, the moments worth talking about. They do not see a transcript, a feed of where
            their driver goes when the car is parked, or anything at all once that driver leaves the
            family. The limits are the product, not a setting buried three screens down.
          </ThemedText>
          <ThemedText style={styles.prose}>
            It is built for the conversation afterwards — the one where a parent can say what
            happened on Novato Boulevard instead of how they feel about teenagers in general.
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

/* ----------------------------------------------------------- features ---- */

const FEATURES = [
  {
    index: '01',
    title: 'Every drive, scored against the actual road',
    body: 'The phone records the route, and when the drive ends DriveSafe asks OpenStreetMap what the limit was on each road it covered — the posted number where the map has one, the California prima facie limit for that class of road where it does not. A score compares the drive to the roads it happened on, not to a flat number that calls a motorway and a school zone the same thing.',
    visual: <ScoreVisual />,
  },
  {
    index: '02',
    title: 'Watch a drive while it is happening',
    body: 'A parent opens a drive in progress and sees where the car is, how fast it is going, how long it has been out, and every alert as it fires. Open it ten minutes late and the ten minutes are already there. Nothing about it is a control — there is no button that reaches into the car, because a driver answering their phone is the thing this is supposed to prevent.',
    visual: <LiveDriveVisual />,
  },
  {
    index: '03',
    title: 'It hears the room, not the conversation',
    body: 'With alerts on, DriveSafe reads the microphone as a loudness meter and nothing else. No audio is kept, transcribed or uploaded; the temporary file the phone needs to produce a reading is deleted the moment monitoring stops. A cabin loud enough to mask a siren gets a warning on the driver’s screen and a note to their parents — and that note is a number, not a recording.',
    visual: <NoiseVisual />,
  },
  {
    index: '04',
    title: 'A dashcam that keeps twenty seconds, not twenty miles',
    body: 'The camera runs the whole drive and throws almost all of it away. Only the last twenty seconds survive, and they leave the phone only when someone keeps them — the driver tapping save, or a shout loud enough that DriveSafe keeps the clip on their behalf. An hour of driving costs nothing to store, because an hour of driving was never stored.',
    visual: <ClipVisual />,
  },
];

function Features({ wide }: { wide: boolean }) {
  return (
    <View style={[styles.band, styles.paperBand, styles.featuresBand]}>
      <View style={styles.inner}>
        <SectionLabel tone="paper">What it does</SectionLabel>
      </View>

      {FEATURES.map((feature, index) => (
        <View key={feature.index} style={styles.inner}>
          <View
            style={[
              styles.featureRow,
              wide && styles.featureRowWide,
              // Alternating sides. A column of identical left-image rows reads
              // as a template; swapping them makes the page feel composed.
              wide && index % 2 === 1 && styles.featureRowFlipped,
            ]}>
            <View style={[styles.featureCopy, wide && styles.featureCopyWide]}>
              <ThemedText style={styles.featureIndex}>{feature.index}</ThemedText>
              <ThemedText style={[styles.featureTitle, !wide && styles.featureTitleNarrow]}>
                {feature.title}
              </ThemedText>
              <ThemedText style={styles.prose}>{feature.body}</ThemedText>
            </View>

            <View style={[styles.featureVisual, wide && styles.featureVisualWide]}>
              {feature.visual}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---------------------------------------------------------- restraint ---- */

const NEVER = [
  {
    title: 'Record what is said in the car',
    body: 'The microphone produces one number: how loud it is. Saved dashcam clips carry sound, and a driver turns those on themselves, one drive at a time.',
  },
  {
    title: 'Follow anyone who is not driving',
    body: 'Location moves while a drive is recording. Outside that, DriveSafe keeps the most recent position and nothing behind it — there is no history to scroll.',
  },
  {
    title: 'Show a drive to anyone outside the family',
    body: 'Every read is checked in the database itself. One family cannot see another family’s drives, and a driver who leaves takes their whole history with them.',
  },
  {
    title: 'Sell anything, to anyone',
    body: 'No advertising, no analytics, no third-party trackers, nothing shared with anybody. Deleting the account deletes the drives, the clips and the files behind them.',
  },
];

function Restraint({ wide }: { wide: boolean }) {
  return (
    <View style={[styles.band, styles.inkBand]}>
      <View style={styles.inner}>
        <SectionLabel tone="ink">The limits</SectionLabel>
        <ThemedText style={[styles.heading, styles.headingOnInk, !wide && styles.headingNarrow]}>
          Four things it will never do.
        </ThemedText>

        <View style={[styles.neverList, wide && styles.neverListWide]}>
          {NEVER.map((item) => (
            <View key={item.title} style={[styles.neverItem, wide && styles.neverItemWide]}>
              <View style={styles.neverRule} />
              <ThemedText style={styles.neverTitle}>{item.title}</ThemedText>
              <ThemedText style={styles.neverBody}>{item.body}</ThemedText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------ scoring ---- */

function Scoring({ wide }: { wide: boolean }) {
  return (
    <View style={[styles.band, styles.paperBand]}>
      <View style={[styles.inner, wide && styles.missionWide]}>
        <View style={wide ? styles.missionLeft : undefined}>
          <SectionLabel tone="paper">The score</SectionLabel>
          <ThemedText style={[styles.heading, !wide && styles.headingNarrow]}>
            A number you can argue with.
          </ThemedText>
        </View>

        <View style={wide ? styles.missionRight : styles.missionRightNarrow}>
          <ThemedText style={styles.prose}>
            Every drive starts at 100. Two things take points off: time spent over the limit, and
            spells where the car got loud. Speeding is weighted by how far over, not how often —
            crash energy rises with the square of speed, so ten over is worse than twice five over,
            and the arithmetic says so.
          </ThemedText>
          <ThemedText style={styles.prose}>
            Earlier versions also scored cornering and harsh braking, worked out from the shape of
            the GPS trace. Both were removed. Neither could be checked against anything — a corner
            taken at 25 is reckless on a wet mountain road and unremarkable in a car park, and the
            trace cannot tell the two apart. A score nobody can dispute is not rigorous, it is
            unfalsifiable, and a teenager who cannot see why they lost points does not drive
            differently. They decide the app is broken.
          </ThemedText>
          <ThemedText style={styles.prose}>
            So what is left is the part that survives being questioned: you were doing 47 on a road
            posted 35, for 38 seconds, here.
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

/* ----------------------------------------------------------- creators ---- */

const CREATORS = [
  {
    name: 'Stanley Ho',
    role: 'App and backend',
    line: 'Built the drive recorder, the scoring engine and the parent dashboard — and the parts nobody sees, like what happens to a drive that ends somewhere without signal.',
  },
  {
    name: 'Nico Zametto',
    role: 'Product and testing',
    line: 'Worked out what a parent actually needs to see and what a driver will tolerate being told, then drove the routes that proved the first version was too sensitive to wind.',
  },
];

function Creators({ wide }: { wide: boolean }) {
  return (
    <View style={[styles.band, styles.altBand]}>
      <View style={styles.inner}>
        <SectionLabel tone="paper">Who made it</SectionLabel>
        <ThemedText style={[styles.heading, !wide && styles.headingNarrow]}>
          Built by two people who are learning to drive.
        </ThemedText>

        <ThemedText style={[styles.prose, styles.creatorsLede]}>
          DriveSafe is a Congressional App Challenge entry for California’s 2nd district. It was
          written by two high school students in Marin County, tested on the roads they are learning
          on, and shaped by the fact that they are the people it is about.
        </ThemedText>

        <View style={[styles.creatorRow, wide && styles.creatorRowWide]}>
          {CREATORS.map((person) => (
            <View key={person.name} style={[styles.creator, wide && styles.creatorWide]}>
              <View style={styles.creatorRule} />
              <ThemedText style={styles.creatorName}>{person.name}</ThemedText>
              <ThemedText style={styles.creatorRole}>{person.role}</ThemedText>
              <ThemedText style={styles.creatorLine}>{person.line}</ThemedText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------- footer ---- */

function Footer({ wide }: { wide: boolean }) {
  const router = useRouter();

  return (
    <View style={[styles.band, styles.inkBand, styles.footerBand]}>
      <View style={[styles.inner, wide && styles.footerInnerWide]}>
        <View style={styles.footerBrand}>
          <View style={styles.wordmarkRow}>
            <View style={styles.mark} />
            <ThemedText style={styles.wordmark}>DriveSafe</ThemedText>
          </View>
          <ThemedText style={styles.footerNote}>
            Congressional App Challenge 2026 · California District 2
          </ThemedText>
        </View>

        <View style={styles.footerLinks}>
          <Pressable onPress={() => router.push('/privacy' as never)} style={styles.footerLink}>
            <ThemedText style={styles.footerLinkText}>Privacy</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(auth)/sign-up' as never)}
            style={styles.footerLink}>
            <ThemedText style={styles.footerLinkText}>Create an account</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(auth)/sign-in' as never)}
            style={styles.footerLink}>
            <ThemedText style={styles.footerLinkText}>Sign in</ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={[styles.inner, styles.footerBottom]}>
        <ThemedText style={styles.footerFine}>
          DriveSafe shows a parent how a drive went. It is not a substitute for talking to their
          driver about it.
        </ThemedText>
      </View>
    </View>
  );
}

/* --------------------------------------------------------------- bits ---- */

function SectionLabel({ children, tone }: { children: string; tone: 'ink' | 'paper' }) {
  return (
    <ThemedText style={[styles.sectionLabel, tone === 'ink' && styles.sectionLabelOnInk]}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Landing.ink,
  },
  content: {
    minHeight: '100%',
  },
  inner: {
    width: '100%',
    maxWidth: LandingWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
  },

  /* nav */
  navBand: {
    backgroundColor: Landing.ink,
    paddingTop: Spacing.four,
  },
  navInner: {
    width: '100%',
    maxWidth: LandingWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // The mark is a road, abstracted to one stroke. Anything more would be a logo
  // this project has not earned yet.
  mark: {
    width: 10,
    height: 22,
    borderRadius: 2,
    backgroundColor: Landing.accentBright,
    transform: [{ skewX: '-18deg' }],
  },
  wordmark: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: Landing.onInk,
  },
  navLink: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  navLinkText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: Landing.onInkMuted,
  },

  /* hero */
  heroBand: {
    backgroundColor: Landing.ink,
    paddingTop: 72,
  },
  heroInner: {
    gap: Spacing.five,
  },
  heroInnerWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 72,
  },
  heroCopy: {
    gap: Spacing.three,
  },
  heroCopyWide: {
    flex: 3,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Landing.accentBright,
  },
  display: {
    fontSize: 68,
    // Tight for display type. The default line height would leave these lines
    // floating apart like body copy.
    lineHeight: 70,
    fontWeight: '700',
    letterSpacing: -2.2,
    color: Landing.onInk,
    maxWidth: 620,
  },
  displayNarrow: {
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.2,
  },
  heroLede: {
    fontSize: 18,
    lineHeight: 29,
    color: Landing.onInkMuted,
    maxWidth: 560,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  primary: {
    paddingVertical: 15,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
    backgroundColor: Landing.accentBright,
    transitionDuration: '150ms',
  },
  primaryHovered: {
    backgroundColor: '#5FD494',
  },
  primaryText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: Landing.ink,
  },
  secondary: {
    paddingVertical: 15,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Landing.lineInk,
    transitionDuration: '150ms',
  },
  secondaryHovered: {
    borderColor: Landing.onInkMuted,
  },
  secondaryText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: Landing.onInk,
  },
  heroFootnote: {
    fontSize: 13,
    lineHeight: 18,
    color: Landing.onInkMuted,
    opacity: 0.8,
  },
  heroRail: {
    gap: Spacing.three,
  },
  heroRailWide: {
    flex: 2,
    paddingTop: Spacing.two,
  },
  railStat: {
    paddingBottom: Spacing.three,
    gap: 2,
  },
  railStatDivided: {
    borderBottomWidth: 1,
    borderBottomColor: Landing.lineInk,
  },
  railFigure: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -1.4,
    color: Landing.onInk,
  },
  railNote: {
    fontSize: 14,
    lineHeight: 20,
    color: Landing.onInkMuted,
    maxWidth: 320,
  },
  heroVisual: {
    paddingTop: 64,
    // The visual straddles the seam between the dark hero and the paper below,
    // so the page turns without a hard edge across the full width.
    marginBottom: -96,
  },

  /* bands */
  band: {
    paddingVertical: 96,
  },
  paperBand: {
    backgroundColor: Landing.paper,
  },
  altBand: {
    backgroundColor: Landing.paperAlt,
  },
  inkBand: {
    backgroundColor: Landing.ink,
  },
  featuresBand: {
    paddingTop: 72,
    gap: 88,
  },

  sectionLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Landing.accent,
    marginBottom: Spacing.three,
  },
  sectionLabelOnInk: {
    color: Landing.accentBright,
  },

  heading: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: -1.4,
    color: Landing.text,
    maxWidth: 520,
  },
  headingNarrow: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  headingOnInk: {
    color: Landing.onInk,
  },
  prose: {
    fontSize: 17,
    lineHeight: 29,
    color: Landing.textMuted,
    // Around 70 characters. Longer lines lose the reader between them.
    maxWidth: 620,
  },

  /* mission + scoring share a two-column shape */
  missionWide: {
    flexDirection: 'row',
    gap: 80,
  },
  missionLeft: {
    flex: 4,
    // Sticks while the prose beside it scrolls, so the heading is still there
    // for the paragraph that answers it.
    position: 'sticky',
    top: Spacing.six,
  },
  missionRight: {
    flex: 5,
    gap: Spacing.three,
  },
  missionRightNarrow: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
  },

  /* features */
  featureRow: {
    gap: Spacing.four,
  },
  featureRowWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 72,
  },
  featureRowFlipped: {
    flexDirection: 'row-reverse',
  },
  featureCopy: {
    gap: Spacing.two,
  },
  featureCopyWide: {
    flex: 5,
  },
  featureIndex: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 1,
    color: Landing.accent,
    fontVariant: ['tabular-nums'],
  },
  featureTitle: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: '700',
    letterSpacing: -0.9,
    color: Landing.text,
    maxWidth: 460,
  },
  featureTitleNarrow: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  featureVisual: {
    width: '100%',
  },
  featureVisualWide: {
    flex: 6,
  },

  /* restraint */
  neverList: {
    paddingTop: Spacing.five,
    gap: Spacing.four,
  },
  neverListWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
  },
  neverItem: {
    gap: Spacing.two,
  },
  neverItemWide: {
    // Two up, which gives each item room to be read. Four across would make
    // them into a feature grid, which is the shape this page is avoiding.
    width: '50%',
    paddingRight: 56,
    paddingBottom: Spacing.five,
  },
  neverRule: {
    width: 28,
    height: 2,
    backgroundColor: Landing.accentBright,
    marginBottom: Spacing.one,
  },
  neverTitle: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: Landing.onInk,
  },
  neverBody: {
    fontSize: 15,
    lineHeight: 25,
    color: Landing.onInkMuted,
    maxWidth: 420,
  },

  /* creators */
  creatorsLede: {
    paddingTop: Spacing.three,
    maxWidth: 640,
  },
  creatorRow: {
    paddingTop: Spacing.five,
    gap: Spacing.five,
  },
  creatorRowWide: {
    flexDirection: 'row',
    gap: 72,
  },
  creator: {
    gap: Spacing.one,
  },
  creatorWide: {
    flex: 1,
  },
  creatorRule: {
    width: 36,
    height: 2,
    backgroundColor: Landing.accent,
    marginBottom: Spacing.two,
  },
  creatorName: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: Landing.text,
  },
  creatorRole: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Landing.accent,
    marginBottom: Spacing.one,
  },
  creatorLine: {
    fontSize: 16,
    lineHeight: 27,
    color: Landing.textMuted,
    maxWidth: 440,
  },

  /* footer */
  footerBand: {
    paddingTop: 80,
    paddingBottom: Spacing.five,
    gap: Spacing.five,
  },
  footerInnerWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.five,
  },
  footerBrand: {
    gap: Spacing.two,
  },
  footerNote: {
    fontSize: 13,
    lineHeight: 18,
    color: Landing.onInkMuted,
  },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  footerLink: {
    paddingVertical: Spacing.one,
  },
  footerLinkText: {
    fontSize: 14,
    lineHeight: 19,
    color: Landing.onInkMuted,
  },
  footerBottom: {
    paddingTop: Spacing.four,
  },
  footerFine: {
    fontSize: 13,
    lineHeight: 21,
    color: Landing.onInkMuted,
    opacity: 0.7,
    maxWidth: 560,
    borderTopWidth: 1,
    borderTopColor: Landing.lineInk,
    paddingTop: Spacing.three,
  },
});
