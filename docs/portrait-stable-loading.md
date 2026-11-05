# Retrato: carregamento estável e fotos pelo Spotify

04/11/2026, PR 17. O proprietário confirmou que as credenciais Spotify estavam somente em Production, corrigiu a configuração da preview e mostrou uma foto real funcionando. Pediu corrigir o salto do nome/dados quando a imagem chegava e simplificar as fontes de fotografia.

## Comportamento

- Durante a busca dos metadados e o download da imagem, o espaço da foto já fica reservado. No desktop, nome e números começam na coluna definitiva; no celular, a área de imagem também mantém a altura.
- A foto entra com fade de 220 ms, mantendo proporção e conteúdo. Movimento reduzido desativa o fade. A caneta original contorna a imagem somente depois de carregada.
- Texto e foto têm áreas independentes: a altura da imagem ou do crédito não redistribui as linhas dos dados.
- Ausência confirmada ou falha usa a composição tipográfica compacta; falha oferece nova tentativa. Resultados em cache são reaproveitados na troca de artista.

## Fonte e limites

Spotify é a única fonte das fotos do retrato. A consulta alternativa Last.fm getInfo, seus contratos e cache específicos de fotografia foram removidos. Last.fm continua responsável pelas funções de histórico, descoberta e contexto já existentes. O proxy de retrato aceita somente o CDN Spotify; capas Last.fm mantêm seu fluxo próprio.

Preservados: artista selecionado do histórico da conta, debounce de 300 ms, sem busca em lote/polling, cache de até 32 nomes no navegador e 64 pares no servidor, uma busca de catálogo no caso comum e até duas para homônimos, token compartilhado, timeout, espaçamento e cooldown 429. Não há cota global fixa garantida pelo Spotify; a integração continua limitada e sob demanda, sem retry automático ou fornecedor adicional.

As mesmas SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET precisam estar no ambiente de deploy utilizado; não basta configurá-las somente em Production para a preview. Nenhuma credencial foi lida/copiada por esta alteração. Sem migrations, IA adicional, nova infraestrutura ou mudança no ranking.

## Validação

545 testes em 101 arquivos, tipos e build passaram. O runner de retrato passou quatro grupos em 1280/1920/390 px e 390 px com movimento reduzido. Um teste segura a resposta de metadados e atrasa os bytes da imagem separadamente; compara posição e tamanho do nome/número antes, durante e depois, com tolerância de 1,5 px. Também verifica crédito, caneta, seleção, janelas, erro e ausência compacta. Capturas desktop/mobile foram inspecionadas.

Os testes locais usam dados e imagem sintéticos. A foto Spotify real foi confirmada pelo proprietário antes desta correção visual; a nova transição ainda requer revisão na preview. Para conferir: recarregar teu retrato com rede lenta e alternar artistas; o nome e os dados devem manter a posição enquanto a foto aparece. Falha/ausência definitivas podem recolher a área reservada.
