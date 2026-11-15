# Space Mission Design Game: ASCII mockup

**Reference sketch, not the default UI:** raw metrics below are optional Technical details. The current default uses plain choices, outcome previews and visible Lucide Explain / Entenda buttons beside every scientific context. See [SCIENCE_UX.md](../SCIENCE_UX.md) and [implementation plan §7](../GAME_IMPLEMENTATION_PLAN.md#7-ui). Emoji are planning notation only; the product uses Lucide.

**About the numbers:** the CubeSat mass limits (3U < 4.00 kg, 6U and 12U sizes) come from [CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf). Every other number is a placeholder (🧪) that needs a source or a "game assumption" label.

## 1. Mission flow (follows the NASA design flow and Concept Maturity Levels)

```
 🎯 NEED & GOAL ──▶ 💡 CONCEPT ──▶ 🛠️ DESIGN ──▶ 🚀 LAUNCH ──▶ 🛰️ OPERATE ──▶ 📊 REPORT
   CML 1            CML 2–3        CML 4        & ORBIT      (timeline)      why it worked
   "what do we      pick size      fit parts    pick ride    events hit      score + real
    want to learn?" + orbit type   in budgets   + orbit      you live        missions like yours
                                                                    │
                    ◀──────────── 🔁 redesign & fly again ◀─────────┘
```

## 2. Crew roles (1 to 4 players; one player covers all four)

```
 ┌─────────────────────┬─────────────────────┬─────────────────────┬─────────────────────┐
 │ 🔬 SCIENCE LEAD      │ 🛠️ SPACECRAFT ENG.   │ 🚀 LAUNCH & ORBIT    │ 📡 GROUND & COMMS    │
 │ owns the goal       │ owns mass + power   │ owns ride + orbit   │ owns data + contact │
 │ wants: more         │ wants: margin       │ wants: cheap ride   │ wants: downlink fits│
 │  instruments        │                     │                     │                     │
 └──────────┬──────────┴──────────┬──────────┴──────────┬──────────┴──────────┬──────────┘
            └──────────── 🤝 shared budget: 💰 cost · ⚖️ mass · ⚡ power · 💾 data ─────┘
```

## 3. Design bench (the core screen)

```
 MISSION: "Watch the Sun's storms from Earth orbit" ☀️          CML 4 · Point design
 ════════════════════════════════════════════════════════════════════════════════════

  SPACECRAFT: 3U CubeSat 🧊🧊🧊           PARTS BIN
  ┌──────────────┐                       ┌──────────────────────────────────────────┐
  │ U3 📷 Camera  │ ◀── drag ──────────── │ 📷 Camera     ⚖️🧪 ⚡🧪 💾🧪 💰🧪            │
  ├──────────────┤                       │ ☢️ Radiation   ⚖️🧪 ⚡🧪 💾🧪 💰🧪            │
  │ U2 🔋 Battery │                       │ 🔋 Battery     ⚖️🧪 ⚡+🧪     💰🧪            │
  │    💻 Computer│                       │ 🌞 Solar wings ⚖️🧪 ⚡+🧪     💰🧪            │
  ├──────────────┤                       │ 📡 Radio       ⚖️🧪 ⚡🧪 💾↓🧪 💰🧪           │
  │ U1 📡 Radio   │                       │ 🧭 Attitude    ⚖️🧪 ⚡🧪      💰🧪            │
  │    🧭 Attitude│                       └──────────────────────────────────────────┘
  └──────────────┘
   🌞 solar wings ⟨═══╪═══⟩

  BUDGETS                                   used / limit
  ⚖️ Mass   ██████████████████░░░░  3.42 / 4.00 kg  ✅  (3U limit: CubeSat 101)
  ⚡ Power  ████████████████████▓▓  ⚠️ 104% of generation  🧪
  💾 Data   ██████████░░░░░░░░░░░░   46% of downlink       🧪
  💰 Cost   ███████████████░░░░░░░   68% of budget         🧪

  🤖 Design review: "Power is over budget. Add solar wings (+mass) or drop the camera duty cycle."
```

## 4. Every choice ripples (what the game teaches)

```
                         ➕ add a 2nd 📷 camera
                                   │
          ┌───────────────┬────────┴───────┬────────────────┐
          ▼               ▼                ▼                ▼
      🔬 science ↑     ⚖️ mass ↑         ⚡ power ↑        💾 data ↑
          😀              │                │                │
                          ▼                ▼                ▼
                   maybe needs 6U    needs 🌞 bigger    needs 📡 more
                   🧊🧊🧊🧊🧊🧊        wings (more ⚖️)     contact time
                          │                │                │
                          └──────▶ 💰 cost ↑ ◀──────────────┘
                                   🚫 over budget? → 🔁 trade something away
```

## 5. Refusals that explain themselves

```
 🚫 Can't add ☢️ Radiation sensor
    ⚖️ Mass would be 4.31 kg; a 3U CubeSat must stay under 4.00 kg.
    Try:  ➖ remove a part   ·   ⬆️ switch to 6U (💰 more)   ·   🔁 lighter version
```

## 6. Launch and orbit

```
                         🌍 EARTH
                   . ·  ˙  ‾‾‾‾‾  ˙  · .
               ·  ˙   🛰️ LOW ORBIT       ˙  ·        LOW  🛰️  📡 short passes · 🍂 decays sooner 🧪
            ·     ╭───────────────╮        ·         HIGH 🛰️  📡 longer view  · ☢️ more radiation 🧪
           ·     ╭│     🌍       │╮       ·
            ·     ╰───────────────╯       ·          🚀 RIDE:  rideshare dispenser (6U slot)
               ·        🛰️ HIGH ORBIT  ·                       ✅ fits 3U   ✅ mass OK
                   ˙ ·  .  _____  .  · ˙
```

## 7. Operate: mission timeline with events

```
 DAY  1      10      20      30      40      50      60      70      80      90
      ├───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┤
 🛰️   ▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶
 📡   ▌ ▌  ▌ ▌  ▌ ▌  ▌ ▌  ▌ ▌  ▌ ▌  ▌ ▌  ▌ ▌  ▌ ▌  ▌ ▌  ▌ ▌  ▌ ▌  ▌ ▌  (ground passes)
 🔋   ▇▇▇▇▇▇▇▆▆▆▆▅▅▅▅▅▅▆▆▆▆▆▇▇▇▇▇▇▇▆▆▆▆▅▅▅▃▃▃▅▅▅▆▆▆▆▆▆▆▆▅▅▅▅▅▅▅▅▅▄▄▄▄▄▄▄▄
 💾   ▁▂▃▄▅▆▇▂▃▄▅▆▇▂▃▄▅▆▇▂▃▄▅▆▇▂▃▄▅▆▇█▇▇█▆▃▄▅▆▇▂▃▄▅▆▇▂▃▄▅▆▇▂▃▄▅▆▇▂▃▄▅▆▇
                          ▲                   ▲                  ▲
                    ☀️ SOLAR STORM       💾 storage full      🔋 battery aging
                    "safe mode?"         "drop old data?"     "cut camera time?"
                    [🛡️ safe] [📷 keep]   [🗑️ drop] [⏸️ wait]  [✂️ cut] [🤞 risk]
```

## 8. Mission report

```
 📊 MISSION REPORT: "Sun Watcher" 🛰️                     ⭐⭐⭐☆☆
 ───────────────────────────────────────────────────────────────────
  🎯 Goal met              ████████████████░░░░  80%
  🔬 Science value         ██████████████░░░░░░  70%
  💰 Budget left           ██████░░░░░░░░░░░░░░  30%
  🤝 Team decisions        ██████████████████░░  90%

  💥 What hurt:  ☀️ the storm on day 23 hit while ⚡ power had no margin → 4 days lost
  💡 Try next:   add one more 🌞 wing, or choose 🛡️ safe mode earlier

  🔭 REAL MISSIONS LIKE YOURS                       (from nasa.json / USGS facets)
     🛰️ Mars Odyssey ........ 119 map products   (thermal imaging orbiter)
     🛰️ Mars Reconnaissance . 58 map products
     🛰️ Lunar Recon. Orbiter  168 map products
                                                 [🔁 Redesign]  [🏆 Leaderboard]
```

## 9. Screen map

```
  🏠 Start ─▶ 🎯 Pick goal card ─▶ 👥 Choose roles (1–4) ─▶ 🛠️ Design bench ◀─┐
                                                              │              │
                                                              ▼              │
                                     📊 Report ◀── 🛰️ Operate ◀── 🚀 Launch   │
                                        │                                    │
                                        └────────── 🔁 Redesign ─────────────┘
                                        └─▶ 🏆 Leaderboard   📖 Glossary   🧪 Sandbox
```
