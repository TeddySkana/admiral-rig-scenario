# Skana - Admiral's Rig Protection Senario

Static HTML + CSS + JavaScript project with two pages:

1. `index.html` - mission setup screen matching the supplied structure and dark maritime style.
2. `simulation.html` - interactive offshore rig protection simulation.

## How to run

Open `index.html` in a browser and click **Launch Offshore Mission**.

For local development, you can also run a simple server from this folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Implemented scenario rules

- Rig radar discovers new boats only when they are inside 12000 yd.
- Boats are hidden until discovered.
- On discovery, each boat is challenged by radio.
- 30% of boats respond and remain green/compliant, avoid the 5000 yd protected polygon, and continue away.
- 70% do not respond, turn orange/suspicious, and trigger interception.
- Attack timing is decided once on simulation load:
  - 50% coordinated branch: both boats start at a random point between 5-15 minutes.
  - 50% separated branch: first starts between 5-10 minutes and second between 15-20 minutes.
- BS 401 patrols the 3000 yd dynamic ring.
- BS 402 holds the 500 yd static ring.
- BS 403 is a reserve boat and launches after a 5 minute readiness delay when needed.
- Interception process:
  - 40 kt toward suspicious boat until 5000 yd range.
  - 20 kt zigzag from 5000 yd to 2000 yd.
  - Warning flare phase at 2000 yd.
  - HQ approval popup at 1000 yd. It is red for about one second and then green.
  - Video feed appears after HQ approval.
  - MAG engagement has 70% hit probability.
  - The code blocks MAG fire when the interceptor bow points toward the rig.
  - If MAG misses and the target closes to 200 yd, the interceptor rams as last resort.
- Boats are modeled internally with three points and rendered as narrow triangles.
- Range rings include numeric labels.
- Scale bar uses the segmented black/white style from the supplied reference.


## Local launch / file URL note

Open the project through a tiny local web server instead of a `file://` URL if the browser reports an unsafe `file:` frame/navigation error.

Windows:

```bat
run_local_server.bat
```

macOS/Linux:

```sh
./run_local_server.sh
```

Then open `http://localhost:8000` and launch the scenario from the first page.


## v3 fixes

- Removed animated wave motion from the map background.
- The simulation now automatically switches to x10 when the interception state activates.
- Removed the orientation-map title while keeping the minimap overlay.
- Neutral civilian traffic is generated on a dashed white line from outside the map to outside the map while staying outside the 12000 yd ring.

## v4 fixes

- Threat boats now spawn outside the 15 x 15 NM map and enter from off-map before radar discovery.
- Radio-compliant boats turn away and leave the map on a safe course that does not cross inside the 5000 yd protected polygon.
- HQ violent-interception approval pauses the simulation until the operator clicks **Confirm Interception** or **Cancel Display**. Either response resumes at x1.
- The approval screen no longer auto-confirms.
- The mission-state panel will not remain on **Return to dynamic patrol ring** while another detected suspicious/hostile boat is still active.

## v5 fixes

- BS 402 now leaves the static guard ring and joins interception when a suspicious/hostile threat reaches the 6000 yd radius.
- BS 401 first navigates to a blocking point on the threat-to-rig line, then closes toward the threat.
- Once a threat enters the 5000 yd protected polygon, all available blue vessels point directly at that threat and close in.

## v6 fixes

- Threat boats now spawn at a 15000 yd radius from the rig.
- The simulation switches to x10 when a threat activates/enters the map and again when it is first detected, before the suspicious decision.
- Coordinated attacks now use the same activation time and equal spawn radius, so both boats arrive together from different angles.
- HQ approval remains paused for operator input; the red approval state lasts five seconds before turning green, and either button resumes at x1.
- BS 401 returns to the nearest point on the 3000 yd patrol ring before resuming circular patrol instead of snapping back to the circle. BS 402 similarly returns to the nearest point on the 500 yd static ring after support interception.
"# admiral-rig-scenario" 
