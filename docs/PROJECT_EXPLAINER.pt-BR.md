# ASTRIX11: guia do projeto para a equipe

[English version](./PROJECT_EXPLAINER.md)

Leia este documento antes de apresentar, demonstrar ou responder perguntas sobre o ASTRIX11. Ele diz o que é o projeto, como mostrá-lo, como funciona, o que vem da NASA e o que não podemos afirmar. Tudo aqui vem do código e da documentação deste repositório; os links para as fontes detalhadas estão no final.

## 1. O pitch

**Em uma frase.** O ASTRIX11 é um jogo por turnos em que você projeta uma pequena missão espacial, voa uma decisão de cada vez e vê exatamente por que ela deu certo ou falhou.

**Em trinta segundos.** Missões reais falham nas escolhas de compromisso: massa contra energia, dados contra tempo de contato, ambição contra orçamento. O ASTRIX11 permite que qualquer pessoa sinta essas escolhas. Você escolhe um objetivo no Sol, na Terra, na Lua ou em Marte, define o conjunto de equipamentos e a estratégia, e joga turnos como Observar, Transmitir e Recarregar. Um motor de física e de recursos resolve cada turno, e a cena 3D mostra o que aconteceu: a imagem que você captou, o sinal chegando à estação em solo, a bateria que você gastou. No fim, você recebe uma pontuação com suas razões e pode tentar de novo, nas mesmas condições, com uma decisão diferente.

**O desafio que respondemos.** NASA Space Apps 2026, [Space Mission Design Game](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/): criar um jogo que ensine como uma missão vai de um objetivo a uma nave, a um lançamento e uma órbita, à operação e à avaliação, para jogadores com níveis diferentes de conhecimento, sozinhos ou em equipe de até quatro pessoas.

## 2. O que o jogador faz

1. **Explora.** Um sistema solar com os tamanhos dos planetas em escala. Clique em um corpo para ler dados da NASA sobre ele, ou embarque em uma nave e voe por lá.
2. **Escolhe uma missão.** Treze missões em um quadro, agrupadas por destino.
3. **Prepara.** Três escolhas: ambição (quanto tentar), conjunto da missão (quais equipamentos) e estratégia (preservar reservas, equilibrar ou priorizar produção). O painel mostra a meta, o custo, a massa e o prazo que resultam.
4. **Verifica.** Antes de você começar, o jogo voa o projeto com uma estratégia de referência. "Pronta" significa que existe um caminho que dá certo. Não significa que toda escolha vai funcionar.
5. **Joga os turnos.** Selecione um plano e leia a prévia: tempo, energia, dados e o que vem depois. Nada acontece até você confirmar. Pensar não gasta tempo de missão.
6. **Vê a consequência.** A cena reproduz o turno. Uma observação mostra um quadro do que o instrumento viu; uma transmissão mostra ondas indo até a estação; um lançamento sobe da plataforma.
7. **Lê o relatório.** Uma pontuação de 0 a 100 com estrelas, as cinco partes que a compõem, os objetivos e uma linha do tempo com todos os turnos. Tente de novo nas mesmas condições para comparar.

Há dois níveis, Aspirante e Especialista. Os dois usam o mesmo ciclo; o Especialista tem margens mais apertadas e menos dicas. O jogo está em português do Brasil e em inglês.

## 3. O que dizer sobre o que o torna diferente

- **Todo resultado é calculado.** Um único motor (`packages/core`) decide a física, os recursos, os objetivos e a pontuação. A interface e a cena 3D apenas mostram o que o motor devolveu. Nada na tela pode fazer uma missão dar certo.
- **As consequências aparecem no espaço.** A cena 3D nunca sai da tela. Os painéis ficam sobre ela.
- **Prévia, depois confirmação.** O jogador vê o custo esperado de um plano antes de gastá-lo e depois o compara com o resultado medido.
- **Honesto sobre o que é simulado.** A imagem depois de uma observação é montada a partir de um mapa de arquivo da NASA no ponto sobrevoado pela nave, e sempre traz a legenda de quadro simulado, não de observação nova.
- **Medições reais da NASA onde elas existem.** A missão de radiação reproduz taxas de dose medidas na Estação Espacial Internacional durante a tempestade solar de maio de 2024. A missão tripulada usa os valores de referência de suporte à vida da NASA.
- **Funciona sem internet.** O jogo solo é um site estático: sem login, sem servidor, sem consulta à NASA durante o jogo.
- **Jogo em equipe em uma rede local.** Uma tela anfitriã e até três celulares. Os celulares propõem um plano; o anfitrião confirma.

