# Álbuns em ordem e contexto com fonte — PR 17

Em 02/11/2026, o proprietário autorizou estes dois blocos no mesmo PR. Complementam as etapas 6, 7 e 9; curadoria e avaliação musical permanecem checkpoints separados.

A apresentação foi refinada depois do retorno do proprietário: [caderno de escuta e quatro áreas](interface-caderno.md). Resultados agora aparecem junto do álbum, com foco/rolagem, carregamento e explicação de versão.

## Jornada de álbum

`/discovery/albums` abre até vinte álbuns registrados nas reproduções da conta, com busca local por artista/álbum para encontrar outros. Uma indicação com álbum identificado também oferece entrada direta. A API recebe ID da biblioteca/indicação e verifica propriedade antes dos provedores; nomes arbitrários enviados pelo cliente não iniciam consultas.

**Ouvir este álbum** consulta a Apple. Artista/título devem corresponder, normalizando caixa, espaços e pontuação, preservando acentos e qualificadores de versão. Até cinco edições entre dez resultados; nenhuma escolhida automaticamente. Nome, artista, loja, quantidade, data informada, classificação de conteúdo disponível e link identificam a escolha. A data não é apresentada como lançamento original.

**Começar com esta versão** verifica a escolha nos resultados e faz lookup pelo collectionId. Exige lista completa da mesma coleção, músicas com IDs únicos e numeração contígua por disco. Limites: oitenta faixas e oito discos. Recusa lacunas, vídeos e mudanças de versão, loja, classificação ou contagem; não trunca nem completa pelo nome. Colaborações, títulos divergentes e lacunas podem impedir correspondência.

A sessão `album-v1` mantém a ordem, inclusive faixas conhecidas/avaliadas: o pedido explícito é percorrer a edição, sem score de afinidade ou rótulo de novidade. Cada item guarda collectionId, trackId, disco/faixa, loja, fonte/data e a prévia do próprio lookup. Isso identifica o catálogo Apple, sem afirmar um MusicBrainz recording ID verificado.

Reutiliza exposição, posição, respostas, coleção, revisão, exportação e retomada. Escolher outra faixa não avalia; feedback não muda a ordem. Mapa e “buscar mais” não aparecem no álbum. Aprofundar uma faixa abre descoberta comum com referência e volta ao álbum. Sem autoplay, reprodução integral ou presunção de escuta completa.

Faltando mídia na edição, retorna ausência: sem pesquisa Apple substituta nem capa de outra fonte. Reabrir usa o snapshot sem nova consulta da ordem. Sessão é reservada antes da rede com chave/fingerprint por conta; replay ativo não consulta o provedor. Geração recente impede iniciar outro álbum; tentativa encerrada não volta a ACTIVE. Repetir reserva abandonada há cinco minutos a encerra.

## Contexto sob demanda

**Um pouco de contexto, com fonte** começa recolhido. Abrir consulta álbum identificado ou música; trocar assunto é explícito. Uma chamada `album.getInfo`/`track.getInfo` Last.fm, autocorreção desligada, sem fallback para artista/outra versão. Artista/título precisam corresponder. Texto/link ausentes ficam como lacuna; erro temporário permite retry e não é armazenado como falta de cobertura.

Trecho curto da wiki, limpo de HTML e renderizado como texto, com atribuição, URL HTTPS Last.fm e data da consulta. Português é solicitado, sem garantir o idioma devolvido. Sem reescrita por IA, opinião atribuída ao ouvinte ou uso como afinidade. Rastreabilidade permite conferir a fonte, sem verificar independentemente cada afirmação da wiki.

Contexto do álbum não certifica a edição; contexto da música pelo nome não confirma a gravação da prévia. O texto explica esse escopo e o contrato guarda `recordingVerified: false`. Não inventa pistas de vocal, arranjo, humor ou popularidade.

