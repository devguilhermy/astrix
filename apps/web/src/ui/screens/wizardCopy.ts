const copy = {
 selected:['Selected','Selecionado'],
 teamIntro:['Solo or a shared-screen crew. Choose who operates each responsibility before starting.','Jogue só ou com uma equipe na mesma tela. Defina quem opera cada responsabilidade antes de começar.'],
 roles:['Who does what','Quem faz o quê'],
 roleHint:['Each role has one owner. Choosing another assigned role swaps owners; Add responsibility transfers it to this player.','Cada função tem um responsável. Escolher outra função troca os responsáveis; Adicionar responsabilidade a transfere para este jogador.'],
 roleFor:['Role {{slot}} for player {{player}}','Função {{slot}} do jogador {{player}}'],
 roleOwner:['{{role}} — player {{player}}','{{role}} — jogador {{player}}'],
 addRole:['Add responsibility','Adicionar responsabilidade'],
 chooseRole:['Choose a role','Escolha uma função'],
 allRoles:['All responsibilities are assigned here','Todas as responsabilidades estão atribuídas aqui'],
 noRoles:['No responsibility yet. Choose a role below.','Nenhuma responsabilidade ainda. Escolha uma função abaixo.'],
 localTitle:['Play on this screen','Jogar nesta tela'],
 localSolo:['One player, every mission role. No network setup needed.','Um jogador, todas as funções da missão. Sem configurar rede.'],
 localTeam:['{{count}} players share this screen and pass control between assigned roles. No network setup needed.','{{count}} jogadores compartilham esta tela e alternam o controle entre as funções. Sem configurar rede.'],
 localStart:['Start mission on this screen','Iniciar missão nesta tela'],
 lanHint:['Separate devices? Open the LAN option. A prepared Bun host on your trusted local network is required.','Dispositivos separados? Abra a opção de rede local. É necessário um anfitrião Bun preparado na sua rede de confiança.'],
} as const;
export const wizardEnglish=Object.fromEntries(Object.entries(copy).map(([key,value])=>[`setup.${key}`,value[0]]));
export const wizardPortuguese=Object.fromEntries(Object.entries(copy).map(([key,value])=>[`setup.${key}`,value[1]]));