## 4. Roteiro da demonstração

Cerca de três minutos. Use um navegador de computador em 1920×1080. Rode `bun run dev` antes e deixe a página aberta.

| Passo | Faça | Diga |
|---|---|---|
| 1 | Página inicial, "Entrar no simulador" | "Este é o ASTRIX11. Você começa explorando." |
| 2 | Explorar: clique em Saturno, depois no Sol | "Os tamanhos estão em escala com o Sol; as distâncias foram comprimidas para caber tudo na tela. Os dados vêm das fichas planetárias da NASA, incluídas no jogo." |
| 3 | "Embarcar na nave", arraste para pilotar, segure W para acelerar, depois "Sair da nave" | "Dá para voar pelo sistema. Essa parte é para a curiosidade e não afeta uma missão." |
| 4 | Quadro de missões: aponte as abas Sol, Terra, Lua e Marte e o seletor de nível | "Treze missões, quatro destinos, dois níveis." |
| 5 | Abra "Órbita terrestre: fotografe a Terra e envie os dados" | "A missão mais simples: tirar uma foto e trazê-la para casa." |
| 6 | Preparação: troque o conjunto uma vez, veja o resumo mudar, espere "Pronta" | "Cada escolha muda custo, massa e margens. Antes de voar, o jogo prova que existe um caminho que dá certo." |
| 7 | Selecione Observar, leia a prévia, confirme | "Eu escolho um plano, vejo quanto ele vai custar e só então confirmo." |
| 8 | Deixe a reprodução rodar; aponte o quadro e a legenda | "O motor resolveu o turno. Isto é o que a câmera viu, simulado a partir do mapa Blue Marble da NASA." |
| 9 | Selecione Transmitir, confirme | "Dado a bordo não vale nada até chegar ao solo. Veja o sinal." |
| 10 | Termine; mostre o relatório: pontuação, partes, linha do tempo | "A pontuação é explicada. Posso clicar em qualquer turno para ver o que ele mudou e tentar de novo para melhorar." |

Se tiver mais um minuto, abra **Sentinela Solar** na aba Sol (uma nave que observa o lado do Sol que a Terra não vê, como a STEREO-A da NASA) ou **Pesquisa de radiação** (a missão que reproduz as medições da ISS).

Se algo der errado: recarregue a página e escolha "Retomar missão salva" no quadro. O jogo salva depois de cada turno confirmado.

## 5. As missões

| Destino | Missões |
|---|---|
| Terra (9) | Fotografe a Terra e envie os dados; Foguete suborbital; Alcance e mantenha uma órbita segura; Satélite de imagens (First Light); Pesquisa de radiação (Storm Watch); Órbita tripulada (Crew Pathfinder); Eleve e circularize uma órbita; Saída de órbita; Escape da Terra |
| Lua (2) | Sobrevoo lunar; Orbitador lunar: lance, entre em órbita e envie mapas |
| Marte (1) | Mapeamento de Marte (Red Relay): opere um orbitador e envie dados |
| Sol (1) | Sentinela Solar: observe o lado oculto do Sol |

As curtas (de um a seis turnos) ensinam uma ideia cada: chegar à órbita, mudar de órbita, devolver dados. As longas (de oito a vinte e quatro turnos) combinam essas ideias.

## 6. Como funciona

O repositório tem cinco partes.

