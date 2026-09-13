/**
 * The landing page's own palette and type scale.
 *
 * Separate from the app theme on purpose. The app is a tool someone uses while
 * driving, so it is one flat, calm, light green — no contrast it does not need.
 * A landing page is read once by someone deciding whether to trust this with
 * their family, and it has to hold attention through several screens of
 * scrolling. That needs range: a deep ground to open on, paper to read on, and
 * a rhythm between them.
 *
 * The greens are the app's own, extended at both ends rather than replaced, so
 * the page and the product are recognisably the same thing.
 */

export const Landing = {
  /** Deep forest. The hero and the closing bands. */
  ink: '#0B1D13',
  inkRaised: '#12291C',
  /** Hairlines on the dark ground. */
  lineInk: '#1F3B2A',
  /** Body text on the dark ground — off-white, never pure. */
  onInk: '#E6F2EA',
  onInkMuted: '#8FAE9C',

  /** The app's own ground, reused so the page and the product match. */
  paper: '#EAF6EE',
  paperAlt: '#F4FAF6',
  line: '#C3DFCD',

  text: '#0F1F16',
  textMuted: '#55685D',

  /** The brand green, unchanged from the app. */
  accent: '#2E8B57',
  accentBright: '#48C182',
  warning: '#B7791F',

  /** Map mock. */
  mapGround: '#DDEEE2',
  mapBlock: '#CFE6D6',
  mapRoad: '#FFFFFF',
} as const;

/** The width the content sits in. Wider than a reading measure, narrower than a page. */
export const LandingWidth = 1120;

/** Below this the page stops being two columns and becomes one. */
export const LandingBreakpoint = 900;
