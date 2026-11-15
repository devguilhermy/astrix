# Verified facts and data points

Each value below was seen at its source on 2026-11-14. Gameplay tuning numbers (token counts, thresholds) are **not** listed here. They are game assumptions and must be labelled as such in the product.

## Space weather and radiation

| Fact | Value | Source |
|---|---|---|
| DONKI event | `2024-05-20T05:36:00-CME-001`: "Fast halo CME visible in SOHO LASCO C2/C3 and STEREO A COR2. The source is believed to be backsided…". Two analyses, both flagged `isMostAccurate`: 2678 km/s ("likely… the SHOCK") and 1927 km/s ("the bulk of this CME") | [DONKI CME 31034](https://ccmc.gsfc.nasa.gov/DONKI/view/CME/31034/-1); JSON from `https://ccmc.gsfc.nasa.gov/DONKI/WS/get/CME?startDate=2024-05-20&endDate=2024-05-20` (also via `https://api.nasa.gov/DONKI/CME`) |
| May 20, 2024 dose at Mars | 8,100 µGy for a person next to Curiosity, "equivalent to 30 chest X-rays"; "While not deadly, it was the biggest surge measured by… RAD" since landing | [NASA, 10 Jun 2024](https://www.nasa.gov/solar-system/planets/mars/nasa-watches-mars-light-up-during-epic-solar-storm/) |
| Shielding | "Cliffsides or lava tubes would provide additional shielding… In Mars orbit or deep space, the dose rate would be significantly more" (Don Hassler, RAD PI) | same NASA article |
| Timing | The flare's X-rays and gamma rays arrived first; the charged particles reached Mars "in just tens of minutes". The Moon to Mars Space Weather Analysis Office "flagged the possibility of incoming charged particles" | same NASA article |
| Mars surface background | About 210 µGy/day absorbed (0.21 ± 0.04 mGy/day, first ~300 sols, Gale crater) | [NASA Science: Radiation Measurements on Mars](https://science.nasa.gov/resource/radiation-measurements-on-mars/); Hassler et al. 2014, [*Science*](https://www.science.org/doi/10.1126/science.1244797) |
| ISS sample (RadLab) | DosTel1, Columbus, 2024-05-10T00:00 → 2024-05-12T00:00 UTC: 1,886 readings, min 1.21, **median 4.59**, **max 527.29 µGy/h**. Hourly means range from about 3 to about 147 µGy/h | `https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&timestamp>=2024-05-10T00:00&timestamp<2024-05-12T00:00&absorbed_dose_rate&dose_equivalent_rate&instrument&module&format=json` (url-encode `>`, `<` and `:`) |

## Mars basics

| Fact | Value | Source |
|---|---|---|
| Sol | 24 h 39 min 35 s (1.027 Earth days) | [JPL Mars 2020 press kit](https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/quick_facts/) |
| Signal delay | About 4 to 24 min one way, depending on Earth–Mars distance | [NASA Goddard: Space Communications, 7 things](https://www.nasa.gov/centers-and-facilities/goddard/space-communications-7-things-you-need-to-know/) |
| Gale crater imagery | WMTS layers `Mars_Viking_MDIM21_ClrMosaic_global_232m` and `Mars_MGS_MOLA_ClrShade_merge_global_463m`, tiles `6/{33,34}/{112,113}` | `https://trek.nasa.gov/tiles/Mars/EQ/<layer>/1.0.0/default/default028mm/{z}/{row}/{col}.jpg` (Mars Trek) |

## Biology and food

| Fact | Value | Source |
|---|---|---|
| OSD-268 | "Microbiological and nutritional analysis of lettuce crops grown on the International Space Station-VEG01B": lettuce grown in the Veggie payload, returned on SpaceX-3 (Apr–May 2014) | OSDR search API `https://osdr.nasa.gov/osdr/data/search?term=OSD-268&type=cgene` |
| OSD-895 | EDEN ISS greenhouse biomass, Antarctica, 2018. An Earth analog, not Mars | [OSDR](https://osdr.nasa.gov/bio/repo/data/studies/OSD-895) |

## Spacecraft design (Mission Design Game)

| Fact | Value | Source |
|---|---|---|
| CubeSat unit | 1U = 10 cm cube, about 1 to 1.33 kg; larger sizes 1.5U, 2U, 3U, 6U, 12U | [CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf) §1 |
| Mass limits (acceptance checklists) | 1U < 1.33 kg · 1.5U < 2.00 kg · 2U < 2.66 kg · 3U < 4.00 kg · 3U+ < 4.00 kg | CubeSat 101 ch. 6 |
| Mission segments | Launch, space, ground, user | [Design and Develop Science Missions](https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf?emrc=a454cf), slide 8 |
| Design flow | Identify need & goals → define concept → define requirements → design → build & verify → implement | same, slide 10 |

## Local catalog (`nasa.json`)

USGS Astrogeology export: 1,000 of 1,643 records. The facets give catalog-wide counts per mission, e.g. Viking Orbiter 337, Lunar Reconnaissance Orbiter 168, Mars Odyssey 119, Voyager 107, Magellan 76, Mars Reconnaissance Orbiter 58. Map projection counts are also given. Records include Gale crater THEMIS products and MER, InSight and Artemis III landing-site products.

## Physics constants and class limits (added for the implementation plan)

| Fact | Value | Source |
|---|---|---|
| Earth | GM 0.39860 × 10⁶ km³/s² · equatorial radius 6,378.137 km · semimajor axis 149.598 × 10⁶ km · sidereal orbit 365.256 d · solar irradiance 1,361.0 W/m² · sidereal rotation 23.9345 h | [NASA Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html); rotation from the Earth column of the Mars sheet |
| Mars | GM 0.042828 × 10⁶ km³/s² · equatorial radius 3,396.2 km · semimajor axis 227.956 × 10⁶ km · sidereal orbit 686.980 d · solar irradiance 586.2 W/m² · sidereal rotation 24.6229 h · length of day 24.6597 h | [NASA Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Sun | GM 132,712 × 10⁶ km³/s² · volumetric mean radius 695,700 km | [NASA Sun Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html) |
| SmallSat class | "spacecraft with a mass less than 180 kilograms" | [NASA S3VI: What are SmallSats and CubeSats?](https://www.nasa.gov/smallsat-institute/what-are-smallsats-and-cubesats/) |

## More fact-sheet constants (for [MISSIONS.md](../MISSIONS.md))

| Body | Values | Source |
|---|---|---|
| Moon | GM 0.00490 × 10⁶ km³/s² · equatorial radius 1,738.1 km · semimajor axis 0.3844 × 10⁶ km · sidereal rotation 655.720 h | [NASA Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html) |
| Venus | GM 0.32486 · radius 6,051.8 km · semimajor axis 108.210 × 10⁶ km · irradiance 2,601.3 W/m² · sidereal orbit 224.701 d | [NASA Venus Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html) |
| Mercury | GM 0.022032 · radius 2,440.5 km · semimajor axis 57.909 × 10⁶ km · irradiance 9,082.7 W/m² · sidereal orbit 87.969 d | [NASA Mercury Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html) |
| Jupiter | GM 126.687 · radius 71,492 km (1 bar) · semimajor axis 778.479 × 10⁶ km · irradiance 50.26 W/m² · sidereal orbit 4,332.589 d | [NASA Jupiter Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html) |
| Phobos | semimajor axis 9,378 km · period 0.31891 d | NASA Mars Fact Sheet (satellites table) |

## Space Apps 2026 rules (navigator answers on the official discussion board)

| Rule | Source |
|---|---|
| Earlier own work and open-source libraries may be used if properly credited and not built specifically for Space Apps; challenge-specific development happens during the hackathon; reused components must meet the open-source requirements; every resource, including your own earlier work, must be listed | [nasa/spaceapps #1924](https://github.com/nasa/spaceapps/discussions/1924) (11 Nov 2026) |
| Global Judging: teams of 2–6 participants; one person alone does not qualify | [nasa/spaceapps #1947](https://github.com/nasa/spaceapps/discussions/1947) (12 Nov 2026) |
| Global Awards: the project must meaningfully use at least one NASA data source listed in the selected challenge's Resources | same |
| AI use must be disclosed; AI-generated images and video need a visible watermark | same |
| Demo: a video of at most 30 s or at most 7 slides | same |
