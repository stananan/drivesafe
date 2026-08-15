# How DriveSafe scores a drive

Every drive gets a number from 0 to 100. This document is the whole derivation:
what the equation is, why each piece is shaped the way it is, and what we do
about speed limits.

Implementation: `src/lib/scoring.ts`.

---

## The equation

$$
\text{score} = 100 - \min\!\Big(100,\; W_s P_s + W_\ell P_\ell + W_j P_j + W_d P_d\Big)
$$

Four penalties: **speeding**, **cornering**, **harsh braking/acceleration**, and
**distraction**. None of them is a running total.

The first three come from the GPS trace alone. Distraction is the exception: it
counts the sustained loud-audio alerts raised by the microphone during the
drive, which the trace cannot see, so the caller passes the count in.

Speeding and cornering are *states* — things you are doing for a stretch of road
— so they are *time-weighted means* over the drive:

$$
P = \frac{\sum_i \Delta t_i \cdot f(\text{sample}_i)}{\sum_i \Delta t_i}
$$

where $\Delta t_i$ is how many seconds sample $i$ represents. $P$ is
dimensionless: "how hard was this drive pushed, on average".

Harsh braking is different — it is an *incident*, not a state. Averaging
incidents over time would dilute five hard stops in a long drive into nothing,
so those are counted **per ten minutes** instead:

$$
P_j = \frac{\sum_{\text{incidents}} f_j}{T / 600\text{s}}
$$

Distraction is counted the same way, for the same reason — a loud spell is
something that happens, not a state the drive is in:

$$
P_d = \frac{N_{\text{loud}}}{T / 600\text{s}}
$$

**Why not a running total.** If penalties accumulated, a long drive would always
score worse than a short one, and a driver's score would decay simply because
they drive a lot. Normalising asks the better question: *how did they drive*, not
*how long*. It also closes the obvious loophole — you cannot bury one reckless
stretch under thirty minutes of motorway cruising.

> This distinction was not obvious up front. The first version of this equation
> normalised everything the same way, which made five hard stops in a half-hour
> drive worth about 0.08 points — the tests caught it.

### 1. Speeding

$$
f_s = \left(\frac{\max(0,\; v_i - L_i)}{v_{\text{ref}}}\right)^{\!2}
\qquad v_{\text{ref}} = 5\ \text{mph}
$$

$v_i$ is speed, $L_i$ is the posted limit at that point.

**Why squared.** Kinetic energy goes as $v^2$, and the risk of a *fatal* outcome
rises faster than that — roughly to the fourth power of impact speed in the
pedestrian literature. Linear penalties would say 20 mph over is exactly twice as
bad as 10 over. Squaring says it is four times as bad, which is much closer to
the truth and matches how people actually think about it.

With $v_{\text{ref}} = 5$ mph, a whole drive held at 5 mph over gives $P_s = 1$
and costs $W_s = 10$ points. Held at 10 over, $f_s = 4$, costing 40. Held at
15 over, $f_s = 9$, costing 90 — a score of 10. That is the intended curve:
mild speeding is a nudge, serious speeding is most of your score.

### 2. Cornering — this is where road windiness enters

Nico asked whether we can account for how winding a road is. **We can, and
without any road database at all.**

The trace already contains the road's shape. For three consecutive fixes, the
change in heading per unit distance approximates the road's curvature:

$$
\kappa_i = \frac{\Delta\theta_i}{\Delta s_i}
$$

$\Delta\theta$ is the turn angle in radians between the incoming and outgoing
bearings, $\Delta s$ is the arc length. Curvature is $1/r$ — a 100 m radius bend
has $\kappa = 0.01\ \text{m}^{-1}$.

Curvature on its own is not dangerous. A winding road driven slowly is fine. What
matters is the **lateral acceleration** it produces:

$$
a_{\ell,i} = v_i^{2}\,\kappa_i
$$

This is the physics of whether a car holds a bend. Tyres on dry asphalt give out
somewhere around 8–9 m/s²; normal comfortable driving stays under about 3.

