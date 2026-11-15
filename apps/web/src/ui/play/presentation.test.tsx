import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { commitTurn, computeBudgets, createTurnGame, defaultQuickDesign, missionById, missionOffers, telemetry, turnDecision, type TurnGameState } from '@astrix/core';
import { english, portuguese } from '../../i18n/resources';
import { MissionBoard, Preparation } from './Preparation';
import { TurnWorkspace } from './TurnWorkspace';
import { LevelToggle } from './LevelToggle';
import { turnMoments } from './turnMoments';
import { ScienceConnection } from './ScienceConnection';
import { Duration } from './Evidence';
import { SolarWelcome } from './SolarWelcome';
import { MissionResources, MissionResourceCell } from './MissionResources';
import { ReplaceSaveDialog } from './ReplaceSaveDialog';
import { resourceModel, RESOURCE_ORDER } from '../hud/resourceModel';
import type { ReactNode } from 'react';

async function render(language:'en'|'pt-BR',children:ReactNode) {
  const i18n=createInstance();
  await i18n.init({lng:language,fallbackLng:'en',resources:{en:{translation:english},'pt-BR':{translation:portuguese}},keySeparator:false,interpolation:{escapeValue:false}});
  return renderToStaticMarkup(<I18nextProvider i18n={i18n}>{children}</I18nextProvider>);
}
const ignore=()=>{};
function committed(game:TurnGameState,planId:string):TurnGameState {
  const result=commitTurn(game,{decisionId:turnDecision(game).id,baseRevision:game.revision,planId,idempotencyKey:`turn-${game.revision}`});
  if(!result.ok)throw new Error(`${result.code}: ${result.message}`);
  return result.value.state;
}
describe('one bilingual Design & Play surface',()=>{
  test('free exploration offers mission entry without presenting or selecting a mission',async()=>{
    for(const language of ['en','pt-BR'] as const){
      const html=await render(language,<SolarWelcome onMissions={ignore}/>);
      expect(html.match(/<button\b/g)).toHaveLength(1);
      expect(html).toContain(language==='en'?'Choose a mission':'Escolher uma missão');
      expect(html).not.toContain('<select');expect(html).not.toContain('type="radio"');
      expect(html).not.toContain('play.solar');
    }
  });
  test('all seven live resources retain actual model values, units and uncrewed n/a in both languages',async()=>{
    const game=createTurnGame(defaultQuickDesign()),current=telemetry(game.sim);
    const models=resourceModel(game.design.definition,game.design,computeBudgets(game.design),current);
    expect(models.map(item=>item.id)).toEqual([...RESOURCE_ORDER]);
    for(const language of ['en','pt-BR'] as const){
      const html=await render(language,<MissionResources game={game}/>);
      expect(html.match(/<li\b/g)).toHaveLength(7);
      expect(html.match(/<output\b/g)).toHaveLength(7);
      const measurable=models.filter(item=>!['na','unknown'].includes(item.status)&&item.value!==null&&item.limit!==null&&item.limit>0);
      expect(html.match(/role="meter"/g)).toHaveLength(measurable.length);
      for(const model of measurable){
        expect(html).toContain(`aria-valuemax="${model.limit}"`);
        expect(html).toContain(`aria-valuenow="${Math.min(model.limit!,Math.max(0,model.value!))}"`);
      }
      expect(html).toContain('n/a');expect(html).not.toContain('NaN');expect(html).not.toContain('play.resource.');
    }
  });
  test('unknown resource capacity is labeled, never rendered as a fabricated full or empty measurement',async()=>{
    const game=createTurnGame(defaultQuickDesign()),models=resourceModel(game.design.definition,game.design,computeBudgets(game.design),telemetry(game.sim));
    const unknown={...models[1],status:'unknown' as const,value:null,limit:null,fill:0};
    for(const language of ['en','pt-BR'] as const){
      const html=await render(language,<MissionResourceCell resource={unknown}/>);
      expect(html).toContain(language==='en'?'Unknown':'Desconhecido');
      expect(html).not.toContain('role="meter"');expect(html).not.toContain('NaN');
    }
  });
  test('save replacement uses the shared accessible dialog with explicit cancel and guarded confirmation',async()=>{
    for(const language of ['en','pt-BR'] as const){
      const html=await render(language,<ReplaceSaveDialog busy onCancel={ignore} onConfirm={ignore}/>);
      expect(html).toContain('role="dialog"');expect(html).toContain('aria-modal="true"');
      expect(html).toContain(language==='en'?'Cancel':'Cancelar');
      expect(html).toContain(language==='en'?'Replace attempt':'Substituir tentativa');
      expect(html.match(/<button\b/g)).toHaveLength(3);
      expect(html.match(/<button\b[^>]* disabled=""/g)).toHaveLength(1);
      expect(html).not.toContain('play.replace');
    }
  });
  test('the mission board begins with the short Earth mission and exposes design without a studio wizard',async()=>{
    const offers=missionOffers('EARTH','ASPIRING');
    expect(offers[0].missionId).toBe('FIRST_SIGNAL');
    for(const language of ['en','pt-BR'] as const){
      const html=await render(language,<MissionBoard offers={offers} onChoose={ignore} onDesign={ignore}/>);
      expect(html).toContain(language==='en'?'Design &amp; Play':'Projetar e jogar');
      expect(html).not.toContain('MISSION STUDIO');expect(html).not.toContain('play.');
      expect(html.match(/<div class="mission-board">/g)).toHaveLength(1);
      expect(html.match(/<article class="mission-offer">/g)).toHaveLength(Math.min(3,offers.length));
      expect(html.match(/class="mission-illustration"/g)).toHaveLength(Math.min(3,offers.length));
      expect(html).toContain('data-tour="mission-board"');expect(html).toContain('aria-expanded="false"');
    }
  });
  test('the challenge level is two pressed-state buttons with one description line, never a native select',async()=>{
    for(const language of ['en','pt-BR'] as const){
      for(const level of ['ASPIRING','EXPERT'] as const){
        const html=await render(language,<LevelToggle value={level} onChange={ignore}/>);
        expect(html).toContain('role="group"');expect(html).not.toContain('<select');
        expect(html.match(/<button\b[^>]*aria-pressed=/g)).toHaveLength(2);
        expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
        expect(html).toContain(language==='en'?'Challenge level':'Nível de desafio');
        expect(html).toContain(language==='en'?(level==='ASPIRING'?'Guided choices':'tighter constraints'):(level==='ASPIRING'?'Escolhas orientadas':'limites mais apertados'));
        expect(html).not.toContain('play.');
      }
    }
    expect(await Bun.file(new URL('./PlayApp.tsx',import.meta.url)).text()).not.toContain('<select');
  });
  test('destination tabs and copy name the Sun alongside Earth, the Moon and Mars',()=>{
    expect(english['play.SUN']).toBe('Sun');expect(portuguese['play.SUN']).toBe('Sol');
    expect(english['play.solarMissionNote']).toContain('the Sun, Earth, the Moon and Mars');
    expect(portuguese['play.solarMissionNote']).toContain('no Sol, na Terra, na Lua e em Marte');
  });
  test('preparation starts from actual catalogue constraints and cannot start before certification',async()=>{
    for(const language of ['en','pt-BR'] as const){
      const html=await render(language,<Preparation config={defaultQuickDesign()} onChange={ignore} onPlay={ignore}/>);
      expect(html).toContain('disabled=""');expect(html).toContain('name="ambition"');expect(html).toContain('name="kit"');expect(html).toContain('name="approach"');
      expect(html).not.toContain('ui.volume');expect(html).not.toContain('NEED_GOALS');expect(html).not.toContain('Sign off');
    }
  });
  test('after a committed turn the preview panel leads with a live "Last turn" result card',async()=>{
    const game=committed(createTurnGame(defaultQuickDesign()),'observe'),moments=turnMoments(game);
    expect(moments).toHaveLength(1);
    for(const language of ['en','pt-BR'] as const){
      const html=await render(language,<TurnWorkspace game={game} onCommit={ignore} onCheckpoint={ignore} onRetry={ignore} onRedesign={ignore} onTools={ignore} busy={false} disabled={false} host journal={[]} hints moments={moments} selectedTurn={null} onSelectTurn={ignore}/>);
      const panel=html.slice(html.indexOf('id="turn-preview-panel"'));
      expect(panel).toMatch(/^[^]*?<section class="last-turn"[^>]*aria-live="polite"/);
      expect(panel.indexOf('class="last-turn"')).toBeLessThan(panel.indexOf(`</h2>`));
      expect(panel).toContain(language==='en'?'Last turn':'Último turno');
      expect(panel).toContain('<article class="fb-card"');expect(panel).not.toContain('fb-card-compact');
      expect(html).not.toContain('mission-fuel');expect(html).not.toContain('play.lastTurn');
    }
    const fresh=await render('en',<TurnWorkspace game={createTurnGame(defaultQuickDesign())} onCommit={ignore} onCheckpoint={ignore} onRetry={ignore} onRedesign={ignore} onTools={ignore} busy={false} disabled={false} host journal={[]} hints moments={[]} selectedTurn={null} onSelectTurn={ignore}/>);
    expect(fresh).not.toContain('class="last-turn"');
  });
  test('both levels use actual plans and one disabled-until-preview commit instead of time controls',async()=>{
    for(const level of ['ASPIRING','EXPERT'] as const){
      const game=createTurnGame(defaultQuickDesign('FIRST_SIGNAL',level));
      const html=await render('en',<TurnWorkspace game={game} onCommit={ignore} onCheckpoint={ignore} onRetry={ignore} onRedesign={ignore} onTools={ignore} busy={false} disabled={false} host journal={[]} hints moments={[]} selectedTurn={null} onSelectTurn={ignore}/>);
      expect(html).toContain('name="turn-plan"');expect(html).toContain('Consequence preview');expect(html).toContain('disabled=""');
      expect(html).not.toContain('SET_WARP');expect(html).not.toContain('Pause');expect(html).not.toContain('Sign off');
    }
  });
  test('compact preparation and turn panels expose linked keyboard controls and keep one guarded primary action',async()=>{
    const game=createTurnGame(defaultQuickDesign());
    for(const language of ['en','pt-BR'] as const){
      for(const surface of [
        <Preparation config={defaultQuickDesign()} onChange={ignore} onPlay={ignore}/>,
        <TurnWorkspace game={game} onCommit={ignore} onCheckpoint={ignore} onRetry={ignore} onRedesign={ignore} onTools={ignore} busy={false} disabled={false} host journal={[]} hints moments={[]} selectedTurn={null} onSelectTurn={ignore}/>,
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
  test('the persistent action rail contains every actual plan once and locks all toggles during commitment',async()=>{
    const game=createTurnGame(defaultQuickDesign()),plans=turnDecision(game).plans;
    for(const language of ['en','pt-BR'] as const){
      for(const busy of [false,true]){
        const html=await render(language,<TurnWorkspace game={game} onCommit={ignore} onCheckpoint={ignore} onRetry={ignore} onRedesign={ignore} onTools={ignore} busy={busy} disabled={false} host journal={[]} hints moments={[]} selectedTurn={null} onSelectTurn={ignore}/>);
        const radios=[...html.matchAll(/<input\b[^>]*name="turn-plan"[^>]*>/g)].map(match=>match[0]);
        expect(radios).toHaveLength(plans.length);
        for(const plan of plans)expect(radios.filter(radio=>radio.includes(`value="${plan.id}"`))).toHaveLength(1);
        expect(radios.filter(radio=>radio.includes('disabled=""'))).toHaveLength(busy?plans.length:0);
        expect(html).not.toContain('play.action.');
        expect(html.match(/<button\b[^>]* disabled=""/g)).toHaveLength(1);
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
