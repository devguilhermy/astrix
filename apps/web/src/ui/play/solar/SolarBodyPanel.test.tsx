import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';
import { SolarBodyPanel } from './SolarBodyPanel';
import { solarEnglish, solarPortuguese } from './copy';

async function render(language:'en'|'pt-BR',children:ReactNode){const i18n=createInstance();await i18n.init({lng:language,fallbackLng:'en',resources:{en:{translation:solarEnglish},'pt-BR':{translation:solarPortuguese}},keySeparator:false,interpolation:{escapeValue:false}});return renderToStaticMarkup(<I18nextProvider i18n={i18n}>{children}</I18nextProvider>);}
const ignore=()=>{};
const languages=['en','pt-BR'] as const;

describe('solar body panel', () => {
  test('both copy tables carry the same solar. keys', () => {
    expect(Object.keys(solarPortuguese).sort()).toEqual(Object.keys(solarEnglish).sort());
    for (const [key,value] of Object.entries({...solarEnglish,...solarPortuguese})) { expect(key.startsWith('solar.')).toBe(true); expect(value.trim().length,key).toBeGreaterThan(0); }
  });
  test('Earth offers missions and shows its NSSDCA facts with the retrieval date', async () => {
    for (const language of languages) {
      const html=await render(language,<SolarBodyPanel body="EARTH" onSelect={ignore} onMissions={ignore}/>);
      const en=language==='en';
      expect(html).toStartWith('<aside class="dossier context-panel"');
      expect(html).toContain(en?'Missions here':'Missões aqui');
      expect(html).not.toContain(en?'Exploration only':'Somente exploração');
      expect(html).toContain(en?'12,756 km':'12.756 km');
      expect(html).toContain(en?'NASA NSSDCA Planetary Fact Sheet':'Ficha de dados planetários da NASA NSSDCA');
      expect(html).toContain('href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/"');
      expect(html).toContain('2026-11-15');
      expect(html).toContain(en?'Sizes in the 3D view are to scale with the Sun; distances are compressed.':'Os tamanhos na vista 3D estão em escala com o Sol; as distâncias estão comprimidas.');
      expect(html).toContain(en?'International Space Station':'Estação Espacial Internacional');
      expect(html).toContain(en?'Earth is the reference':'A Terra é a referência');
      expect(html).toContain('href="https://science.nasa.gov/earth/"');
      expect(html.match(/<button\b/g)).toHaveLength(4);
    }
  });
  test('Jupiter is exploration-only, shows 95 moons and names the four mission bodies', async () => {
    for (const language of languages) {
      const html=await render(language,<SolarBodyPanel body="JUPITER" onSelect={ignore} onMissions={ignore}/>);
      const en=language==='en';
      expect(html).toContain(en?'Exploration only. Missions are available at the Sun, Earth, the Moon and Mars.':'Somente exploração. Há missões no Sol, na Terra, na Lua e em Marte.');
      expect(html).not.toContain(en?'Missions here':'Missões aqui');
      expect(html).toMatch(new RegExp(`${en?'Moons':'Luas'}</dt><dd>95</dd>`));
      expect(html).toContain(en?'Gas giant':'Gigante gasoso');
      expect(html).toContain(en?'Ring system':'Sistema de anéis');
      expect(html).toContain('2026-11-15');
      expect(html).toContain('href="https://science.nasa.gov/jupiter/"');
      expect(html).toContain(en?'11× Earth':'11× a Terra');
    }
  });
  test('the Sun offers missions and cites the Sun fact sheet', async () => {
    for (const language of languages) {
      const html=await render(language,<SolarBodyPanel body="SUN" onSelect={ignore} onMissions={ignore}/>);
      const en=language==='en';
      expect(html).toContain(en?'Missions here':'Missões aqui');
      expect(html).toContain(en?'1,391,400 km':'1.391.400 km');
      expect(html).toContain(en?'5,772 K':'5.772 K');
      expect(html).toContain('href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html"');
      expect(html).toContain(en?'NASA NSSDCA Sun Fact Sheet':'Ficha de dados do Sol da NASA NSSDCA');
      expect(html).toContain(en?'Not applicable':'Não se aplica');
    }
  });
  test('the Moon reports its distance from Earth and missions need a handler', async () => {
    const html=await render('en',<SolarBodyPanel body="MOON" onSelect={ignore}/>);
    expect(html).toContain('0.384 million km from Earth');
    expect(html).toContain('27.3 days around Earth');
    expect(html).not.toContain('Missions here');
    expect(html).not.toContain('Exploration only');
  });
});