$$
f_\ell = \left(\frac{\max(0,\; a_{\ell,i} - a_{\text{comfort}})}{a_{\text{comfort}}}\right)^{\!2}
\qquad a_{\text{comfort}} = 3.0\ \text{m/s}^2
$$

This term is what makes the score *road-aware*. Taking a tight mountain bend at
40 mph and a motorway curve at 70 mph can produce identical lateral acceleration,
and both are penalised the same — correctly, because they are the same demand on
the same tyres. It also catches something the speed term never could: a driver
who is under the posted limit but still going far too fast for the road they are
on. On Marin's canyon roads that is the more common failure.

### 3. Harsh braking and acceleration

$$
f_j = \left(\frac{\max(0,\; |a_{\parallel,i}| - a_{j})}{a_{j}}\right)^{\!2}
\qquad a_j = 2.8\ \text{m/s}^2
$$

Longitudinal acceleration from successive speed deltas. Hard braking is the
classic proxy for following too closely or not reading the road ahead; hard
acceleration is the classic proxy for aggression. Both are well-established
telematics signals — it is roughly what insurers' black boxes measure.

### 4. Distraction

$$
N_{\text{loud}} = \text{count of sustained loud-audio alerts}
$$

Not derived from the trace. While a driver has audio alerts switched on,
DriveSafe reads the microphone's level meter; noise that stays above the alert
threshold for a sustained window raises one alert, rate-limited to one a minute.
$N_{\text{loud}}$ is how many fired.

**Why it counts at all.** A loud cabin is a documented crash risk factor — it
masks sirens and horns, and passenger noise is one of the strongest predictors
of teen-driver crashes specifically. **Why it counts less than the rest.** Noise
is evidence of a distracting *environment*, not of bad driving, and some of it is
not the driver's doing. It is weighted below every kinematic term on purpose,
and it is the one term a driver can switch off entirely by leaving audio alerts
off — a deliberate trade, since a feature that punishes you for enabling it is a
feature nobody enables.

### Weights

| Term | Weight | What it means in practice |
| --- | --- | --- |
| Speeding | 10 | A whole drive at 5 mph over costs 10 points; at 10 over, 40. Most directly tied to crash severity, and the behaviour a driver fully controls. |
| Cornering | 20 | A whole drive sustained at 6 m/s² (~0.6 g) lateral costs ~20 points. Weighted high per unit because sustaining that much lateral load is genuinely rare and genuinely dangerous. |
| Braking | 8 | Five hard stops in a half-hour drive costs ~8 points. Real signal, but sometimes someone else's fault — weighted so a driver is not punished for one good emergency stop. |
| Distraction | 6 | Two loud spells in a half-hour drive costs ~4 points. Lowest weight of the four: it measures the car's environment rather than the driving, and the alert threshold still needs road-test calibration. |

Verified behaviour from `src/lib/scoring.ts` tests:

| Drive | Score |
| --- | --- |
| 5 min straight at 30 mph, legal | 100 |
| 2 min on a 100 m-radius bend at 30 mph ($a_\ell = 1.8$) | 100 |
| Same bend at 55 mph ($a_\ell = 6.0$) | 79 |
| That same 1 min bend, followed by 10 min of calm driving | 98 |

The last two lines are the normalisation doing its job: identical bad behaviour,
scored in proportion to how much of the drive it was.

---

## Speed limits: the one piece we do not have yet

The cornering and braking terms need nothing but the trace. The speeding term
needs $L_i$, the posted limit, and that has to come from somewhere.

### What ships today

`inferSpeedLimit()` derives a limit from observed speed, rounding up to the
nearest plausible California posted value (25/35/45/55/65). This is deliberately
**conservative**: because the inferred limit is derived from the driver's own
speed, it can never invent a low limit and manufacture a speeding penalty out of
nothing. In practice it detects only egregious speeding, and the cornering term
carries most of the signal.

This is a stand-in, and it is honest to call it one.

### The real integration: OpenStreetMap

OSM tags roads with `maxspeed`, it is free, and it needs no API key.

