# How DriveSafe scores a drive

Every drive starts at 100. Two things take points off: **going too fast**, and
**letting the car get loud**. Nothing else.

$$
\text{score} = 100 - \min\!\Big(100,\; W_s P_s + W_d N_d\Big)
$$

That is the entire model. It is deliberately smaller than what it replaced, and
the reasoning for that is at the bottom under [What was removed, and
why](#what-was-removed-and-why).

---

## 1. Speeding

$$
P_s = \sum_i \frac{\Delta t_i}{10}\left(\frac{\max(0,\; v_i - L_i)}{v_\text{ref}}\right)^{\!2}
\qquad v_\text{ref} = 5\ \text{mph}
$$

$v_i$ is speed, $L_i$ the limit at that point, $\Delta t_i$ the seconds the
sample stands for. Weight $W_s = 0.5$.

**Time-weighted, not counted.** It matters how long the car was over the limit,
not how many separate times it crossed. One long spell and three short ones
adding to the same duration cost the same, which is right: the risk is the
exposure.

**Squared, because crash energy is.** Kinetic energy goes as $v^2$ and the risk
of a fatal outcome rises faster still — roughly to the fourth power of impact
speed in the pedestrian literature. Ten over is far worse than twice five over,
and the arithmetic should say so.

**Where the speed comes from.** The phone's own reading, which it derives from
Doppler shift. This matters more than it looks: an earlier version recovered
speed by differentiating position, and a single reflection off a building —
which moves a position fix tens of metres while leaving Doppler untouched —
produced an acceleration around 40 m/s² and scored an otherwise careful drive
**2 out of 100**. Position is now only the fallback, for the times iOS reports
`-1`.

### The limit

$L_i$ comes from OpenStreetMap, looked up when the drive ends. `speed-limits.ts`
does the work; `npm run check-limits` verifies it against a real Overpass
response for central Marin.

**Coverage is partial, and predictably so.** In that sample, every motorway and
every secondary road carried a `maxspeed` tag. Not one of the 122 residential
streets did. So there are two paths:

| | Source | Margin |
| --- | --- | --- |
| **Tagged** | The `maxspeed` on the way | None — this is read, not guessed |
| **Untagged** | California's prima facie limit for the road class | +8 mph |

The margin exists because a guess that comes in low invents a speeding penalty
out of legal driving, and a driver punished for obeying a sign stops believing
the score entirely. Some residential streets really are posted at 35, so an
inferred 25 is given room to be wrong in the safe direction.

Where neither applies — off the map, or Overpass unreachable — the limit falls
back to a flat **80 mph**, which is the old behaviour and deliberately high
enough that nobody crosses it by accident.

### Matching a fix to a road

Harder than it sounds, and the reason this is not fifty lines. A GPS fix sits
within a few metres of several roads at once: the street being driven, whatever
crosses it, the frontage road beside the motorway. Nearest-road matching picks
the wrong one regularly, and a single wrong pick invents a limit change halfway
down a street.

Three things resolve it:

1. **Distance to the road, not to its nodes.** Perpendicular distance to each
   segment, so a long straight way is not judged by how far away its endpoints
   happen to be.
2. **Heading.** A road running across the direction of travel is not the road
   being driven, however close it is. Bearings are compared modulo 180°, since a
   street runs the same way whichever end you enter from. Below walking pace the
   heading is noise, so the filter is dropped and only a road within 10 m is
   accepted.
3. **Smoothing.** A fix whose limit disagrees with both its neighbours takes
   theirs. A real limit change lasts more than one fix; a mis-snap does not.

Verified against real geometry: 100% of fixes along a tagged motorway read
65 mph, 100% along a tagged secondary read 35, 100% along an untagged
residential fell back to the class limit, one street reads as exactly one limit
end to end, and a drive nowhere near the data gets no invented limit at all.

---

## 2. Distraction

$$
N_d = \text{count of sustained loud-audio alerts}
$$

Weight $W_d = 5$, so each flag costs 5 points, flat.

Not derived from the trace. While a driver has audio alerts on, DriveSafe reads
the microphone's level meter; noise that stays above the threshold for a
sustained window raises one alert, rate-limited to one a minute. $N_d$ is how
many fired.

**Counted flat, not rated.** The monitor already rate-limits itself, so a flag
is a real, spaced-out event rather than a continuous state. Dividing by drive
length would just make the same behaviour cost less on a longer trip.

**Why it counts at all.** A loud cabin masks sirens and horns, and passenger
noise is one of the strongest predictors of teen-driver crashes specifically.
**Why it is capped in practice.** The alert threshold behind it
(`LOUD_THRESHOLD_DBFS`) is still uncalibrated — see `TODO.md`.

---

## What the numbers actually do

From `npm run simulate`, which runs synthetic traces through the real scorer:

| Drive | Score |
| --- | --- |
| Quiet suburban errand | 100 |
| City stop-and-go with junction turns | 100 |
| Motorway cruise at 65 | 100 |
| Calm drive, GPS misbehaving | 100 |
| Fast bend and hard stops, never over 80 | **100** |
| Sustained 85 mph for 10 minutes | 70 |
| Brief 95 mph blast | 86 |
| Legal speed, four noise flags | 80 |

The fifth row is the trade this model makes, stated plainly.

---

## What was removed, and why

Earlier versions also scored **cornering** (lateral acceleration from the
curvature of the GPS trace) and **harsh braking/acceleration** (longitudinal
acceleration between fixes). Both are gone.

**They could not be verified.** Cornering asks "was that too fast for this
bend", which cannot be answered without knowing the bend. A 25 mph turn is
reckless on a wet mountain road and unremarkable in a car park, and the trace
cannot tell them apart.

**They punished ordinary driving under bad GPS.** Both are second-order
quantities — differences of differences — so every error in the trace is
amplified. Simulation put a single bad fix at 98 penalty points. Some of that
was fixable, but it showed how narrow the margin was between "detects hard
braking" and "detects a tunnel".

**They were uncalibratable in the time available.** The thresholds (3.0 m/s²
lateral, 2.8 m/s² longitudinal) were educated guesses. Turning a guess into a
number needs many real drives by many drivers, which this project does not have.

**And they made the score unexplainable.** A teenager who does not understand
why they lost points does not drive differently; they conclude the app is
broken. "You did 85" and "it got loud in here" are things a driver can argue
with, act on, and check.

The code is in the git history if the evidence ever justifies bringing it back.

---

## Why OpenStreetMap, and what it would take to move

`SpeedLimitProvider` is still the seam — a function from coordinate to limit — so
swapping the source changes nothing else. The options, honestly compared:

| Source | Cost | Coverage | Catch |
| --- | --- | --- | --- |
| **OpenStreetMap / Overpass** | Free, no key | `maxspeed` good on numbered routes, patchy on residential | No SLA, rate-limited, needs a fallback ladder |
| **Mapbox** | Free to 100k requests/month | Good | Needs a token and a billing account |
| **HERE** | Free to ~1k requests/day | Best of the three | Needs a token; the daily cap is tight |
| **Google Roads** | Paid only | Good | Speed limits need an Asset Tracking licence — effectively out of reach |

Overpass is what ships, at **one request per drive** — every way in the drive's
bounding box, matched locally — rather than one per GPS fix. Long drives split
into at most four requests.

**Its weakness is availability, not data.** While this was being written, three
of four public instances refused in a row: one too busy, one a 500, one an empty
body. So three mirrors are tried in turn, and everything fails soft — a drive
scored against the flat 80 is worse than one scored properly, but it is far
better than a drive that will not save because a donated server was busy.

If that becomes a problem, Mapbox is the upgrade: a token, a billing account,
and an SLA in exchange for the flakiness.
