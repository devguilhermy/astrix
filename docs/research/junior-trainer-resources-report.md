# NASA Space Apps Challenge 2026 — Junior Astronaut Mission Trainer

Research date: **14 November 2026**. Sources were inspected as rendered webpages, including the challenge's **Details** and **Resources** tabs. Resource descriptions below distinguish the challenge's listings from implementation recommendations.

## Resolving the supplied URL

The supplied URL, <https://www.spaceappschallenge.org/2026/challenges/j>, redirects to its trailing-slash equivalent and renders **“Oops! Page Not Found”**; it does not show an alphabetic filter or a challenge.

The [2026 challenge directory](https://www.spaceappschallenge.org/2026/challenges/) loads **14 challenges** after JavaScript finishes. Exactly one listed challenge has a slug beginning with `j`:

**[Build a Junior Astronaut Mission Trainer](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/)**.

This report therefore treats `j` as a truncated `junior-astronaut-mission-trainer` slug and covers that challenge in depth, rather than substituting the entire list. **[UNVERIFIED]** The original author's intended expansion cannot be proven; this is the unique matching slug observed in the live directory, not a redirect supplied by the site.

## Challenge profile

| Field | Verified page content |
| --- | --- |
| Title | Build a Junior Astronaut Mission Trainer |
| URL | <https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/> |
| Event | 2026 NASA Space Apps Challenge |
| Difficulty / level | **Intermediate; Beginner/Youth** |
| Subjects / tags | **Games; Planets & Moons; Software; Space Exploration; Sun** |
| Target players | Children **ages 7–12**, with possible use by families and classrooms |
| Deliverable | A working interactive game or application demonstrating genuine mission trade-offs |

### Summary

Build an engaging simulation in which children operate a lunar or Martian outpost. Instead of teaching isolated space facts or presenting an overly technical engineering interface, make survival constraints tangible: power allocated to research cannot also run every life-support or food-production system, and responding to a radiation event costs resources or mission opportunities.

### Objectives

The [Details tab](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/) asks teams to:

1. Let young players make decisions about **life support, radiation shielding, power budgeting, food production, and communication delay** across a simulated mission.
2. Make choices have understandable consequences and real costs, so players learn why engineering compromises matter.
3. Ground the experience in real NASA open data where possible: the page explicitly suggests DONKI, OSDR, and Artemis or Mars surface mission data.
4. Produce a working prototype whose central trade-off is clear enough that a child leaves understanding a real deep-space survival constraint.
5. Choose a suitable format freely: resource-management game, narrative decision simulator, mission-control dashboard, browser, mobile, or desktop. Creative settings beyond the Moon and Mars are permitted if the educational goal remains central.

### Constraints and considerations

The page labels its “Potential Considerations” as **optional**, not mandatory technical requirements:

- **Accessible presentation:** plain language, short contextual explanations of terms such as “radiation dose” and “sol,” and ideally browser play without a download or account.
- **Manageable complexity:** two or three core resources can teach more effectively than five or six simultaneous systems. The objectives name several systems; the considerations explicitly support concentrating the gameplay.
- **Honest data provenance:** attribute sources within the product. An embedded, curated real dataset is acceptable when live APIs are impractical; never label a static snapshot “live.”
- **Meaningful costs:** avoid an always-safe choice with no downside, and do not substitute visual polish for mechanically accurate trade-offs.
- **Replay and explanation:** varying events, non-punitive learning from failure, and a short account of which datasets were used and why can strengthen the submission.
- **Data terms:** the Resources tab says NASA does not endorse non-U.S. Government entities or take responsibility for their websites; comply with each external provider's data-use parameters.
- **Changing resource list:** the Details tab says additional resources may be added. The inventory below is the list visible on the research date, not a guarantee about future revisions.

## Complete resource inventory

The challenge's **Resources** tab contains **7 named resource entries and 8 outbound resource links**. The extra link is the OSDR search API nested within the OSDR entry. Five entries appear under “NASA Data & Resources,” and two under “Space Agency Partner Resources — CSA.” **No ESA or JAXA resource is listed for this challenge.** Site navigation, the generic footer Resources link, and later recommendations are excluded from this count.

“Tool” below includes educational toolkits; these are not misrepresented as numeric datasets or research papers.

| # | Resource and exact listed link(s) | Provider | Type | One-line description and practical role |
| --- | --- | --- | --- | --- |
| 1 | [NASA Open APIs](https://api.nasa.gov/) | NASA | **API / API catalog** | Central discovery and developer-key portal for NASA services; use it to find supported endpoints and authentication rules. |
| 2 | [Space Weather Database Of Notifications, Knowledge, Information (DONKI)](https://ccmc.gsfc.nasa.gov/tools/DONKI/) | NASA Goddard / Community Coordinated Modeling Center (CCMC), with Moon-to-Mars Space Weather Analysis Office analyses | **Dataset + API + tool** | Linked records of solar flares, coronal mass ejections, particle events, and other space-weather activity can supply authentic event timing for mission-decision scenarios. |
| 3 | [NASA Open Science Data Repository (OSDR)](https://osdr.nasa.gov/bio/repo/); accompanying [search API](https://osdr.nasa.gov/osdr/data/search?term=KEYWORD) | NASA; repository also indexes multiple contributing data sources | **Dataset repository + API** | Search space-biology and health-related studies to build traceable science explanations and evidence cards; check organism, environment, and study design before applying findings to people. |
| 4 | [RadLab — OSDR Radiation Dosimetry Database / Data API](https://visualization.osdr.nasa.gov/radlab/gui/data-api/) | NASA OSDR, with instruments/data from international contributors | **Dataset + API + tool** | Instrument radiation measurements, including ISS dose-rate data, provide real examples of changing radiation exposure and the importance of measurement context. |
| 5 | [Mars Trek](https://trek.nasa.gov/mars/) | NASA; Trek team at JPL and Solar System Exploration Research Virtual Institute (SSERVI) | **Tool + geospatial datasets / tile services** | Explore Mars imagery, elevation, and terrain layers to ground an outpost setting in a real place rather than an invented landscape. |
| 6 | [Space resources for STEM and youth organizations](https://www.asc-csa.gc.ca/eng/youth-educators/resources-stem-and-youth-organizations.asp) | Canadian Space Agency (**CSA**) | **Tool — educational resource collection** | Free bilingual presentations, toolkits, imagery, activities, and games support age-appropriate explanations and classroom or informal-learning use. |
| 7 | [Food production on the Moon and in remote areas](https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/) | **CSA**, with credited and linked partner material | **Tool — educational toolkit** | Reading, activities, illustrations, and videos explain space food production, nutrition, and Earth benefits; useful for designing a greenhouse-versus-power decision. |

### Access, formats, size, and availability notes

#### 1. NASA Open APIs

The rendered [portal](https://api.nasa.gov/) documents a default personal-key allowance of **1,000 requests/hour**, potentially varying by service. `DEMO_KEY` is limited to **30 requests/IP/hour and 50 requests/IP/day**. Check returned rate-limit headers and service-specific rules; these limits are not a promise for every NASA-hosted domain.

**Important discrepancy with the challenge's description:** the challenge lists APOD and Mars Rover Photos as examples. The current API portal says the **Mars Rover API has been archived**, the Earth API was replaced with Earthdata GIBS, and APOD has a new service with the legacy API scheduled for archival on **1 December 2026**. Do not base the prototype on the challenge description's assumption that the old Mars Rover Photos service remains available. Use supported Trek imagery or explicitly selected archival imagery instead.

#### 2. DONKI

The [provider page](https://ccmc.gsfc.nasa.gov/tools/DONKI/) links its [current API reference](https://ccmc.gsfc.nasa.gov/DONKI/api/) and documents a **30 September 2026 URL migration** from the former `kauai.ccmc.gsfc.nasa.gov` host to `ccmc.gsfc.nasa.gov`. Consult the current reference rather than copying old hostnames.

The NASA API portal separately documents the DONKI gateway's event-specific endpoints and `startDate`, `endDate`, and `api_key` parameters; its notifications service limits a request to a **30-day** interval. The CCMC page also exposes JSON/text service links. Treat gateway and direct-CCMC access rules separately rather than assuming one key or quota applies to both.

For a hackathon, select a short archived event window and store just the timestamps, identifiers, event class/type, and source references needed by the game. **[UNVERIFIED]** Actual payload size, direct-CCMC quotas, and browser CORS behavior were not measured.

The provider explicitly limits these research products to **prototyping/research quality** and identifies NOAA as the official U.S. space-weather forecasting source. DONKI events are not a calibrated forecast of absorbed dose at a selected Mars outpost.

#### 3. OSDR

Both the repository interface and listed search endpoint were accessible. The search endpoint returned **JSON without credentials** during research. Its literal `term=KEYWORD` is an example placeholder: replace the search term, rather than treating those results as a curated space-health dataset. Search responses include study titles, organisms, descriptions, identifiers, and other metadata; broad results can include non-spaceflight controls and external sources.

Use metadata and a few selected findings first, not a wholesale raw-data download. **[UNVERIFIED]** File formats, aggregate size, access terms for every study/file, and API rate limits were not established; check the specific study before promising integration.

A concrete supplementary example surfaced in the repository is [OSD-895 — Biomass Production of the EDEN ISS Space Greenhouse in Antarctica During the 2018 Experiment Phase](https://osdr.nasa.gov/bio/repo/data/studies/OSD-895). The displayed metadata identifies an **Antarctic Earth analog**, not crop production on Mars. Its title and repository listing were verified; detailed files, numerical results, and any proposed quantitative yield model remain **[UNVERIFIED]**. This is an implementation lead, not an eighth challenge-listed resource.

#### 4. RadLab

Static retrieval initially returned HTTP 500, but the **rendered Data API documentation loaded successfully in a browser**. Its documentation gives the GET endpoint <https://visualization.osdr.nasa.gov/radlab/api> and these useful details:

- Output formats: **CSV by default; TSV, JSON, or HTML** through `format`.
- Filters include spacecraft, trajectory, instrument, and timestamps; request only a short time interval and needed fields.
- `absorbed_dose_rate` is in **µGy/hour**; `dose_equivalent_rate` is in **µSv/hour**. They are different quantities, not interchangeable labels.
- Instrument identifiers and ISO-formatted timestamp values are case-sensitive.
- Simple key-value queries and boolean-expression queries are alternative syntaxes; the documentation says not to mix them.

**[UNVERIFIED]** Actual response sizes, API quotas, authentication enforcement, and cross-origin fetch behavior were not tested. The documentation describes GET requests without an API-key parameter; do not assume the NASA API portal's key is required here. Preserve instrument identity, units, location/trajectory, and timestamps in any extracted sample.

#### 5. Mars Trek

The [portal](https://trek.nasa.gov/mars/) is JavaScript-based. The [NASA API portal's Trek WMTS section](https://api.nasa.gov/) documents **OGC WMTS** access, **XML GetCapabilities** metadata, and **PNG/JPEG** image tiles. Read each layer's advertised tile matrix, style, coverage, and extension rather than assuming Earth web-map defaults. The documented layers include Viking imagery and MOLA elevation/hillshade products.

Use a small region and a bounded zoom range, not global high-resolution downloads. **[UNVERIFIED]** Per-layer download sizes, current service quotas, browser CORS, and the operation of the portal's interactive analysis/download tools were not verified; its initial landing shell and the separate WMTS documentation were observed. A rendered elevation image is not automatically a quantitative elevation array.

#### 6–7. CSA educational resources

Both [the educator collection](https://www.asc-csa.gc.ca/eng/youth-educators/resources-stem-and-youth-organizations.asp) and [food toolkit](https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/) were readable as public HTML without a sign-in. The collection explicitly offers free bilingual resources and links to [CSA reproduction terms](https://www.asc-csa.gc.ca/eng/terms.asp#copyright). Free access does not establish identical reuse permissions for every externally credited asset.

These are content/tool collections, not standardized telemetry APIs. The food toolkit includes “Interplanetary Farming,” “Master Chef: Mars,” food-label activities, and water-recycling videos; some activities are aimed at **Grades 6–9**, so adapt vocabulary and interaction for the challenge's younger audience. **[UNVERIFIED]** Individual media sizes and all linked partners' reproduction permissions were not checked.

## Suggestions

The following are **proposed implementation choices**, not additional official requirements or claims of scientifically validated simulation performance.

### Recommended hackathon-scale project: “Outpost: Seven Decisions”

Create a browser game with one **seven-turn Mars mission**, one selected outpost site, and three always-visible systems: **power, life-support reserve, and shelter readiness**. Each turn the player allocates power between maintaining the habitat, growing food, and preparing shelter or conducting science. A clearly explained storm scenario can interrupt the plan. Communication delay can appear as an asynchronous message mechanic without adding another resource meter.

A complete small prototype should include the start screen, tutorial, seven playable decisions, consequences, replay, and an end-of-mission explanation of both the engineering compromise and the source behind it. Prefer this complete loop over an unfinished planet-scale simulator.

### Combine resources by role, not by pretending they measure the same thing

| Combination | Concrete use | Boundary to preserve |
| --- | --- | --- |
| **DONKI + RadLab** | Use a real archived DONKI event timeline for a “space-weather watch” decision; show a separately attributed real RadLab dose-rate excerpt in an explanatory card. | Do not assert a causal time match without evidence, convert a flare class directly into dose, or relabel ISS measurements as Mars surface exposure. |
| **OSDR + CSA food toolkit** | Use the toolkit to explain plant growth and resource costs; select one reviewed study, such as the Antarctic greenhouse example, for a “real science behind this choice” card. | Keep species, environment, experiment duration, and evidence limits explicit; Earth-analog yields do not automatically predict Martian greenhouse yields. |
| **Mars Trek + optional USGS catalog material** | Select a real outpost region and provide a credited background image or small terrain overview. | Distinguish regional context from engineering-grade siting, traverse safety, or local horizon/shadow analysis. |
| **CSA youth resources + all data sources** | Add short definitions, an educator explanation, keyboard-accessible decisions, and a visible “where this came from” drawer. | Preserve source attribution and check asset-specific reuse terms; bilingual content is a useful starting point, not proof the game's translations are complete. |

### Feasible technical stack and data workflow

- **Frontend:** TypeScript, Vite, and ordinary HTML/CSS/SVG; Phaser only if the team already knows it. Use accessible buttons and text for decisions rather than requiring a complex 3D scene.
- **Simulation:** a deterministic turn-based state reducer with explicit units. Keep original measurements separate from dimensionless game resources. Label gameplay balance coefficients as **educational assumptions**, not NASA-measured oxygen consumption or shielding performance.
- **Acquisition:** a small Node.js or Python script, run during preparation, retrieves an archived DONKI window and selected RadLab records and saves compact JSON/CSV snapshots. Manually review OSDR/CSA evidence cards. Store source URL, acquisition time, event/study/instrument ID, units, and actual observation dates.
- **Delivery:** deploy as a static site with the curated files embedded. No player account, live data dependency, or runtime API key is needed for this snapshot-based design. If adding live calls, use server-side key handling where appropriate, caching, and explicit stale-data labels; API availability and CORS must be checked before relying on them.
- **Scope/size target:** as a design budget, aim for **under 10 MB** of initial assets and a few dozen curated records, not entire archives. This is a proposed project limit, **not a measured size of the listed services**.
- **Mapping:** a single cropped image and a source/scale caption suffice for the first complete game. If a layered viewer is essential, use a WMTS-capable client with a deliberately configured Mars projection and tile matrix.

### Appropriate reuse of `nasa.json` and `nasa-visualizer.html`

These local assets are **supplementary USGS discovery tools**, not resources named by this challenge. Their fit is the optional **real Mars/Moon setting**; they do not supply astronaut health, radiation, food, or power telemetry.

Observed local contents:

- `nasa.json` is **549,015 bytes**, containing **1,000 loaded results**, **8 collections**, and a catalog-reported `total` of **1,643**. It is a partial catalog export, not 1,643 downloaded map products.
- Entries contain titles, abstracts, publication dates, resource types, thumbnails, and `onlink` catalog URLs. Mission and projection facets are aggregate catalog counts; do not assume every facet is available as a per-record property.
- `nasa-visualizer.html` is **23,680 bytes**. It fetches the adjacent JSON and offers file-picker/drag-and-drop loading if fetching fails, plus search, body/type/date filtering, thumbnails, and catalog links. Body labels are inferred; mission/projection charts are catalog-wide summaries, not reliable per-result metadata joins.

**Concrete reuse:** use the explorer during team preparation to find one Mars product, then carry a credited, appropriately reduced asset and provenance into the game. Retain the explorer as a research companion rather than embedding a 1,000-card catalog inside a child's game.

Two actually present catalog records, whose USGS pages were also opened, illustrate the trade-off:

| Supplementary dataset | Verified provider-page details | Suggested use |
| --- | --- | --- |
| [Mars MGS MOLA DEM 463m](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m) | NASA MGS/MOLA; USGS publication; approximately **463 m/pixel**, **2 GB** TIFF download, Simple Cylindrical, planetocentric latitude, positive-east longitude, −180° to 180° domain; public domain. | Crop/downsample a regional overview offline; it is too coarse for individual rocks, shelter geometry, or astronaut-scale route safety. |
| [Mars Viking Global Color Mosaic 925m](https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m) | NASA Viking imagery; USGS mosaic; approximately **925 m/pixel**, **764 MB** TIFF download, Simple Cylindrical; public domain. The page documents residual appearance/geolocation limitations. | Use a small credited overview/background rather than downloading the full raster in each browser session. |

The sizes above are **provider-listed**, not downloaded/benchmarked here. For any quantitative overlay, inspect each product's coordinate reference system, radius, longitude convention, registration, resolution, and nodata. Even these two overview products should not be assumed pixel-aligned. A GDAL/Rasterio preprocessing step is a reasonable optional addition; the game does not need a global geospatial backend.

### Pitfalls to avoid

1. **Unvalidated risk calculations:** DONKI events and RadLab measurements do not by themselves establish safe exposure or shielding requirements for a lunar/Martian mission. Present the game as educational, not operational or medical guidance.
2. **Manufactured precision:** keep an explicit split between real observations, cited qualitative findings, and game-design assumptions. A made-up number does not become NASA data because it appears next to a NASA image.
3. **Misleading temporal labels:** archival solar events, old Mars imagery, and current API retrieval times are different concepts. Display the observation date and snapshot date separately.
4. **Unsupported service assumptions:** the challenge's resource copy includes an archived Mars Rover API example; follow the current provider notice. Do not depend on legacy URLs, untested CORS, or shared demo-key capacity during judging.
5. **Overloaded gameplay:** teach one memorable trade-off at a time; explain consequences visually and in text, then reveal the science citation without forcing a child through a research repository.
6. **False planetary equivalence:** ISS dosimetry, an Antarctic greenhouse, and a Mars DEM describe different environments. Combine them as distinct educational evidence, not as a scientifically validated joint model.

## Source and verification boundary

The challenge title, metadata, objectives, considerations, and complete inventory come from its rendered [Details/Resources tabs](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/); scope resolution comes from the rendered [14-challenge directory](https://www.spaceappschallenge.org/2026/challenges/). Linked provider pages supplied the access notes. Every external URL above was observed in a page, API response, or the local catalog during research; no resource URL was invented.

A link appearing in the inventory establishes that the challenge lists it, not that every downstream download or API operation was executed. This research did not download the multi-gigabyte rasters, benchmark service payloads, validate a scientific simulation, or test a deployed application. Unestablished operational details are marked **[UNVERIFIED]** above.
