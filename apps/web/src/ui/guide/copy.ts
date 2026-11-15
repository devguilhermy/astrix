const en = {
 title:'Mission control', requirements:'Requirements', slots:'Spacecraft slots', checklist:'Checklist', flight:'Flight controls', close:'Close options', navigation:'Mission navigation', panels:'Mission panels', stage:'Mission UI', locked:'Locked — complete the preceding stage', next:'Next', nextContact:'Next contact: T+ {{time}} s', noContact:'No further contact estimated', edge:'{{kind}} · T+ {{time}} s', advanceEdge:'Advance to {{kind}}', show:'Show me', owner:'Next: {{owner}}', complete:'Ready for the next stage', viewOnly:'Flight hardware is view-only. Presentation controls never command the spacecraft.',
 brief:'Mission brief', bus:'Connected segments', requirementsView:'Mission requirements', equipment:'Equipment', orbit:'Orbit and ride', trajectory:'Trajectory', readiness:'Readiness checks', signoffs:'Role approvals', operations:'Flight operations', results:'Flight results',
 tourControl:'Mission-control tour', tourQuote:'Choice tour', quoteOffer:'Review the controls for this choice', options:'Options',
};
const pt:typeof en = {
 title:'Controle da missão', requirements:'Requisitos', slots:'Encaixes da nave', checklist:'Lista de tarefas', flight:'Controles de voo', close:'Fechar opções', navigation:'Navegação da missão', panels:'Painéis da missão', stage:'Tela da missão', locked:'Bloqueado — conclua a etapa anterior', next:'Próximo', nextContact:'Próximo contato: T+ {{time}} s', noContact:'Nenhum outro contato estimado', edge:'{{kind}} · T+ {{time}} s', advanceEdge:'Avançar até {{kind}}', show:'Mostre-me', owner:'Próximo: {{owner}}', complete:'Pronto para a próxima etapa', viewOnly:'O equipamento em voo é somente leitura. Os controles de apresentação nunca comandam a nave.',
 brief:'Resumo da missão', bus:'Segmentos conectados', requirementsView:'Requisitos da missão', equipment:'Equipamentos', orbit:'Órbita e lançamento', trajectory:'Trajetória', readiness:'Verificações de prontidão', signoffs:'Aprovações das funções', operations:'Operações de voo', results:'Resultados do voo',
 tourControl:'Tour do controle da missão', tourQuote:'Tour da escolha', quoteOffer:'Conheça os controles desta escolha', options:'Opções',
};
export const controlEnglish:Record<string,string>=Object.fromEntries(Object.entries(en).map(([key,value])=>[`control.${key}`,value]));
export const controlPortuguese:Record<string,string>=Object.fromEntries(Object.entries(pt).map(([key,value])=>[`control.${key}`,value]));

controlEnglish['hud.tour.choice']='Choice tour';controlPortuguese['hud.tour.choice']='Tour da escolha';
const pauses = {
 manual:['Paused','Pausado'], decision:['Decision pending','Decisão pendente'], explanation:['Scientific explanation open','Explicação científica aberta'], handoff:['Role handoff pending','Troca de função pendente'], settings:['Settings open','Configurações abertas'], hidden:['Page hidden','Página oculta'], chooser:['Mission setup open','Preparação da missão aberta'], graphics:['Graphics unavailable','Gráficos indisponíveis'], home:['Home open','Página inicial aberta'], 'self-paced':['Waiting for your next advance','Aguardando seu próximo avanço'], viewer:['Trajectory viewer open','Visualizador de trajetória aberto'], tour:['Tour open','Tour aberto'], error:['A panel needs recovery','Um painel precisa de recuperação'], route:['Unavailable route','Rota indisponível'], 'host-stall':['Host clock stalled','Relógio do anfitrião interrompido'], 'host-display-disconnected':['Host display disconnected','Tela do anfitrião desconectada'], 'controller-disconnected':['Controller disconnected','Controle desconectado'], learning:['A teammate is reading','Um colega está lendo'],
} satisfies Record<string,readonly [string,string]>;
for(const [key,[english,portuguese]] of Object.entries(pauses)) {controlEnglish[`control.pause.${key}`]=english;controlPortuguese[`control.pause.${key}`]=portuguese;}
controlEnglish['control.noEdge']='No sunlight, shadow or contact edge estimated';
controlPortuguese['control.noEdge']='Nenhuma transição de luz, sombra ou contato estimada';
controlEnglish['control.confirm']='Confirm choice';controlPortuguese['control.confirm']='Confirmar escolha';
