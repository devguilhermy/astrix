import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = resolve(ROOT, 'packages/data/snapshots');
export const RADLAB_URL = 'https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&timestamp%3E=2024-05-10T00%3A00&timestamp%3C=2024-05-12T00%3A00&absorbed_dose_rate&dose_equivalent_rate&instrument&module&format=json';
export const GST_URL = 'https://ccmc.gsfc.nasa.gov/DONKI/WS/get/GST?startDate=2024-05-08&endDate=2024-05-14';
export const CME_URL = 'https://ccmc.gsfc.nasa.gov/DONKI/WS/get/CME?startDate=2024-05-20&endDate=2024-05-20';
interface Table { columns: string[]; data: unknown[][] }
interface Product { name: string; title: string; onlink: string; thumb: string }
interface Catalogue { facets: { missikey: { facet: Record<string, number> } }; results: Product[]; total: number }
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const save = async (name: string, data: unknown) => writeFile(resolve(OUT, name), JSON.stringify(data, null, 2) + '\n');

export function reduceRadlab(table: Table, retrieved: string) {
  const index = (key: string) => { const i = table.columns.indexOf(key); if (i < 0) throw new Error(`Missing RadLab column ${key}`); return i; };
  const timestamp = index('timestamp'), instrument = index('instrument'), module = index('module'), spacecraft = index('spacecraft'), dose = index('absorbed_dose_rate');
  const values: number[] = [];
  const buckets = new Map<string, number[]>();
  for (const row of table.data) {
    if (row[instrument] !== 'DosTel1' || row[module] !== 'Columbus' || row[spacecraft] !== 'ISS') continue;
    const time = String(row[timestamp]);
    if (time < '2024-05-10T00:00' || time >= '2024-05-12T00:00') continue;
    const v = row[dose];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error('Invalid measured dose');
    const hour = time.slice(0, 13) + ':00:00Z';
    values.push(v); const bucket = buckets.get(hour) ?? []; bucket.push(v); buckets.set(hour, bucket);
  }
  values.sort((a, b) => a - b);
  if (!values.length || buckets.size !== 48) throw new Error(`Incomplete RadLab sample: ${values.length} rows, ${buckets.size} hours`);
  const n = values.length;
  return {
    source: 'radlab-iss-2024-05-10', url: RADLAB_URL, retrieved, instrument: 'DosTel1', module: 'Columbus', spacecraft: 'ISS', unit: 'µGy/h',
    observationStart: '2024-05-10T00:00:00Z', observationEndExclusive: '2024-05-12T00:00:00Z',
    reduction: 'Unweighted arithmetic mean of valid DosTel1 readings per UTC hour; sample statistics describe raw readings, not hourly means. No interpolation.',
    hourly: [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([hour, vs]) => ({ hour, meanUGyH: vs.reduce((a, b) => a + b, 0) / vs.length, n: vs.length })),
    stats: { min: values[0]!, median: n % 2 ? values[(n - 1) / 2]! : (values[n / 2 - 1]! + values[n / 2]!) / 2, max: values[n - 1]!, n },
    limitations: 'ISS Columbus local absorbed dose measurements; not a radiation map or electronics-failure calibration. Temporal co-occurrence with DONKI events does not establish peak-by-peak causation.'
  };
}

const MARS_MATCHES: Record<string, RegExp> = {
  'Mariner 9': /mariner[ _-]*9/i,
  'Mars 2020': /mars[ _-]*2020|perseverance/i,
  'Mars Express': /mars[ _-]*express|\bhrsc\b/i,
  'Mars Global Surveyor': /mars[ _-]*global[ _-]*surveyor|\bmgs\b|\bmola\b|\bmoc\b/i,
  'Mars Odyssey': /mars[ _-]*odyssey|\bthemis\b/i,
  'Mars Reconnaissance Orbiter': /mars[ _-]*reconnaissance[ _-]*orbiter|\bmro\b|\bhirise\b|\bctx\b|\bcrism\b/i,
  'Viking': /viking/i, 'Viking Lander': /viking.*lander/i, 'Viking Orbiter': /viking.*orbiter|viking[ _-]*mdim/i
};
export function extractMissions(catalogue: Catalogue) {
  return Object.entries(MARS_MATCHES).map(([name, pattern]) => {
    const count = catalogue.facets.missikey.facet[name];
    if (!Number.isInteger(count) || count! < 0) throw new Error(`Missing or invalid USGS mission facet: ${name}`);
    return {
      name, count: count!,
      products: catalogue.results.filter(r => {
        const text = `${r.title} ${r.name.replace(/[_-]+/g, ' ')}`;
        // Instrument/place names can overlap: Venus has a Themis Regio.
        // Keep Mars-system examples conservative; this is still heuristic attribution.
        return !/\b(?:venus|mercury|earth|moon|lunar|jupiter|saturn|uranus|neptune|pluto)\b/i.test(text) && pattern.test(text);
      }).slice(0, 3).map(r => ({ title: r.title, link: r.onlink, thumb: r.thumb })),
      attribution: 'heuristic-title-name', matchPattern: pattern.source,
      note: 'Facet count is supplied by USGS for the whole catalogue. Sample titles/names match mission or instrument vocabulary; records contain no per-record mission field. A match is not verified mission attribution, and an empty sample does not mean no products exist.'
    };
  });
}

