import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { english, portuguese } from '../../i18n/resources';
import { Wizard, emptyDraft, type SetupDraft } from './Wizard';

test('level cards, expanded team, player columns and local-play card render in both languages',async()=>{
 const draft:SetupDraft={...emptyDraft,track:'CHALLENGE',mission:'FIRST_LIGHT',players:4,assignments:{SCIENCE:0,SPACECRAFT:1,LAUNCH_ORBIT:2,GROUND_COMMS:3}};
 for(const [language,copy] of [['en',english],['pt-BR',portuguese]] as const) {
  const i18n=createInstance();await i18n.init({lng:language,resources:{[language]:{translation:copy}},keySeparator:false,interpolation:{escapeValue:false}});
  let starts=0;
  const html=renderToStaticMarkup(<I18nextProvider i18n={i18n}><Wizard draft={draft} onChange={()=>{throw new Error('Rendering must not change setup');}} onStart={()=>{starts++;}} onHome={()=>{throw new Error('Rendering must not navigate');}} onOpenStudio={()=>{throw new Error('Rendering must not open the studio');}}/></I18nextProvider>);
  expect(html.match(/class="setup-level-card"/g)?.length).toBe(2);
  expect(html).toContain('aria-pressed="true"');expect(html).toContain('aria-pressed="false"');
  expect(html).toContain('<details class="setup-team" open="">');
  expect(html.match(/class="setup-player-column"/g)?.length).toBe(4);
  expect(html).toContain('class="setup-role-choice"');expect(html).toContain('class="setup-local-card"');
  expect(html).toContain(copy['setup.localTitle']);expect(html).toContain(copy['setup.roleHint']);
  expect(html).toContain('href="/host"');expect(html).not.toContain('setup.localTitle');
  expect(starts).toBe(0);
 }
});

test('Learn, Challenges and Create tracks render without untranslated keys in both languages',async()=>{
 for(const [language,copy] of [['en',english],['pt-BR',portuguese]] as const) {
  const i18n=createInstance();await i18n.init({lng:language,resources:{[language]:{translation:copy}},keySeparator:false,interpolation:{escapeValue:false}});
  for(const track of ['LEARN','CHALLENGE','CREATE'] as const) {
   const draft:SetupDraft={...emptyDraft,track,level:track==='CREATE'?'EXPERT':'ASPIRING'};
   const html=renderToStaticMarkup(<I18nextProvider i18n={i18n}><Wizard draft={draft} onChange={()=>{}} onStart={()=>{}} onHome={()=>{}} onOpenStudio={()=>{}}/></I18nextProvider>);
   expect(html,`${language}:${track}`).toContain(copy[`setup.track.${track}`]!);
   expect(html,`${language}:${track}`).not.toMatch(/\b(setup|studio|library|learning|objective)\.[A-Za-z]/);
  }
 }
});
