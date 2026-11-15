import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createTurnGame, defaultQuickDesign, missionById, missionOffers } from '@astrix/core';
import { english, portuguese } from '../../i18n/resources';
import { MissionBoard, Preparation } from './Preparation';
import { TurnWorkspace } from './TurnWorkspace';
import { ScienceConnection } from './ScienceConnection';
import { Duration } from './Evidence';
import type { ReactNode } from 'react';

async function render(language:'en'|'pt-BR',children:ReactNode) {
  const i18n=createInstance();
  await i18n.init({lng:language,fallbackLng:'en',resources:{en:{translation:english},'pt-BR':{translation:portuguese}},keySeparator:false,interpolation:{escapeValue:false}});
  return renderToStaticMarkup(<I18nextProvider i18n={i18n}>{children}</I18nextProvider>);
}
const ignore=()=>{};
describe('one bilingual Design & Play surface',()=>{
  test('the mission board begins with the short Earth mission and exposes design without a studio wizard',async()=>{
    const offers=missionOffers('EARTH','ASPIRING');
    expect(offers[0].missionId).toBe('FIRST_SIGNAL');
    for(const language of ['en','pt-BR'] as const){
      const html=await render(language,<MissionBoard offers={offers} onChoose={ignore} onDesign={ignore}/>);
      expect(html).toContain(language==='en'?'Design &amp; Play':'Projetar e jogar');
      expect(html).not.toContain('MISSION STUDIO');expect(html).not.toContain('play.');
    }
  });
  test('preparation starts from actual catalogue constraints and cannot start before certification',async()=>{
    for(const language of ['en','pt-BR'] as const){
      const html=await render(language,<Preparation config={defaultQuickDesign()} onChange={ignore} onPlay={ignore}/>);
      expect(html).toContain('disabled=""');expect(html).toContain('name="ambition"');expect(html).toContain('name="kit"');expect(html).toContain('name="approach"');
      expect(html).not.toContain('ui.volume');expect(html).not.toContain('NEED_GOALS');expect(html).not.toContain('Sign off');
    }
  });
  test('both levels use actual plans and one disabled-until-preview commit instead of time controls',async()=>{
    for(const level of ['ASPIRING','EXPERT'] as const){
      const game=createTurnGame(defaultQuickDesign('FIRST_SIGNAL',level));
      const html=await render('en',<TurnWorkspace game={game} onCommit={ignore} onCheckpoint={ignore} onRetry={ignore} onRedesign={ignore} onTools={ignore} busy={false} disabled={false} host journal={[]} hints/>);
      expect(html).toContain('name="turn-plan"');expect(html).toContain('Consequence preview');expect(html).toContain('disabled=""');
      expect(html).not.toContain('SET_WARP');expect(html).not.toContain('Pause');expect(html).not.toContain('Sign off');
    }
  });
  test('compact preparation and turn panels expose linked keyboard controls and keep one guarded primary action',async()=>{
    const game=createTurnGame(defaultQuickDesign());
    for(const language of ['en','pt-BR'] as const){
      for(const surface of [
        <Preparation config={defaultQuickDesign()} onChange={ignore} onPlay={ignore}/>,
        <TurnWorkspace game={game} onCommit={ignore} onCheckpoint={ignore} onRetry={ignore} onRedesign={ignore} onTools={ignore} busy={false} disabled={false} host journal={[]} hints/>,
      ]){
        const html=await render(language,surface);
        const controls=[...html.matchAll(/<button\b[^>]*aria-controls="([^"]+)"/g)];
        expect(controls).toHaveLength(2);
        for(const control of controls)expect(html).toContain(`id="${control[1]}"`);
        expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
        expect(html.match(/<button\b[^>]* disabled=""/g)).toHaveLength(1);
        expect(html).not.toContain('play.missionPanels');
      }
    }
  });
  test('archival images and bounded USGS products have visible provenance separate from game evidence',async()=>{
    const html=await render('en',<ScienceConnection definition={missionById('RED_RELAY')}/>);
    expect(html).toContain('mars-viking-1024.jpg');expect(html).toContain('NASA Viking');expect(html).toContain('title/name heuristic');expect(html).toContain('astrogeology.usgs.gov/search/map/');expect(html).toContain('not an image or measurement collected by your spacecraft');
  });
  test('duration labels distinguish one day from several in both languages',async()=>{
    expect(await render('en',<Duration seconds={86400}/>)).toContain('1 day');expect(await render('en',<Duration seconds={172800}/>)).toContain('2 days');
    expect(await render('pt-BR',<Duration seconds={86400}/>)).toContain('1 dia');expect(await render('pt-BR',<Duration seconds={172800}/>)).toContain('2 dias');
  });
});
