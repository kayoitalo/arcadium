# Interface: de volta à voz do amigo

Revisão de 07/11/2026, feita depois de avaliar a produção com dados reais em desktop (1440 px) e celular (375 px). Os PRs 13 a 20 acrescentaram recursos que funcionam, mas a interface acumulou camadas, ressalvas técnicas na tela e usos decorativos do amarelo. Esta rodada não muda o motor, o ranking, as migrations nem os provedores.

## Regras que esta revisão aplica

- **A leitura abre a Conversa.** O convite para retomar a descoberta saiu do topo e aparece no fim do fio, depois de "Por hoje é isso". O índice de assuntos ficou discreto e alinhado à direita.
- **Um cabeçalho por tela.** Título com o grifo da caneta e uma fala curta. Sem rótulo em caixa alta antes do título, sem quadro lateral repetindo a fala e sem links que repetem a barra ou as abas.
- **Texto é o amigo, nunca a especificação.** Limites de cobertura, escopo de fonte e ressalvas de dados ficam nos docs. Na tela, viram uma linha curta na voz dele, ou silêncio. Exemplos: "Achei só 2 de 8 que cabem no pedido. Preferi não completar com outra coisa." e "Parte da busca não respondeu a tempo. Pode ter mais coisa por lá."
- **O amarelo é da caneta.** Grifo, traço, corda e as anotações escritas por ela. Abas, bordas de cards, setas e marcadores voltaram para a tinta. A jornada semanal usava tokens inexistentes (`--color-ink-muted`, `--color-accent`) e caía num segundo amarelo; agora usa os tokens da casa.

## Descobrir

Quatro caminhos na mesma linha: perto do que eu gosto, outras conexões, outro universo e do meu repertório. Quem tem uma busca guardada vê primeiro "continuar de onde parei". "Outro universo" abre os destinos logo abaixo, e só então consulta o catálogo. Um único "ajustar o caminho" reúne o mapa de distância e público e o recorte do repertório por gênero do disco e duração.

Os destinos agora juntam variações de grafia ("afro-fusion" e "afro fusion" viram uma porta só, com a grafia que a busca encontra) e vêm ordenados pelos que o catálogo mais sustenta, a partir de até mil artistas. Antes, a amostra parava em duzentos nomes em ordem alfabética. As propostas de curadoria ainda em revisão saíram da interface e continuam em [curation-proposals.md](curation-proposals.md).

## Álbuns

A estante mostra primeiro os discos que a conta mais ouviu e usa a capa já enriquecida quando existe. Sem capa, fica a etiqueta tipográfica, sem o rótulo "registro/disco 01" repetido.

## Enriquecimento automático

`POST /api/enrichment` passou a aceitar o agendador. O job de hora em hora avança três lotes pequenos depois do sync: artistas (5), capas (10) e catálogo Apple (8). Com isso, capas e gêneros param de depender de cliques em ajustes. Uma falha aqui não bloqueia a renovação dos textos. O ritmo respeita o limite de uma consulta por segundo do MusicBrainz e o espaçamento do catálogo Apple.

## Verificação

Os testes de componente e serviço passam, incluindo os novos casos de portas e da estante. Os seis runners de navegador sintéticos foram atualizados para o texto novo. A aceitação visual com dados reais continua sendo do proprietário, na preview.
