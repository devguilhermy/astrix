import { useTranslation } from 'react-i18next';

const en = {
  'body.SUN':'Sun', 'body.MERCURY':'Mercury', 'body.VENUS':'Venus', 'body.EARTH':'Earth', 'body.MOON':'Moon', 'body.MARS':'Mars', 'body.JUPITER':'Jupiter', 'body.SATURN':'Saturn', 'body.URANUS':'Uranus', 'body.NEPTUNE':'Neptune',
  'kind.STAR':'Star', 'kind.TERRESTRIAL_PLANET':'Terrestrial planet', 'kind.NATURAL_SATELLITE':'Natural satellite', 'kind.GAS_GIANT':'Gas giant', 'kind.ICE_GIANT':'Ice giant',
  bodyNav:'Browse worlds', previous:'Previous world: {{name}}', next:'Next world: {{name}}', close:'Close and return to the Solar System overview',
  facts:'Key facts', diameter:'Diameter', mass:'Mass', gravity:'Surface gravity', day:'Length of day', rotation:'Rotation period', year:'Orbital period', distance:'Distance', temperature:'Mean temperature', effectiveTemperature:'Surface temperature (effective)', moons:'Moons',
  massUnit:'× 10²⁴ kg', hours:'{{value}} h', days:'{{value}} days', daysAroundEarth:'{{value}} days around Earth', fromSun:'{{value}} million km from the Sun', fromEarth:'{{value}} million km from Earth', solarCentre:'Centre of the Solar System', notApplicable:'Not applicable',
  compare:'Compared with Earth', compareScale:'Logarithmic scale; the centre line is Earth.', compareReference:'Earth is the reference for these comparisons.', ratio:'{{value}}× Earth', compareDiameter:'Diameter', compareGravity:'Gravity', compareDay:'Length of day', compareRotation:'Rotation',
  rings:'Ring system', magneticField:'Global magnetic field', yes:'Yes', no:'No',
  exploredBy:'Explored by', exploredByNote:'Opens the NASA Science page for this world.',
  imageNote:'Globe image', scale:'Sizes in the 3D view are to scale with the Sun; distances are compressed.',
  source:'Source:', retrieved:'retrieved {{date}}', 'source.nssdca-planetary-metric':'NASA NSSDCA Planetary Fact Sheet', 'source.nssdca-sun':'NASA NSSDCA Sun Fact Sheet',
  missionsHere:'Missions here', explorationOnly:'Exploration only. Missions are available at the Sun, Earth, the Moon and Mars.',
  'explorer.International Space Station':'International Space Station'
};

const pt: Record<keyof typeof en, string> = {
  'body.SUN':'Sol', 'body.MERCURY':'Mercúrio', 'body.VENUS':'Vênus', 'body.EARTH':'Terra', 'body.MOON':'Lua', 'body.MARS':'Marte', 'body.JUPITER':'Júpiter', 'body.SATURN':'Saturno', 'body.URANUS':'Urano', 'body.NEPTUNE':'Netuno',
  'kind.STAR':'Estrela', 'kind.TERRESTRIAL_PLANET':'Planeta rochoso', 'kind.NATURAL_SATELLITE':'Satélite natural', 'kind.GAS_GIANT':'Gigante gasoso', 'kind.ICE_GIANT':'Gigante de gelo',
  bodyNav:'Navegar pelos mundos', previous:'Mundo anterior: {{name}}', next:'Próximo mundo: {{name}}', close:'Fechar e voltar à visão geral do Sistema Solar',
  facts:'Dados principais', diameter:'Diâmetro', mass:'Massa', gravity:'Gravidade na superfície', day:'Duração do dia', rotation:'Período de rotação', year:'Período orbital', distance:'Distância', temperature:'Temperatura média', effectiveTemperature:'Temperatura da superfície (efetiva)', moons:'Luas',
  massUnit:'× 10²⁴ kg', hours:'{{value}} h', days:'{{value}} dias', daysAroundEarth:'{{value}} dias ao redor da Terra', fromSun:'{{value}} milhões de km do Sol', fromEarth:'{{value}} milhões de km da Terra', solarCentre:'Centro do Sistema Solar', notApplicable:'Não se aplica',
  compare:'Comparado com a Terra', compareScale:'Escala logarítmica; a linha central é a Terra.', compareReference:'A Terra é a referência destas comparações.', ratio:'{{value}}× a Terra', compareDiameter:'Diâmetro', compareGravity:'Gravidade', compareDay:'Duração do dia', compareRotation:'Rotação',
  rings:'Sistema de anéis', magneticField:'Campo magnético global', yes:'Sim', no:'Não',
  exploredBy:'Explorado por', exploredByNote:'Abre a página da NASA Science sobre este mundo.',
  imageNote:'Imagem do globo', scale:'Os tamanhos na vista 3D estão em escala com o Sol; as distâncias estão comprimidas.',
  source:'Fonte:', retrieved:'consultada em {{date}}', 'source.nssdca-planetary-metric':'Ficha de dados planetários da NASA NSSDCA (Planetary Fact Sheet)', 'source.nssdca-sun':'Ficha de dados do Sol da NASA NSSDCA (Sun Fact Sheet)',
  missionsHere:'Missões aqui', explorationOnly:'Somente exploração. Há missões no Sol, na Terra, na Lua e em Marte.',
  'explorer.International Space Station':'Estação Espacial Internacional'
};

export const solarEnglish: Record<string, string> = Object.fromEntries(Object.entries(en).map(([key,value])=>[`solar.${key}`,value]));
export const solarPortuguese: Record<string, string> = Object.fromEntries(Object.entries(pt).map(([key,value])=>[`solar.${key}`,value]));
export function useSolarCopy() { const {t} = useTranslation(); return (key: string, values?: Record<string, string | number>) => t(`solar.${key}`, {defaultValue:key, ...values}); }