1. **Simplify the trace.** Snap the drive to ~100 m segments — a 30-minute drive
   becomes maybe 40 lookups instead of 1800.
2. **Query Overpass** for ways near each segment midpoint:
   ```
   way(around:25,LAT,LON)[highway][maxspeed];
   out tags geom;
   ```
3. **Pick the way** whose bearing best matches travel direction. This is the step
   that stops a frontage road from being scored against the motorway beside it.
4. **Fall back down a ladder** when `maxspeed` is missing (it often is):
   `maxspeed` → infer from `highway` class (`motorway` 65, `primary` 45,
   `residential` 25) → conservative default.
5. **Cache by segment.** Families drive the same roads daily; a small local cache
   keyed by rounded coordinate collapses almost all repeat lookups.

The seam already exists — `scoreDrive(route, { limitFor })` takes a
`SpeedLimitProvider`. Adding OSM means writing that one function; the equation
and every call site stay untouched.

**Trade-offs.** Overpass has no SLA and rate-limits aggressively, so lookups
should happen once when the drive is saved, never during it. Coverage of
`maxspeed` in Marin is good on numbered routes and patchy on residential streets
— which is exactly where the fallback ladder matters. Paid alternatives (HERE,
TomTom, Google Roads) have better coverage and cost money.

---

## Honest limitations

- **Phone GPS speed is imperfect**, especially under tree cover. Fixes with
  accuracy worse than 30 m are dropped, and curvature is only computed above
  4.5 mph where heading is meaningful.
- **We cannot tell who was driving.** A passenger's phone records the same trip.
  Handling that properly needs Bluetooth-to-car pairing or motion classification.
- **The distraction threshold is uncalibrated.** The alert fires above −12 dBFS
  sustained for 1.5 s, which is a starting guess. Microphone sensitivity varies
  enormously between phones and mounting positions, so the same conversation can
  read very differently in two cars. Until a road test pins this down, the
  distraction term is the least trustworthy of the four — which is part of why
  it carries the lowest weight.
- **Distraction is skipped on very short drives.** Anything with under 30 s of
  usable trace scores a clean 100 regardless, because there is not enough of a
  drive to judge. A loud two-minute trip therefore goes unpenalised.
- **Context is invisible.** Braking hard because a child stepped out is scored
  the same as braking hard from tailgating. This is why braking is weighted
  lowest, and why the app shows *events* next to the number — the score starts a
  conversation, it does not end one.
- **A short drive is not scored.** Under 30 seconds of usable trace returns 100
  rather than a number invented from three noisy points.

---

## Worked example

A 20-minute drive (1200 s). The driver spends 60 s at 12 mph over the limit,
takes one bend at $a_\ell = 5.4\ \text{m/s}^2$ for 8 s, and brakes hard three
times at $4.5\ \text{m/s}^2$.

**Speeding.** Excess ratio $= 12/5 = 2.4$, so $f_s = 5.76$ during those 60 s.

$$P_s = \frac{60 \times 5.76}{1200} = 0.29 \quad\Rightarrow\quad 10 \times 0.29 = 2.9\ \text{points}$$

**Cornering.** Excess $= (5.4-3.0)/3.0 = 0.8$, so $f_\ell = 0.64$ for 8 s.

$$P_\ell = \frac{8 \times 0.64}{1200} = 0.0043 \quad\Rightarrow\quad 20 \times 0.0043 = 0.09\ \text{points}$$

**Braking.** Each stop: $((4.5-2.8)/2.8)^2 = 0.37$. Three of them in 1200 s,
which is two ten-minute windows:

$$P_j = \frac{3 \times 0.37}{2} = 0.55 \quad\Rightarrow\quad 8 \times 0.55 = 4.4\ \text{points}$$

**Score:** $100 - (2.9 + 0.09 + 4.4) \approx 93$.

That reads correctly: a mostly-fine drive with a bit of speeding and some heavy
braking. Note how the single quick corner barely registers — it was 8 seconds out
of 20 minutes — while the three hard stops matter more, because incidents are
counted rather than averaged away. Getting that asymmetry right is the whole
reason the three terms are normalised differently.
