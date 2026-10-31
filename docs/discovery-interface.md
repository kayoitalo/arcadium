# Descoberta — entrada pela intenção

Direção escolhida pelo proprietário: entrada pela intenção, com mapa opcional. Esta adaptação antecipa parte visual da etapa 7 no PR 13, aproveitando sessões e o motor das etapas 3–4. Não conclui as intenções e jornadas da etapa 6.

## Comportamento

- Sem sessão anterior, abrir Descoberta recupera o estado, mas não gera sugestões automaticamente. O usuário escolhe “Perto do que eu gosto” ou “Outras conexões”, presets de proximidade do motor atual.
- Uma sessão em andamento reaparece na posição guardada, sem nova geração nem reprodução automática. Trocar caminho oferece outra entrada e permite retomar a anterior enquanto não iniciar uma nova.
- Faixa, artista, capa, motivo fundamentado e prévia ficam em destaque. Curti, guardo e pula são as respostas principais. Conhecer, curiosidade, inadequação, desagrado, aspectos e revisões ficam no aprofundamento opcional.
- O mapa começa recolhido. Arrastar ou escolher um canto só altera o rascunho; “buscar por aqui” inicia uma nova sessão. Não há chamadas musicais a cada movimento.
- A exposição é observada no cabeçalho da indicação, não em toda a composição visual, para não exigir que uma tela alta caiba no viewport do celular.
- Para depois mantém a seleção existente neste navegador e sua exportação. Coleção na conta e timeline continuam pendentes.

Os dois caminhos usam afinidade e popularidade disponíveis hoje. Não prometem gênero estrito, mood, descritores acústicos ou descoberta radical de um novo gênero. A navegação geral e a home não foram reformuladas nesta entrega.

## Validação

358 testes em 66 arquivos, TypeScript e build passaram. Os contratos de apresentação verificam entradas, retomada, preservação de título/versão e prévia indisponível. Fixtures opcionais de revisão usam os componentes e CSS reais, com dados fictícios, sem banco, áudio ou APIs: `ARCADIUM_VISUAL_REVIEW=true` ao executar `discovery-visual.test.ts`, após um build.

A inspeção visual no navegador não foi concluída: a ferramenta de controle encerrou o acesso por não conseguir determinar a URL do Chrome com segurança. Validar na preview desktop e mobile, títulos longos, teclado, redução de movimento, reprodução, retorno à sessão, feedback e exportação. Ajustar o mapa não deve disparar buscas antes da confirmação.

Esta adaptação não acrescenta migration. A migration de sessões já incluída no PR continua necessária; nenhuma foi executada pelo agente.
