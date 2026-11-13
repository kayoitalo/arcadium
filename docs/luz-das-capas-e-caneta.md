# Interface: mais luz nas capas, mais caneta no papel

Rodada de 12–13/11/2026. O proprietário pediu propostas para deixar o Arcadium mais agradável e chamativo sem perder a identidade, aprovou as onze e pediu para ajustar durante a validação do PR. Esta rodada não muda o ranking, os provedores, os prompts nem o esquema do banco: não há migration nem dependência nova.

As regras de [a voz do amigo](interface-voz-do-amigo.md) continuam valendo: papel escuro, uma família (Archivo), o amarelo só do traço, sem mascote, texto na voz dele. A cor nova desta rodada vem **só das capas**.

## De onde vem a cor

`src/lib/cover-tint.ts` mede a cor de uma capa no navegador: média dos pixels ponderada pela saturação, trazida para uma faixa que aparece no papel escuro sem virar neon. A capa já chega pelo proxy `/api/cover`, na mesma origem, então o canvas pode ler os pixels. Nada é gravado no banco e nenhuma consulta nova a provedor é feita; cada capa é medida uma vez por visita (`use-cover-tint.ts`).

## O que entrou

| # | Onde | O que mudou |
| --- | --- | --- |
| 01 | Conversa, Descobrir, Teu ano | `Capa` ganhou `glow`: a capa do assunto da vez acende o papel com a cor dela (sombra da própria arte e uma luz baixa). Apaga quando o assunto sai do meio da tela ou é riscado. |
| 02 | Teu retrato | Números na largura mínima da Archivo, em escala de cartaz. Risquinhos de contagem (`Risquinhos`) para os dias dos últimos 30 em que o artista apareceu; novo campo `recentDays` na mesma consulta do retrato. |
| 03 | Tudo que tocou | `MesEmCapas`: o mês corrente como calendário, cada dia com a capa do disco que mais tocou. O traço circula o dia mais cheio. Tocar num dia recorta o registro e as horas (`/api/history?day=AAAA-MM-DD`, no fuso de quem ouve). Some durante a busca por nome. |
| 04 | Todas | `Aviso waiting`: enquanto ele busca ou escreve, a caneta rascunha três linhas onde o texto vai chegar, apaga e recomeça. |
| 05 | Descobrir | `Regua`: tocando, a legenda do play vira a régua do trecho, com marcas de 5 em 5 s; clicar, arrastar ou usar as setas pula de ponto. `useSound` passou a expor `position` e `seek`. |
| 06 | Conversa, Teu ano | "virar cartão": o assunto vira uma imagem 1080×1350 desenhada num canvas (`cartao.ts`), com o grifo, as capas e o "PAM.". No celular abre a folha de compartilhar; onde ela não aceita arquivo, baixa o PNG. |
| 07 | Descobrir › Álbuns | De quatro discos em diante, a estante é de lombadas: título em pé, cor emprestada da capa, grossura pelo quanto tocou (`plays` na resposta da estante). Sem capa, lombada de papel com borda. O disco aberto sai da fileira e deita, com as versões dentro dele, como antes. |
| 08 | O que mudou | `Pista`: a posição de cada gênero mês a mês, nos últimos seis meses (`/api/genre-race`). Tudo em tinta; o traço percorre a raia do gênero citado. A lista da janela escolhida continua em "ver em números". |
| 09 | `/year` | Teu ano, em capítulos: uma tela por vez, cada capítulo com a prova medida no banco (`/api/year`). O link fica no fim da Conversa. |
| 10 | Descobrir | `Visto`: o visto dele ao guardar uma faixa pra depois. |
| 11 | Marca | `apple-icon.png`, `manifest.ts` (tela inicial e abertura do sistema), `opengraph-image.png` e o título da aba com a faixa que toca (`useTabTitle`). |

## O que as propostas pediam e já existia

Três itens da proposta 10 já estavam no código e não foram refeitos: o "nada a ver" já risca a frase e leva ao próximo assunto, as respostas já afundam com mola, e o sublinhado da barra já desliza entre as telas.

## Diferenças em relação às pranchas

- **Prévia de link sem dado pessoal.** A prancha mostrava a leitura da semana na prévia. Quem abre o link de fora não está logado, e a imagem é pública; por isso a prévia é a da casa, igual pra todo mundo. Uma leitura só vira imagem quando você pede o cartão.
- **Sem pé fixo de player.** O Descobrir já tem as respostas presas no pé e a corda em volta da capa. Em vez de mais uma barra, a régua entrou junto do play.
- **Capítulos do ano sem IA.** As frases saem dos números, na voz dele, e um capítulo sem prova não aparece. Cinco capítulos: o ano numa frase, quem chegou, a tua hora, o mês mais cheio, o disco do ano.
- **A pista troca de lugar com a lista**, em vez de ficar ao lado: as duas juntas mostrariam o mesmo dado duas vezes.
- **Ícone único.** O traço mais grosso nos tamanhos pequenos não entrou: o `icon.svg` atual já lê bem em 16 px.

## Limites

- A cor da capa depende de a imagem carregar; sem capa, nada acende e a lombada fica em papel.
- A largura condensada no cartão usa `fontStretch` do canvas. Onde o navegador não tiver, a letra sai na largura normal e a quebra de linha se ajusta.
- O calendário mostra só o mês corrente, e a pista, seis meses. O ano é o corrente, "até aqui" enquanto não fecha.
- Os PNGs de marca foram gerados a partir de `src/app/icon.svg` e da Archivo de `.design-sync/fonts`; mudou o ícone, é preciso gerar de novo.

## Verificação

- `vitest`: 639 testes em 121 arquivos, incluindo os novos (cor da capa, gestos novos da caneta, calendário e fuso, régua, diagramação do cartão, pista, capítulos do ano, título da aba). `tsc` e `next build` passam.
- Os seis runners de navegador sintéticos passam nos quatro tamanhos. O de álbuns foi atualizado para a estante de lombadas.
- As telas novas foram conferidas com componentes reais e dados fictícios em 1280 px e 390 px.
- **Não verificado:** dados reais e navegação autenticada na preview; a folha de compartilhar em aparelho de verdade; Safari. A aceitação visual continua sendo do proprietário.
