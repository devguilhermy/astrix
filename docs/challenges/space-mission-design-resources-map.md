# Space Mission Design Game: how each resource is used

Legend: 🎮 shown in the game · 🏗️ used while building (offline) · 📖 cited in the glossary or sources panel · ⭐ the 8 resources listed by the challenge · ➕ extra (not listed by the challenge)

## Map: resource → game screen

```
  CHALLENGE RESOURCES ⭐                         GAME SCREENS
  ══════════════════════                         ════════════

  📄 Design & Develop Science Missions ──┬──────▶ 🎯➡️📊 phase order (need → concept → design → launch → operate)
     segments: launch·space·ground·user  └──────▶ 👥 the 4 roles (🚀 launch · 🛠️ space · 📡 ground · 🔬 user/science)

  📈 Concept Maturity Levels (JPL) ──────────────▶ 🏷️ level badges: CML 1 idea → 2–3 concept → 4 point design

  🏢 Mission Design Lab (Goddard) ───────┬──────▶ 🤖 "design review" step before launch
     power·comms·thermal·cost·risk…      └──────▶ 📖 role cards and glossary terms

  🧊 CubeSat 101 (NASA CSLI) ────────────┬──────▶ ⚖️ hard mass cap: 1U<1.33 · 2U<2.66 · 3U<4.00 kg
     sizes · dispensers · deorbit        ├──────▶ 🚀 rideshare slot fitting (6U dispenser holds 1×6U, 2×3U, 6×1U…)
                                         └──────▶ 📖 why small satellites must deorbit in time

  🛰️ GMAT (open-source) ─────────── 🏗️ offline ─▶ 📋 orbit table (passes per day, view time) 🎮 orbit picker
                                                     (precomputed once; never runs in the browser)

  🌐 NASA Mission Viz ───────────── 🏗️ reference ▶ 🌍 orbit view (3D ellipse + simple propagator tutorial)

  🔭 Webb "Build It Yourself" game ─ 🏗️ precedent ▶ 🧩 constrained choices + 🔭 "real missions like yours"

  🍁 CSA Digital Games & Activities ─ 🏗️ precedent ▶ 🧑‍🏫 educator corner links (OSIRIS-REx site game, Mission: Astronaut)

  EXTRAS ➕ (allowed; label as outside the challenge list)
  ═══════════════════════════════════════════════════════
  🗂️ nasa.json (USGS Astrogeology) ───────────────▶ 🔭 report: "real missions like yours" + their map products
  ☀️ DONKI CME 2024-05-20 ────────────────────────▶ ⚡ operate event: real solar storm → safe mode decision
  ☢️ RadLab ISS dose (median 4.6, max 527 µGy/h) ─▶ 🌍 orbit picker: radiation in low Earth orbit is real and uneven
```

## By screen

```
 🎯 GOAL ─────────── 📄 science-mission "need & goals" step · 🏷️ CML 1
 👥 ROLES ────────── 📄 four segments → four roles · 🏢 MDL disciplines on role cards
 🛠️ DESIGN BENCH ─── 🧊 CubeSat size + mass cap (real) · 🤖 MDL-style review · 🏷️ CML 4
 🚀 LAUNCH & ORBIT ─ 🧊 dispenser slot fit · 🛰️ GMAT orbit table · 🌐 Mission Viz-style view · ☢️ RadLab ➕
 🛰️ OPERATE ─────── ☀️ DONKI storm event ➕ · 📡 contact passes from the 🛰️ GMAT table
 📊 REPORT ──────── 🔭 Webb-style reveal using 🗂️ nasa.json ➕ · 📖 sources panel lists everything above
```

## How firmly each resource is used

```
 ⭐ resource                    🎮 in game   🏗️ build   📖 cite   Real numbers in game?
 ─────────────────────────────  ──────────   ────────   ───────   ──────────────────────────
 📄 Design & Develop Missions      ✅            ✅         ✅      structure only
 📈 CMLs                            ✅            —          ✅      labels only
 🏢 Mission Design Lab              ✅            —          ✅      role names only
 🧊 CubeSat 101                     ✅            ✅         ✅      ✅ mass and size limits
 🛰️ GMAT                            via table    ✅         ✅      ✅ once the table exists (not yet)
 🌐 Mission Viz                     —             ✅         ✅      — (visual reference)
 🔭 Webb learning game              —             ✅         ✅      — (design precedent)
 🍁 CSA Digital Games               link          —          ✅      — (educator links)
```

## Gaps

- 🧪 **Part specs** (instrument mass, power, cost, data) are **not in any listed resource**. They must come from cited NASA mission pages or be labelled "game assumption".
- 🧪 **Launch vehicle capacity and price** are not in the listed resources either. Rideshare slot sizes come from CubeSat 101; capacities and costs need a source.
- 🛰️ **The GMAT table doesn't exist yet.** Plan: a handful of circular orbits (e.g. 400 km, 550 km, sun-synchronous) → passes per day over one ground station.
