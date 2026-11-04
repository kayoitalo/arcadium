# A caneta é o personagem — cartaz do artista

Revisão de 03/11/2026 no PR 17. O proprietário esclareceu que a presença do amigo é a **caneta mágica**, como na Conversa: viaja, grifa, circula e reage ao conteúdo. A figura literal com rosto/fones foi retirada. A composição escolhida foi **Cartaz do artista**: foto, nome grande e a caneta conectando imagem e escutas.

O proprietário pediu em seguida manter as APIs já acordadas. **Wikidata/Commons foram removidos**, incluindo adaptador, contratos de crédito e autorização dos novos hosts no proxy. A funcionalidade usa **Spotify**, provedor já integrado. Não reintroduzir outra fonte para preencher lacunas.

## Composição e gestos

- Índice horizontal de nomes, cartaz com foto e tipografia grande, números observados ao lado. No celular, nome, foto e dados se reorganizam, com retorno ao índice.
- O mesmo `usePen`/`Trace` da Conversa mede alvos reais: grifa o nome, contorna a área da foto depois do carregamento e circula dias distintos ou reproduções recentes. Troca de artista/perspectiva refaz os alvos; não há sublinhado CSS fingindo ser a caneta.
- A caneta também grifa a pergunta de versão ao abrir um disco e circula o capítulo aberto no diário. Uma camada por página, sem rosto/mascote ou animação decorativa em loop.
- Movimento reduzido preserva marcas e controles sem viagem animada. Imagem mantém forma/proporção, sem filtros, recorte, animação ou sobreposição. Contorno da caneta fica fora da área da foto.
- Foto ausente mantém composição tipográfica. Falha temporária oferece nova tentativa; ambas permitem escolher outro nome, ler os números e seguir para o histórico.

## Escolha entre os provedores existentes

| Provedor | O que oferece / decisão |
| --- | --- |
| Spotify | Objeto próprio de artista com imagens e endpoint documentado. Melhor opção integrável para foto de perfil: reutiliza Client ID/Secret já previstos. Escolhido. |
| Last.fm | `artist.getInfo` ainda documenta imagens, mas a documentação sozinha não confirma cobertura atual ou ausência de placeholders. Não foi feita sondagem autenticada nesta rodada; não alegar indisponibilidade universal. |
| iTunes / Cover Art Archive | Os adaptadores existentes fornecem capas de lançamentos, que não devem ser apresentadas como foto de artista. |
| MusicBrainz | Identificadores/metadados e relações podem apontar a imagens externas; seguir essas relações ampliaria novamente as fontes de imagem. Não usado para a foto. |

