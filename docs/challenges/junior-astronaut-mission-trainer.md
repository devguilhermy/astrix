# Build a Junior Astronaut Mission Trainer

- **Page:** <https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/> (Details, [Resources](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/?tab=resources), Teams)
- **Captured:** 2026-11-14, from the rendered page
- **Difficulty:** Intermediate; Beginner/Youth
- **Subjects:** Games, Planets & Moons, Software, Space Exploration, Sun

## The ask

Build an interactive game or app that lets **kids aged 7–12** run a lunar or Martian outpost. Players make real decisions about **life support, radiation shielding, power budgeting, food production and communication delay**, and see how those choices play out over a simulated mission. The page describes the gap like this: kids' space content is either too abstract (posters, facts) or too technical. The trade-off logic behind a mission rarely reaches students.

The page asks for a working prototype. A young player should finish it understanding a real constraint of deep-space survival, not just having played a fun game. Any format is allowed: survival resource management, a narrative decision tree, a mission-control dashboard; browser, mobile or desktop. Outposts other than the Moon and Mars are also welcome.

## Considerations (optional, per the page)

| Theme | What the page says |
|---|---|
| Audience | Ages 7–12, ideally also older siblings, parents and classrooms. Plain language; explain *radiation dose*, *microgravity* and *sol* in context. Browser play with no download or account. |
| Real data | Prefer NASA APIs and open datasets to invented numbers; "even a small amount of real data" helps. Attribute sources inside the tool. An embedded curated dataset is fine, but don't present static data as live. |
| Pitfalls | No "safe" choice without a cost. Visual polish doesn't replace mechanical accuracy. Two or three core resources (life support, power, shielding) beat five or six. |
| What stands out | Linking a shielding choice to **actual space weather data**. Replayability: events that vary, and failure that isn't punitive. A short write-up of which datasets were used and why. |

## Resources tab (7 entries, 8 links; all reachable on 2026-11-14)

| # | Resource | Provider | What it gives the game |
|---|---|---|---|
| 1 | [NASA Open APIs](https://api.nasa.gov/) | NASA | API keys and a gateway (DONKI is also exposed here). `DEMO_KEY` is rate-limited. |
| 2 | [DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) | NASA GSFC / CCMC | Solar flares, CMEs and SEP events. JSON from `https://ccmc.gsfc.nasa.gov/DONKI/WS/get/{CME,FLR,SEP}`, no key needed. |
| 3 | [OSDR](https://osdr.nasa.gov/bio/repo/) + [search API](https://osdr.nasa.gov/osdr/data/search?term=KEYWORD) | NASA | Space-biology and astronaut-health studies, as JSON metadata. |
| 4 | [RadLab](https://visualization.osdr.nasa.gov/radlab/gui/data-api/) | NASA OSDR | ISS dosimetry: `absorbed_dose_rate` in µGy/h. API at `https://visualization.osdr.nasa.gov/radlab/api/`. The docs page returns HTTP 500 to `curl` but renders in a browser. |
| 5 | [Mars Trek](https://trek.nasa.gov/mars/) | NASA / JPL | Mars imagery and elevation through WMTS tiles. |
| 6 | [CSA STEM & youth resources](https://www.asc-csa.gc.ca/eng/youth-educators/resources-stem-and-youth-organizations.asp) | Canadian Space Agency | Free bilingual activities and toolkits. |
| 7 | [CSA food production toolkit](https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/) | Canadian Space Agency | Food on the Moon and in remote areas: nutrition and growing. |

A longer access and caveat audit is in [../research/junior-trainer-resources-report.md](../research/junior-trainer-resources-report.md). Its most important caveat: the challenge text mentions *Mars Rover Photos*, but api.nasa.gov lists that API as archived.

## Real data already pulled and checked

The game can use these values as they stand; sources are in [../research/verified-facts.md](../research/verified-facts.md).

- **Storm event:** DONKI `2024-05-20T05:36:00-CME-001`. The note calls it a "fast halo CME… source believed to be backsided" (on the side of the Sun facing away from Earth). Two analyses, both flagged most accurate: 2678 km/s (the shock) and 1927 km/s (the CME bulk).
- **What it did at Mars:** per NASA, a person next to Curiosity would have received **8,100 µGy (about 30 chest X-rays)**. It was "not deadly" and was the largest surge RAD had measured. *"Cliffsides or lava tubes would provide additional shielding."*
- **Normal Mars surface radiation:** about **210 µGy per day**, measured by Curiosity's RAD.
- **ISS radiation (RadLab):** DosTel1, Columbus module, 10–11 May 2024, 1,886 readings. Median **4.6 µGy/h**, max **527 µGy/h**.
- **Sol length:** 24 h 39 min 35 s. **One-way Earth–Mars signal delay:** about 4 to 24 minutes.
- **Plants in space (OSDR):** `OSD-268`, Veggie lettuce grown on the ISS (VEG-01B, SpaceX-3, 2014).
- **Outpost site (Mars Trek):** Gale crater, stitched from 4 WMTS tiles at zoom 6 (lat −2.81° to −8.44°, lon 135.0° to 140.63°). Two layers: Viking MDIM2.1 colour mosaic and MOLA colour shaded relief.

## Game sketch (on hold pending the challenge choice)

The outpost is in Gale crater and the mission lasts 7 sols. Each sol the player splits a fixed number of power tokens between **Air**, **Greenhouse**, **Science** and **Shelter**.

- **Dust storm:** some sols, a dust storm cuts the number of power tokens.
- **Solar storm:** on one sol (which sol changes between playthroughs) the real May 2024 storm hits. *Hide*: no science that sol. *Keep working*: the crew gets the full real dose.
- **Communication delay:** messages from Earth arrive N minutes late, so the crew can't wait for advice.
- **Difficulty:** Cadet mode turns failure into a supply drop.
- **End of mission:** a debrief charts each sol and explains what happened, using the "death details" pattern from Void Protocol.
