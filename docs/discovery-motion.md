# Fluidez da escuta e dos caminhos

Incluído no PR de intenções/jornadas em 01/11/2026, após autorização do proprietário para reunir mais etapas e assuntos no mesmo PR. Usa `framer-motion`, já instalado. Sem nova dependência, migration, provedor ou infraestrutura neste acabamento.

## Comportamento

- A troca de indicação usa `AnimatePresence mode="wait"`: saída e entrada de 120 ms cada, com fade e deslocamento de apenas 6 px, sem spring, bounce ou movimento contínuo. O cursor só muda após confirmação do servidor; erro mantém a indicação e permite repetir a resposta.
- Enquanto sai ou entra, a composição fica `inert` e fora da árvore acessível. Cliques também são bloqueados na captura, inclusive durante a saída. Atalhos não avaliam nem reproduzem a próxima faixa antes da entrada terminar.
- A visita à indicação é identificada separadamente da faixa: retomar o mesmo item precisa aguardar o novo DOM. Conclusões atrasadas de outra visita não liberam a atual. Foco, resolução de mídia, observação de exposição e medição da caneta só começam após a entrada. Exposição ainda exige visibilidade real e aba visível.
- A caneta mede a nova posição antes de aparecer; não reutiliza o traço da visita anterior. Play/pausa atualizam a corda sem desmontar a camada de desenho. Não há autoplay.
- O título recebe foco depois da entrada. Quando está fora da região superior da tela, a página o traz de volta, inclusive ao retomar um caminho pelo histórico. `scroll-margin-top` preserva espaço para o cabeçalho.
- Mapa, caminhos anteriores e Para depois expandem/recolhem altura e opacidade em 180 ms. `details/summary` continuam nativos, com Enter/Espaço, relação de controles e estado acessível explícitos. O corpo que fecha fica imediatamente inacessível; se tinha foco, ele volta ao summary. Conteúdo é desmontado só após o fechamento. Reabrir no meio não permite que uma conclusão antiga feche o painel.
- Na escuta, curti · guardo · pula ficam presos no pé da tela, como as respostas da Conversa. “mais…” (outras respostas e motivos) e “sobre essa faixa” (contexto, o que reparar e o disco, em abas) abrem uma gaveta por vez ali mesmo, em 160 ms (sem animação com movimento reduzido); Esc fecha e devolve o foco a quem abriu. Tudo que muda o caminho (voltar à semana ou ao passo anterior, buscar a partir desta, buscar mais, ajustar distância e público, escolher outro caminho, rever a anterior) fica num menu único, “mudar o rumo”.
- Caminhos anteriores mostra “você está aqui” e a posição atual da sessão carregada, sem nova consulta a cada voto. A primeira apresentação dos grupos usa apenas fade, com atraso limitado a 75 ms; reaberturas não repetem a cascata. Uma falha ao atualizar conserva a lista anterior, bloqueia sua retomada até atualizar e oferece retry.
- `prefers-reduced-motion` elimina deslocamento, espera das transições, expansão animada e cascata. Também remove movimento das setas e entrada do diálogo de exportação. A caneta conserva o tratamento acessível existente.

Transição de capa entre Conversa e Descoberta (`layoutId`) fica para quando existir essa jornada e uma identidade de álbum compartilhada. Não foi criada uma ligação artificial entre capas diferentes. A timeline completa continua pendente; este incremento trata a lista de caminhos já existente.

## Verificação reproduzível

`node scripts/evaluation/discovery-motion.browser.mjs` inicia Vite instalado com Vitest e Chrome headless com perfil temporário. `CHROME_BIN` pode indicar o executável. Usa os componentes reais com respostas fictícias, sem `.env` do app, credenciais, banco, provedores ou áudio real. Artefatos ficam em `.local/evaluation/discovery-motion/`, ignorada pelo Git. Nenhum servidor de teste é publicado.

Os cenários rodam em desktop de 1280 px, mobile de 390 px e mobile com movimento reduzido: entrada sem exposição/mídia/áudio; reprodução explícita simulada; falha de feedback sem avanço; ações rápidas durante gravação e saída; montagem/foco/exposição da faixa correta; ausência de caneta antiga; foco e fechamento/reabertura dos painéis; histórico com posição atual, erro/retry e retomada do mesmo item; navegação para anterior/entrada e retorno; caneta preservada em play/pausa; ausência de overflow. Enter abre o mapa e Espaço o fecha por eventos nativos do navegador.

Testes estáticos também conferem summary, relação acessível com o corpo, ausência de formulário recolhido e posição corrente/legado sem conclusão inventada. Essas verificações não substituem escuta real, qualidade musical, banco isolado ou fluxo autenticado na Vercel.

## Revisão na preview

1. Dar play e responder curti/guardo/pula: som para, a troca é curta, a nova faixa não toca sozinha e a caneta começa na nova posição. Repetir rapidamente não avança duas vezes.
2. Simular falha de rede ao responder: mesma faixa, mensagem e possibilidade de tentar novamente. A animação não deve fingir avanço.
3. Abrir/fechar os quatro painéis com mouse e teclado, inclusive reabrindo antes de terminar. Controles fechados não entram na ordem de Tab; textos/aspectos continuam corretos na faixa atual.
4. Retomar caminhos pela parte inferior da página, inclusive o mesmo item; conferir foco/título visível, posição atual, indicação de fim e continuidade após recarregar.
5. Conferir desktop/mobile, títulos longos, prévia ausente e preferência de movimento reduzido. A sensação deve continuar sóbria e a caneta ser o movimento contínuo da escuta.
