/**
 * The shared shape of both map components.
 *
 * `react-native-maps` is native-only — it imports React Native internals that
 * do not exist in a browser, and it alone kept the whole app from building for
 * web. Rather than fork the screens, each map has a `.web.tsx` twin that draws
 * the same thing with Leaflet, and every screen imports the same name.
 *
 * Anything added here has to be expressible on both. That is a real constraint:
 * it is why these describe *what to show* rather than exposing a map instance to
 * be commanded around.
 */

export type MapPin = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  /** Drawn differently — this is the person currently on a drive. */
  isDriving?: boolean;
  isSelected?: boolean;
};

export type RouteMapProps = {
  /** Ordered coordinates. Fewer than two and there is no line to draw. */
  route: { lat: number; lon: number }[];
  height?: number;
  /** Allow panning and zooming. Off inside scroll views, which it fights. */
  interactive?: boolean;
  /**
   * Track the newest point rather than framing the whole route. For a drive in
   * progress, where framing everything zooms further out with every mile.
   */
  follow?: boolean;
};

export type PinsMapProps = {
  pins: MapPin[];
  height?: number;
  /** Centre on this pin when it changes. */
  focusId?: string | null;
  /** Fill the parent rather than taking a fixed height. */
  fill?: boolean;
};
