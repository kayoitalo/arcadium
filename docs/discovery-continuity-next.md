# Próxima evolução — trabalho em revisão

Base: PR 13 mergeado. Este incremento separa mídia da criação da sessão híbrida. O frontend pede mídia apenas da indicação atual, sem autoplay, e ignora respostas de uma faixa que saiu da tela. Falha de rede oferece nova tentativa; ausência no catálogo é informada separadamente.

POST de mídia verifica conta, sessão e item antes das chamadas. A gravação deve manter artista/título/versão compatíveis. O salvamento bloqueia a sessão na mesma ordem das avaliações e preserva os demais componentes do item. Não muda cursor, ranking ou feedback. Reutilização de resultado e coalescência por processo reduzem consultas; não constituem reserva distribuída entre ambientes. Não há worker, fila externa nem migration nova.

O fluxo híbrido deixa de buscar oito prévias durante a geração. Cada item solicitado pode consultar Apple e, se faltar capa, Last.fm. Visitar todos os oito itens pode custar até oito consultas de cada fonte antes de cache, além do orçamento de geração. Falhas de áudio têm cooldown de 30 s; ausência confirmada, uma hora. Nenhum resultado é uma garantia permanente de cobertura.

## Visual e significado

O sublinhado de entrada ganha desenho progressivo, respeitando redução de movimento. Os controles atuais ainda são heurísticas de proximidade e popularidade. Exploração radical e seleção por mood não estão implementadas. A distinção musical entre as duas entradas ainda exige avaliação e refinamento; não declarar essa área concluída pela alteração de texto/animação.

## ListenBrainz: sondagem isolada

Fonte oficial: https://labs.api.listenbrainz.org/similar-recordings

O endpoint público por gravação foi confirmado no formulário oficial. Uma consulta ao MBID de exemplo da documentação retornou HTTP 200 e lista vazia. Isso confirma resposta do endpoint, não cobertura útil nem adequação ao gosto do proprietário.

`node scripts/evaluation/listenbrainz-probe.mjs <recording-mbid>` executa até três consultas explícitas, espaçadas, com timeout e interrupção em erro. Não lê banco, publica histórico ou salva payloads musicais completos. A saída contém somente contagens e métricas operacionais. A integração continua fora do motor padrão.

Ainda pendentes: amostra representativa de gravações verificadas, contrato de respostas não vazias, avaliação de candidatas exclusivas/duplicadas, relevância e condições de reutilização. Só após isso implementar o adaptador opcional e comparar contra o controle. A sondagem não conclui a etapa 5.

## Revisão necessária

Testar preview com faixa sem mídia, retorno à sessão, falha temporária, troca rápida de faixa e duas abas. Confirmar que áudio nunca inicia sozinho e que posição/avaliações não mudam quando a mídia termina. Revisão visual no navegador ainda pendente.