async function acquire(name: string, url: string, offline: boolean, imported?: string) {
  const rawPath = resolve(OUT, `raw/${name}.json`), metaPath = resolve(OUT, `raw/${name}.provenance.json`);
  if (offline) {
    const text = await readFile(rawPath, 'utf8');
    const meta = JSON.parse(await readFile(metaPath, 'utf8')) as { retrieved: string; sha256: string; url: string };
    if (meta.url !== url || meta.sha256 !== sha256(text)) throw new Error(`Raw provenance mismatch: ${name}`);
    return { data: JSON.parse(text), retrieved: meta.retrieved };
  }
  let text: string, retrieved: string, acquisition: string;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(120_000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    text = await response.text(); JSON.parse(text); retrieved = new Date().toISOString(); acquisition = 'Direct HTTPS retrieval';
  } catch (error) {
    if (!imported) throw error;
    text = await readFile(imported, 'utf8'); JSON.parse(text);
    retrieved = (await stat(imported)).mtime.toISOString();
    acquisition = `Explicit imported raw response ${imported}; retrieval time estimated from preserved file modification time, not a fresh API response. Live request failed: ${String(error)}`;
  }
  await writeFile(rawPath, text);
  await writeFile(metaPath, JSON.stringify({ url, retrieved, acquisition, sha256: sha256(text) }, null, 2) + '\n');
  return { data: JSON.parse(text), retrieved };
}

async function main() {
  await mkdir(resolve(OUT, 'raw'), { recursive: true });
  const offline = process.argv.includes('--offline');
  const imported = process.env.RADLAB_IMPORT;
  const [radlab, gst, cme] = await Promise.all([
    acquire('radlab', RADLAB_URL, offline, imported), acquire('donki-gst', GST_URL, offline), acquire('donki-cme', CME_URL, offline)
  ]);
  const event = (cme.data as { activityID: string }[]).find(r => r.activityID === '2024-05-20T05:36:00-CME-001');
  if (!event || !Array.isArray(gst.data) || !gst.data.length) throw new Error('Required DONKI records missing');
  const nasaText = await readFile(resolve(ROOT, 'nasa.json'), 'utf8');
  const catalogue = JSON.parse(nasaText) as Catalogue;
  await Promise.all([
    save('radlab-dostel1-2024-05-10.json', reduceRadlab(radlab.data as Table, radlab.retrieved)),
    save('donki-2024-05.json', { source: 'NASA CCMC DONKI', url: [GST_URL, CME_URL], retrieved: { gst: gst.retrieved, cme: cme.retrieved }, gst: gst.data, cme: event, limitations: 'DONKI event catalogue and analyst/model interpretations. Kp is a geomagnetic index, not absorbed dose. CME shock and bulk speeds describe different features, not competing interchangeable estimates.' }),
    save('usgs-missions.json', { source: 'usgs-catalog', url: 'https://astrogeology.usgs.gov/search', retrieved: (await stat(resolve(ROOT, 'nasa.json'))).mtime.toISOString(), retrievalTimeBasis: 'Preserved local export file modification time; original HTTP retrieval time is unavailable.', input: 'nasa.json', sha256: sha256(nasaText), total: catalogue.total, sampledRecords: catalogue.results.length, missionFacets: catalogue.facets.missikey.facet, attribution: 'heuristic-title-name; no per-record mission metadata', missions: extractMissions(catalogue) })
  ]);
  console.log(`Wrote three snapshots to ${OUT}; raw responses and provenance preserved.`);
}
if (import.meta.main) await main();