Snapshot salvo no item sob bloqueio da sessão, preservando componentes atuais. Diário relê o já consultado sem chamada externa. Downloads completos/por recorte incluem proveniência validada, sem diagnósticos de ranking ou payload bruto. Apagar toda a descoberta remove os snapshots com os itens; apagar só respostas preserva fontes. Exclusão reconsulta gerações recentes após bloquear a conta, cobrindo reservas criadas entre consulta inicial e bloqueio.

## Limites

- Apple: mesma fila de 3.100 ms entre inícios, cerca de dezenove consultas/minuto **por processo**. Sem garantia distribuída ou worker novo. Ouvir este álbum: uma pesquisa; iniciar: até duas consultas lógicas (validação + lookup), sem retry, capa extra ou busca por faixa. Instâncias frias diferentes podem somar três chamadas nas duas ações; cache na mesma instância evita repetir a pesquisa.
- Cache Apple: até 64 respostas por loja/parâmetros, seis horas com resultados e quinze minutos para vazios; chamadas iguais em andamento compartilhadas. Timeout de rede existente: oito segundos após a fila. Erro não vira vazio em cache.
- Last.fm: uma consulta por assunto solicitado, seis segundos, sem retry automático. Cem assuntos em cache, 24 horas com texto, quinze minutos com lacuna e trinta segundos de espera após falha; consultas iguais compartilham a chamada. Snapshots privados seguem os prazos de texto/lacuna.
- Autenticação/propriedade e origem nas mutações; sem cache HTTP privado. PostgreSQL e provedores/chaves existentes. Este bloco não acrescenta migration, dependência, IA, infraestrutura, upload em lote de histórico ou ListenBrainz. O PR inteiro mantém as três migrations aditivas anteriores.

## Validação e revisão

Testes com banco/provedores simulados cobrem versões, ordem, lista incompleta, propriedade, reserva/replay/falha, ausência de mídia substituta, proveniência/cache, erro/lacuna e persistência. Não medem contenção PostgreSQL real, disponibilidade de catálogo ou qualidade cultural.

`node scripts/evaluation/discovery-motion.browser.mjs --albums`: quatro grupos com componentes/CSS/fontes reais, respostas/áudio fictícios. Biblioteca sem consulta externa, edição explícita, falha/retry, clique duplicado, chave repetida, navegação/retomada, play manual e contexto com fonte/escopo. Desktop, 390 px e movimento reduzido; capturas da escolha e escuta na pasta local ignorada. Variantes anteriores de escuta/memória/retrato seguem válidas.

Na preview isolada:

1. No menu **Descobrir**, abrir a aba **Álbuns**, buscar um disco conhecido, conferir edição no link Apple, ao vivo/deluxe/letras editadas quando houver. Edições de mesmo nome não são presumidas equivalentes.
2. Conferir ordem, discos, mídia ausente e links. Navegar, responder, recarregar/retomar em outro dispositivo: posição e respostas persistem, sem alterar a ordem.
3. Aprofundar uma faixa e voltar ao álbum, mantendo posição original. Play exige ação; navegar/ler não cria escuta ou preferência.
4. Conferir contexto/fonte/data/escopo, lacunas e falha de rede. Reler pelo diário e verificar proveniência nos downloads.
5. Teclado, títulos longos, mobile, movimento reduzido, duas abas e sessão expirada. Concorrência somente na cópia isolada; mocks não certificam banco real.

Contratos: [Apple Search API](https://performance-partners.apple.com/search-api), [lookup por ID](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/LookupExamples.html), [Last.fm album.getInfo](https://www.last.fm/api/show/album.getInfo), [track.getInfo](https://www.last.fm/api/show/track.getInfo).

Restam curadoria aprovada, restrições estritas com cobertura comprovada, pistas sustentadas por gravação, comparação qualitativa de modelos e avaliação longitudinal/desempenho/concorrência reais. ListenBrainz segue adiado fora do ranking. A entrega não substitui aceitação manual.
