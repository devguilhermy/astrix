import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
const en={
 mission:'Workshop',readiness:'Details',review:'Review / issues',log:'Log',part:'Component',collapse:'Collapse panel',
 options:'Panel options',move:'Move panel',size:'Resize panel',
 instructions:'Drag to move. Arrow keys move 10 pixels; Shift and arrows move 40. Enter or Space collapses in place. Options offer click and numeric geometry. Escape cancels movement.',
 sheetInstructions:'Drag up or down to adjust sheet height. Arrow Up increases height; Arrow Down decreases it. Enter or Space collapses in place. Escape cancels resizing.',
 left:'Left',right:'Right',up:'Up',down:'Down',wider:'Wider',narrower:'Narrower',taller:'Taller',shorter:'Shorter',
 x:'Horizontal position (px)',y:'Vertical position (px)',width:'Width (px)',height:'Height (px)',apply:'Apply geometry',
 expand:'Expand panel',restoreSize:'Restore sheet size',close:'Close panel options',reset:'Reset panel layout',
 reading:'Reading layout: panels stay in document flow.',geometryNote:'Geometry fits the visible workspace. Temporary clamping never erases preferred desktop geometry.',
 compactNote:'One adjustable sheet opens at a time. Other panels remain as their own header pills.',
};
const pt:typeof en={
 mission:'Oficina',readiness:'Detalhes',review:'Revisão / problemas',log:'Registro',part:'Componente',collapse:'Recolher painel',
 options:'Opções do painel',move:'Mover painel',size:'Redimensionar painel',
 instructions:'Arraste para mover. Setas movem 10 pixels; Shift e setas movem 40. Enter ou Espaço recolhe no lugar. Opções oferecem geometria por clique e números. Escape cancela o movimento.',
 sheetInstructions:'Arraste para ajustar a altura. Seta para cima aumenta; para baixo diminui. Enter ou Espaço recolhe no lugar. Escape cancela o redimensionamento.',
 left:'Esquerda',right:'Direita',up:'Cima',down:'Baixo',wider:'Mais largo',narrower:'Mais estreito',taller:'Mais alto',shorter:'Mais baixo',
 x:'Posição horizontal (px)',y:'Posição vertical (px)',width:'Largura (px)',height:'Altura (px)',apply:'Aplicar geometria',
 expand:'Expandir painel',restoreSize:'Restaurar tamanho',close:'Fechar opções',reset:'Redefinir painéis',
 reading:'Layout de leitura: painéis ficam no fluxo do documento.',geometryNote:'A geometria cabe no espaço visível. O ajuste temporário preserva a preferência do computador.',
 compactNote:'Um painel ajustável abre por vez. Os outros mantêm seus próprios cabeçalhos recolhidos.',
};
export const windowResources={en:Object.fromEntries(Object.entries(en).map(([key,value])=>[`windows.${key}`,value])),'pt-BR':Object.fromEntries(Object.entries(pt).map(([key,value])=>[`windows.${key}`,value]))};
export function useWindowCopy():typeof en {
 const {t}=useTranslation();return useMemo(()=>Object.fromEntries(Object.keys(en).map(key=>[key,t(`windows.${key}`)])) as typeof en,[t]);
}