A comparação é de contrato e integração, sem medição de cobertura entre catálogos. Fontes: [Spotify Get Artist](https://developer.spotify.com/documentation/web-api/reference/get-an-artist), [Search](https://developer.spotify.com/documentation/web-api/reference/search), [Last.fm artist.getInfo](https://www.last.fm/api/show/artist.getInfo) e [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API).

## Autorização, identidade e limites

O servidor usa **Client Credentials** com os mesmos `SPOTIFY_CLIENT_ID` e `SPOTIFY_CLIENT_SECRET` existentes. Token de aplicação somente em memória, com compartilhamento de chamadas simultâneas e renovação antes da expiração. Não usa tokens de usuário, novo escopo OAuth, conexão de conta ou perfil pessoal. Exportação de playlist mantém o OAuth anterior. Sem credenciais configuradas, foto retorna lacuna; não tenta outra API. Não foram adicionadas variáveis, dependências, migrations, contratação ou infraestrutura.

`POST /api/artist-portrait` exige autenticação/origem e um nome do histórico da conta. Uma consulta agrupada escolhe somente a faixa mais observada desse artista (desempate pelo título). O cliente não fornece URL, identificador de catálogo, faixa ou usuário. São enviados ao catálogo apenas o nome selecionado e esse título de referência, sem contagens, datas, demais escutas ou dados pessoais. Nenhuma gravação no banco.

Até **duas chamadas de catálogo por referência sem cache**:

1. Busca Spotify por artista e faixa, com loja BR e até dez resultados. Compara texto completo preservando versão/participações; nomes de tributos e títulos diferentes não correspondem. Não segue paginação nem tenta outro título para completar lacunas.
2. Exige um único ID de artista entre as correspondências observadas. Consulta esse perfil e confere novamente ID/nome; escolhe imagem adequada, preferindo pelo menos 640 px quando disponível.

Correspondência textual corroborada por faixa não é identidade global certificada ou equivalência de MBID. Homônimos encontrados são recusados; o limite de dez resultados não permite excluir homônimos fora da amostra. Ausência de match/foto é uma lacuna, não falha de rede. Nenhuma imagem é aceita somente por posição/popularidade do resultado.

A primeira consulta com token frio acrescenta **uma chamada de autorização**; token válido é reutilizado. Imagem pelo proxy é uma requisição adicional. Uma busca de foto ativa por processo, espaçamento de 1.100 ms entre chamadas de catálogo e timeout de 6 s em cada chamada; sem retry automático. Requisições iguais compartilham trabalho; outro artista enquanto ocupado recebe falha temporária.

Cache de até 64 pares artista/faixa: foto 24 h, lacuna 1 h e erro 30 s. Navegador consulta só a seleção após 300 ms, cancela requisição obsoleta e guarda até 32 resultados na montagem da página. Cancelamento não desfaz trabalho já iniciado no servidor. Sem enriquecimento em lote, polling ou busca antecipada de toda a lista.

HTTP 429 estabelece cooldown **compartilhado por fotos, playlists e OAuth no processo**, respeitando `Retry-After` em segundos ou data (mínimo 30 s, sem header válido 60 s). Não há retry de escrita de playlist. A cota Spotify depende do app; o espaçamento local não garante reserva global. Instâncias/ambientes não compartilham controle distribuído. Cotas Last.fm/Apple/MusicBrainz não foram alteradas.

Fontes: [Client Credentials](https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow) e [limites Spotify](https://developer.spotify.com/documentation/web-api/concepts/rate-limits). Aplicações em modo de desenvolvimento também estão sujeitas aos [requisitos vigentes do app](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide), incluindo Premium do proprietário. Nenhuma assinatura foi contratada ou disponibilidade da conta presumida.

## Exibição e procedência

Usa apenas o CDN já permitido `i.scdn.co`, em `/image/…`, HTTPS, sem credenciais/porta customizada ou redirects; proxy recusa MIME ausente/ativo e aceita JPEG/PNG/WebP. Hosts Wikidata/Commons continuam bloqueados. Nenhuma foto é baixada para o repositório.

Fonte visível com **logo oficial Spotify branco**, link ao perfil e nome de catálogo. O logo está em `public/brands/spotify-logo-white.svg`, copiado sem alteração do [pacote oficial de marca](https://developer.spotify.com/images/guidelines/design/2024-spotify-full-logo.zip), com regras em [Design Guidelines](https://developer.spotify.com/documentation/design). Foto/dados Spotify não entram no ranking, nos prompts ou na análise de gosto. Números e janelas continuam sendo os do histórico local.

## Verificação e revisão

538 testes em 101 arquivos e build passaram. Testes da integração cobrem propriedade/referência observada, versões/tributos/homônimos, coerência de perfil/CDN, cache/singleflight, token reutilizado/expirado, 401/403/429, falta de configuração e ausência de retries. Proxy verifica bloqueio das fontes retiradas. Banco, tokens e respostas são simulados.

Chrome headless passou três grupos de retrato/editorial/foto em 1280/1920/390 px e 390 px com movimento reduzido. Componentes/fontes reais, nomes/dados e imagem explicitamente sintéticos; logo oficial local. Verifica gestos da caneta, atribuição/link, troca de artista, foto ausente/erro, janelas e largura.

Este workspace não tem credenciais Spotify/Last.fm no ambiente do processo. Não foram lidos ou copiados segredos de outro checkout, acessado banco real, criado playlist ou feita consulta autenticada real. A sondagem anterior do Commons não valida Spotify e não representa mais a implementação.

Na preview com as credenciais Spotify existentes: abrir **teu retrato**, escolher nomes/perspectivas, conferir foto/fonte e dados conhecidos, incluindo nomes brasileiros e homônimos. Sem credenciais, match ou foto, conferir cartaz tipográfico; falha temporária oferece nova tentativa. Observar caneta, teclado, celular e movimento reduzido. Cobertura e disponibilidade reais da conta permanecem para essa revisão, sem adicionar outro provedor como fallback.
