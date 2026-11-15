import { ENGINEERING, THERMAL_MODELS, type ModelParameter } from '@astrix/core/models';
import { listParts } from '@astrix/core';

const labels:Record<keyof typeof ENGINEERING,readonly [string,string]>={
 sigma:['Rounded Stefan–Boltzmann reference constant','Constante de referência de Stefan–Boltzmann arredondada'],
 solarFlux:['Rounded solar flux at 1 AU; inverse-square distance scaling','Fluxo solar arredondado a 1 UA; escala com o inverso do quadrado da distância'],
 arrayEol:['Linear accelerated end-of-life array factor, not real short-term aging','Fator final do painel com envelope linear acelerado, não envelhecimento real em poucos dias'],
 batteryEol:['Linear accelerated end-of-life battery factor; no chemical repair','Fator final da bateria com envelope linear acelerado; sem reparo químico'],
 reacquireSec:['Fallback reacquisition time, not momentum unloading','Tempo de reaquisição em contingência, não descarga de momento'],
 reacquirePower:['Additional reacquisition load; SmallSat uses ten times this value','Carga adicional de reaquisição; SmallSat usa dez vezes este valor'],
 fallbackAccuracyScale:['Retained ADCS angular calibration error multiplier after fallback recovery','Multiplicador do erro angular de calibração retido pelo ADCS após recuperação em contingência'],
 normalThreshold:['Normal link quality threshold, not a decibel margin','Limiar de qualidade do enlace normal, não margem em decibéis'],
 robustThreshold:['Robust link quality threshold; does not bypass geometry','Limiar de qualidade do enlace robusto; não ignora geometria'],
 degradedLinkQuality:['Authored reduced quality during the degraded-link incident','Qualidade reduzida autoral durante o incidente do enlace'],
 robustRate:['Robust-mode throughput fraction','Fração da vazão no modo robusto'],
 robustPower:['Robust-mode transmit-power multiplier','Multiplicador da potência de transmissão no modo robusto'],
 allocationHours:['Authored daily station allocation, not live DSN availability','Alocação diária autoral da estação, não disponibilidade DSN ao vivo'],
 commandLifetimeSec:['Command validity includes contact waiting and propagation','A validade do comando inclui espera por contato e propagação'],
 resetCooldownSec:['Minimum diagnostic/cooldown interval before computer recovery','Intervalo mínimo de diagnóstico e espera antes de recuperar o computador'],
 bootSec:['Powered recovery duration; returns in SAFE with science and sending off','Duração da recuperação energizada; retorna em SAFE, com ciência e envio desligados'],
 bootPower:['Boot power reserved and debited at recovery start; SmallSat uses ten times this value','Potência de inicialização reservada e debitada no início da recuperação; SmallSat usa dez vezes este valor'],
 captureLow:['Lower capture-demand envelope around nominal velocity change','Limite inferior da demanda de captura em torno da variação nominal de velocidade'],
 captureHigh:['Upper planning capture envelope; does not propagate a dispersed orbit','Envelope superior de planejamento da captura; não propaga uma órbita dispersa'],
 thermalDwellSec:['Continuous survival-limit violation before failure','Tempo contínuo fora do limite térmico de sobrevivência antes da falha'],
 payloadDwellSec:['Continuous operating-limit violation before payload inhibition','Tempo contínuo fora do limite operacional antes de inibir instrumentos'],
 heaterOnK:['Automatic heater turns on at or below this temperature','O aquecedor automático liga nesta temperatura ou abaixo dela'],
 heaterOffK:['Automatic heater turns off at or above this temperature','O aquecedor automático desliga nesta temperatura ou acima dela']
};
const thermalLabels:Record<keyof typeof THERMAL_MODELS.CUBESAT_3U,readonly [string,string]>={
 capacityJK:['Single-node thermal capacity','Capacidade térmica de um único nó'],
 radiatorM2:['Effective radiating area including view factor','Área radiativa efetiva incluindo fator de vista'],
 absorbingM2:['Effective solar absorption area including absorptivity and view factor','Área efetiva de absorção solar incluindo absortividade e fator de vista'],
 bodyHeatW:['Constant absorbed body infrared; albedo omitted','Infravermelho absorvido do planeta constante; albedo omitido'],
 emissivity:['Gray-body emissivity','Emissividade de corpo cinza'],
 operatingMinK:['Lower payload operating limit','Limite inferior de operação dos instrumentos'],
 operatingMaxK:['Upper payload operating limit','Limite superior de operação dos instrumentos'],
 survivalMinK:['Lower equipment survival limit','Limite inferior de sobrevivência do equipamento'],
 survivalMaxK:['Upper equipment survival limit','Limite superior de sobrevivência do equipamento'],
 initialK:['Initial/arrival temperature; cruise thermal physics omitted','Temperatura inicial e de chegada; física térmica do cruzeiro omitida']
};
export const modelEnglish:Record<string,string>={};
export const modelPortuguese:Record<string,string>={};
function add(key:string,parameter:ModelParameter,label:readonly [string,string]){
 const units=`${parameter.units}; [${parameter.range[0]}, ${parameter.range[1]}]`;
 modelEnglish[`assumption.${key}`]=`${label[0]} (${units}). ${parameter.p.kind==='assumption'?parameter.p.note:'Reference parameter.'}`;
 modelPortuguese[`assumption.${key}`]=`${label[1]} (${units}). Coeficiente declarado das regras 4; valores de equipamentos são premissas didáticas, não dados calibrados nem qualificação de voo.`;
}
for(const key of Object.keys(ENGINEERING) as (keyof typeof ENGINEERING)[])add(`engineering.${key}`,ENGINEERING[key],labels[key]);
for(const bus of ['CUBESAT_3U','SMALLSAT','CREW_CAPSULE'] as const)for(const key of Object.keys(thermalLabels) as (keyof typeof thermalLabels)[])add(`thermal.${bus}.${key}`,THERMAL_MODELS[bus][key],thermalLabels[key]);
for(const bus of ['CUBESAT_3U','SMALLSAT','CREW_CAPSULE'] as const)for(const part of listParts(bus).filter(item=>item.category==='THERMAL')){
 for(const [field,unit] of [['massKg','kg'],['volume',bus==='SMALLSAT'?'bay':'U'],['cost','game-budget units'],['powerW','W'],['heaterW','W']] as const){
  modelEnglish[`assumption.part.${part.id}.${field}`]=`Authored heater hardware ${field} (${unit}); paid mass, volume, cost and electrical heat, not manufacturer-qualified data.`;
  modelPortuguese[`assumption.part.${part.id}.${field}`]=`Parâmetro autoral ${field} do aquecedor (${unit}); massa, espaço, custo e aquecimento elétrico são contabilizados, não dados qualificados de fabricante.`;
 }
}
const attitudeLabels = {
 slewRateDegSec: ['Maximum commanded slew rate (degrees per second)', 'Velocidade máxima de manobra comandada (graus por segundo)'],
 accuracyDeg: ['Retained angular calibration error (degrees)', 'Erro angular de calibração retido (graus)'],
 coneHalfAngleDeg: ['Instrument acceptance cone half-angle (degrees)', 'Meio ângulo do cone de aceitação do instrumento (graus)'],
 beamHalfAngleDeg: ['Directional radio half-power beam angle (degrees)', 'Ângulo de meia potência do feixe direcional de rádio (graus)'],
} as const;
for(const bus of ['CUBESAT_3U','SMALLSAT','CREW_CAPSULE'] as const)for(const part of listParts(bus)){
 for(const field of Object.keys(attitudeLabels) as (keyof typeof attitudeLabels)[]){
  if(!part[field])continue;
  modelEnglish[`assumption.part.${part.id}.${field}`]=`${attitudeLabels[field][0]}. Authored educational parameter; not calibrated hardware data.`;
  modelPortuguese[`assumption.part.${part.id}.${field}`]=`${attitudeLabels[field][1]}. Parâmetro didático autoral; não é dado calibrado de equipamento.`;
 }
}
Object.assign(modelEnglish,{
 'assumption.model.twoBody':'Two-body gravity, cylindrical eclipse and idealized optimal-window Earth–Mars transfer. Low-precision solar longitude with equatorial obliquity; no J2, drag, precession or third-body forces. Technical thermal control is a single bus node.',
 'assumption.model.radiationReplay':'ISS hourly measurements replayed as an environment approximation. Co-occurrence with a DONKI storm does not prove causality. SAFE changes powered electronics, not shielding; dose does not drive irreversible random loss.',
 'assumption.model.solarEphemeris':'Low-precision equatorial Sun: mean longitude/anomaly, two equation-of-center harmonics and fixed 23.439° J2000 obliquity. Precession, nutation, aberration and Earth distance variation omitted; Mars remains an idealized circular-transfer approximation.',
 'assumptionValue.model.solarEphemeris':'Low-precision equatorial Sun',
 'assumption.model.attitude':'Rate-limited body-to-MJ2000Eq quaternion: +X panel normal, +Z instrument and antenna. Paid ADCS slew rate and retained calibration error; solar-optimal roll in hold modes. No torque, inertia, wheel saturation, gimbals or attitude propellant.',
 'assumptionValue.model.attitude':'Rate-limited quaternion',
 'assumption.model.forecasts':'Timeline samples a bounded seven-day horizon; narrow windows can be missed. Dry run uses ordinary transported commands and real failures over up to 90 operational days, with analytical cruise and at most 512 chart samples. No uploaded autonomous plan is implied.',
 'assumptionValue.model.forecasts':'Bounded DEFAULT policy',
});
Object.assign(modelPortuguese,{
 'assumption.model.twoBody':'Gravidade de dois corpos, eclipse cilíndrico e transferência Terra–Marte idealizada em janela ótima. Longitude solar de baixa precisão com obliquidade equatorial; sem J2, arrasto, precessão ou forças de terceiros corpos. O controle térmico técnico usa um nó da plataforma.',
 'assumption.model.radiationReplay':'Medições horárias da ISS reproduzidas como aproximação ambiental. Coincidência com uma tempestade DONKI não prova causalidade. SAFE muda cargas elétricas, não blindagem; a dose não causa perdas aleatórias irreversíveis.',
 'assumption.model.solarEphemeris':'Sol equatorial de baixa precisão: longitude e anomalia médias, dois harmônicos da equação do centro e obliquidade J2000 fixa de 23,439°. Sem precessão, nutação, aberração ou variação da distância terrestre; Marte mantém a aproximação circular de transferência idealizada.',
 'assumptionValue.model.solarEphemeris':'Sol equatorial de baixa precisão',
 'assumption.model.attitude':'Quatérnio do corpo para MJ2000Eq limitado por velocidade: +X normal dos painéis, +Z instrumento e antena. Velocidade e erro de calibração do ADCS instalado; rolagem otimizada para o Sol nos modos automáticos. Sem torque, inércia, saturação de rodas, articulações ou propelente de atitude.',
 'assumptionValue.model.attitude':'Quatérnio limitado por velocidade',
 'assumption.model.forecasts':'A linha do tempo amostra até sete dias; janelas estreitas podem não aparecer. O ensaio usa comandos transportados e falhas reais por até 90 dias operacionais, com cruzeiro analítico e até 512 amostras. Não implica um plano autônomo enviado à nave.',
 'assumptionValue.model.forecasts':'Política DEFAULT limitada',
});