| Parte | O que faz |
|---|---|
| `packages/core` | O motor. Valida um projeto, calcula os orçamentos de massa, energia, custo e dados, voa a trajetória, acompanha energia, armazenamento, contato com estações em solo e eclipses, registra as evidências dos objetivos e calcula a pontuação. |
| `packages/data` | Dados e constantes da NASA salvos no repositório, cada um com sua fonte. |
| `packages/session` | Os turnos como transações: quem pode propor, quem pode confirmar, e a proteção contra um turno ser aplicado duas vezes. Funciona igual no jogo solo e em rede. |
| `apps/web` | O jogo no navegador: React nos painéis, three.js na cena. Envia as decisões à sessão e desenha o resultado. |
| `apps/host` | Um pequeno servidor opcional para jogar em equipe na rede local. |

Um turno acontece assim. O jogador seleciona um plano. O motor o executa em segundo plano e devolve uma prévia. Na confirmação, a sessão passa o plano ao motor, que avança a simulação até o próximo ponto em que uma decisão é necessária e devolve um recibo: tempo decorrido, recursos usados, progresso obtido e qualquer coisa que tenha interrompido o plano. A interface mostra o recibo, e a cena reproduz as posições registradas entre os dois pontos de decisão.

A pontuação tem cinco partes com pesos fixos: objetivos 45 %, saúde da nave 20 %, eficiência do orçamento 15 %, margens 10 % e trabalho em equipe 10 %. Uma missão que falhou ou não terminou não pode passar de 19 pontos.

Feito com TypeScript, Bun, React, three.js (via react-three-fiber) e Vite.

## 7. O que vem da NASA

| Recurso | Como usamos |
|---|---|
| Fichas planetárias e do Sol do NSSDCA | Tamanhos, gravidade e valores orbitais no motor; o painel de dados no Explorar |
| OSDR RadLab | Medições de taxa de dose na ISS em 10 e 11 de maio de 2024, reduzidas a 48 valores horários que a missão de radiação reproduz |
| CCMC DONKI | Registros da tempestade geomagnética de maio de 2024, mostrados como contexto dessa missão |
| Life Support Baseline Values and Assumptions | Oxigênio, água, comida e CO₂ por pessoa por dia na missão tripulada |
| Blue Marble, mapa lunar do LRO, mapa solar STEREO + SDO e outros mapas de missões | Texturas dos planetas e os quadros simulados de observação |
| CubeSat 101, Design and Develop Science Missions, Concept Maturity Levels, Goddard Mission Design Lab | O método de projeto de missão que o jogo segue e o vocabulário que ele ensina |
| GMAT (General Mission Analysis Tool) | Usado à parte para conferir nossos resultados orbitais; o jogo também importa e exibe trajetórias do GMAT em `/gmat` |
| Relatório Small Spacecraft Technology | Base para explicar os compromissos de controle térmico, energia, apontamento e rádio |

