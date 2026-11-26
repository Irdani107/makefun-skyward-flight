# SKYWARD — Meridian Coast

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Irdani107/makefun-skyward-flight/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Irdani107/makefun-skyward-flight/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A 3D flight game in the browser. Take off from the island runway, fly the eight glowing rings around the Meridian Coast — past the river inlet, the lighthouse point and the lit shore town — then bring her home and land on the runway for your grade.

- Chase view over a procedural island: beaches, a river inlet, hills, a town of lit windows, a lighthouse, distant mountains
- A low-poly prop plane with an arcade flight model: throttle, banked turns, stalls, ground roll and touchdown judging
- A full instrument panel: airspeed and altimeter gauges with lit needles, an artificial horizon, throttle bar, and altitude / speed / heading readouts
- Keyboard and mouse steering, pause, restart, a demo autopilot, and S/A/B/C landing grades

## Run it

Open `game/index.html` in a desktop browser — it runs from the files alone, no server and no network. Or serve the folder:

```
npx serve game
```

Controls: W/S or ↑/↓ climb and descend, A/D or ←/→ bank and turn, mouse steers (M toggles), Shift/Ctrl throttle, P pause, R restart.

The hand-in program copies the game and its screenshots to the output directory and writes the dossier:

```
MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
```

Built for the make.fun bounty "Make the best flight game". If you try make.fun, this referral link supports the author: https://make.fun/r/bn71hm0w
