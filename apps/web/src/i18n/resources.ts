import en from './locales/en.json';
import pt from './locales/pt-BR.json';
import { refinementEnglish, refinementPortuguese } from './refinement';
import { sceneTranslations } from '../ui/scene/copy';
import { windowResources } from '../ui/layout/windowCopy';
import { CORE_I18N_DEFAULTS, CORE_MISSION_PT_BR } from '@astrix/core/i18nKeys';
import { CORE_TECHNICAL_PT } from '@astrix/core/technicalCopy';
import { modelEnglish, modelPortuguese } from './modelCopy';
import { learningEnglish, learningPortuguese } from './learning';
import { flightEnglish, flightPortuguese } from '../ui/flight/copy';
import { recoveryEnglish, recoveryPortuguese } from '../ui/recovery/copy';
import { inspectorEnglish, inspectorPortuguese } from '../ui/inspector/copy';
import { multiplayerEnglish, multiplayerPortuguese } from '../ui/multiplayer/copy';
import { playEnglish, playPortuguese } from '../ui/play/copy';
import { feedbackEnglish, feedbackPortuguese } from '../ui/play/feedback/copy';
import { solarEnglish, solarPortuguese } from '../ui/play/solar/copy';

export const english:Readonly<Record<string,string>> = {...en,...CORE_I18N_DEFAULTS,...modelEnglish,...refinementEnglish,...sceneTranslations.en,...windowResources.en,...learningEnglish,...flightEnglish,...recoveryEnglish,...inspectorEnglish,...multiplayerEnglish,...playEnglish,...feedbackEnglish,...solarEnglish};
export const portuguese:Readonly<Record<string,string>> = {...pt,...CORE_MISSION_PT_BR,...CORE_TECHNICAL_PT,...modelPortuguese,...refinementPortuguese,...sceneTranslations['pt-BR'],...windowResources['pt-BR'],...learningPortuguese,...flightPortuguese,...recoveryPortuguese,...inspectorPortuguese,...multiplayerPortuguese,...playPortuguese,...feedbackPortuguese,...solarPortuguese};