Tudo fica guardado no repositório. O jogo nunca consulta a NASA enquanto você joga. Fontes e licenças estão em `CREDITS.md` e no [índice da documentação](./INDEX.md#nasa-resources-what-we-use-and-how).

## 8. O que não podemos afirmar

Diga isto com clareza se perguntarem. Deixa o projeto mais confiável, não menos.

- **É uma simulação de ensino, não um software de voo.** A subida usa um modelo reduzido de empuxo e arrasto. O voo entre a Terra e a Lua usa órbitas de dois corpos emendadas. Marte usa uma transferência analítica. Não há perturbações detalhadas nem efemérides de missões reais.
- **As peças são fictícias.** Ficam em faixas realistas, mas não são produtos reais.
- **As imagens são quadros simulados** a partir de mapas de arquivo. Não são observações novas, e o jogo diz isso em cada uma.
- **Os dados de radiação são reais; o modelo de dano não é calibrado.** As medições da ISS conduzem o exercício; não são uma previsão nem um modelo de dose médica.
- **A dose de radiação da missão solar é um valor assumido**, identificado como tal.
- **A NASA não revisou nem endossou o jogo.** Usar o GMAT como referência não é uma validação pelo GMAT.
- **O jogo em equipe foi testado com clientes automáticos em um computador**, e ainda não foi ensaiado com celulares reais.
- **Não fizemos um estudo com jogadores**, então não afirme ganhos de aprendizado medidos.

## 9. Números que você pode citar

| | |
|---|---|
| Missões | 13, nos dois níveis |
| Destinos | 4: Sol, Terra, Lua, Marte |
| Corpos no Explorar | 10, com tamanhos em escala |
| Níveis | 2: Aspirante e Especialista |
| Idiomas | 2: português do Brasil e inglês |
| Jogadores | 1 a 4 (tela anfitriã mais três celulares) |
| Recursos acompanhados | 7: massa, energia, orçamento, dados, rádio, tempo, tripulação |
| Testes automáticos | Cerca de 580; confira a última execução em [VERIFICATION.md](./VERIFICATION.md) antes de citar quantos passam |
| Servidores necessários para jogar solo | Nenhum |

## 10. Perguntas que podem aparecer

**A física é real?** As leis são reais e simplificadas: a equação do foguete nas queimas, órbitas de Kepler, geometria de eclipse e de linha de visada para energia e contato, e a contabilidade de energia e dados. As simplificações estão na seção 8 e em [TECHNICAL_MODELS.md](./TECHNICAL_MODELS.md).

**Como vocês sabem que as órbitas estão certas?** Comparamos casos de referência com o GMAT da NASA, executado à parte. A comparação e seus limites estão em [research/gmat-validation.md](./research/gmat-validation.md).

**Por que turnos e não tempo real?** A operação de uma missão é feita de decisões separadas por longas esperas. Os turnos deixam o jogador pensar sem relógio e nos deixam mostrar o custo de cada decisão isoladamente.

**O que o jogador aprende?** Que uma missão é uma cadeia: o objetivo define o instrumento, o instrumento define energia e dados, estes definem a nave e a órbita, e a operação gasta o que o projeto forneceu. O relatório mostra qual elo quebrou.

**Como isso atende a níveis diferentes de conhecimento?** O Aspirante dá dicas e um plano recomendado; o Especialista os retira e aperta as margens. Nenhum dos dois exige digitar elementos orbitais.

**Como funciona o jogo em equipe?** Um computador roda o anfitrião e mostra a cena. Até três celulares entram por um QR code. Cada celular pode propor um plano; só o anfitrião confirma, então um turno nunca é aplicado duas vezes.

**Dá para trapacear ou ter sorte?** Não. O mesmo projeto e as mesmas decisões sempre dão o mesmo resultado, e a interface não consegue alterar um resultado.

**O que vocês fariam em seguida?** Mais destinos (as notas de projeto cobrem Vênus, asteroides e um telescópio espacial), uma missão com passagem próxima ao Sol (precisa de uma peça de escudo térmico) e um ensaio do jogo em equipe com celulares reais.

## 11. Onde ler mais

A documentação detalhada está em inglês.

- [README](../README.md): como rodar.
- [Índice da documentação](./INDEX.md): a visão geral do sistema e as tabelas de recursos da NASA.
- [Atendimento ao desafio](./CHALLENGE_ACCEPTANCE.md): cada objetivo do desafio e como o jogo o cumpre.
- [Missões](./MISSIONS.md) e [recursos](./RESOURCES.md): o que cada missão pede e o que é acompanhado.
- [Resumo das melhorias](./recaps/MAJOR_IMPROVEMENTS.md): a última rodada de trabalho, com o que foi e o que não foi verificado.
- [Verificação](./VERIFICATION.md): evidências de testes e de navegador.

## 12. Palavras que o jogo usa

| Palavra | Significado |
|---|---|
| Turno | Uma decisão confirmada e tudo o que o motor resolve até a próxima decisão |
| Plano | Uma ação oferecida em um turno: Lançar, Manobrar, Seguir voo, Observar, Transmitir, Recarregar, Recuperar, Capturar, Retornar, Concluir ou Encerrar |
| Prévia | A previsão do motor para um plano, mostrada antes da confirmação |
| Recibo | O resultado medido de um turno confirmado |
| Conjunto da missão | Os equipamentos instalados para uma missão |
| Pronta | O jogo encontrou um caminho que dá certo para este projeto, usando uma estratégia de referência |
| Contato | Um período em que a nave enxerga uma estação em solo e pode enviar dados |
| Margem | Quanto sobra de um recurso além do que o plano precisa |
| Quadro simulado | Uma imagem montada a partir de um mapa de arquivo da NASA na posição da nave; não é uma observação nova |
