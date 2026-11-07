# Design sync do Arcadium — notas

Projeto no Claude Design: https://claude.ai/design/p/ab72b204-ba99-4502-878d-2184e76f5077 (pinado em `config.json`).

## Como o sync roda aqui

- **Não há `dist/` nem Storybook.** O Arcadium é um app Next.js. A entrada é o barril curado `.design-sync/entry.ts`, que exporta só as primitivas do amigo (Fala, Respostas, Resposta, Capa, PenLayer, Aviso, Janela, as três Provas) e os ajudantes da caneta (`usePen`, `band`, `circle`, `strike`, `dimension`, `frame`, `highlight`, `wave`, `textLines`, `boxOf`). Para incluir um componente novo: exportar no barril e adicionar em `componentSrcMap`.
- **`process-shim.ts` tem que ser o primeiro import do barril.** O `next/link` (usado por `Resposta` com `href`) lê `process.env`; sem o shim o bundle quebra com `ReferenceError: process is not defined` e nada chega a `window.Arcadium` (`[BUNDLE_EXPORT]` 10/10).
- **Estilo:** `buildCmd` (`node .design-sync/build-styles.mjs`) gera `.design-sync/.cache/arcadium.css` a partir de `src/app/globals.css`, tirando o `@import "tailwindcss"` e o bloco `@theme`, e define `--font-archivo: "Archivo"`. Rode antes do conversor em todo sync. Se o `globals.css` mudar de formato, o script falha de propósito.
- **Fonte:** a captura roda sem rede, então o `@import` do Google Fonts não serve. A Archivo variável (largura 62–125, peso 100–900, OFL) está em `.design-sync/fonts/`, copiada de `@fontsource-variable/archivo` 5.3.0, só latin e latin-ext, ligada por `extraFonts`.
- **Diretrizes:** `guidelinesGlob` limitado a `docs/interface-voz-do-amigo.md` e `docs/magic-pen-artist-poster.md`. O padrão pegava os 28 arquivos de `docs/`, inclusive planos internos e notas de operação que não são para o agente de design.
- **Render check:** Chrome do sistema via `DS_CHROMIUM_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"`; o `playwright` instalado em `.ds-sync` com `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.
- **Windows:** parar o `http-serve.mjs` antes de rodar o build; ele segura a pasta `ds-bundle` e o `rmSync` falha com EPERM.

## Prévias (`.design-sync/previews/`)

- O cartão força `body{background:#fff}`. Toda história vai dentro de `_papel.tsx` (`Papel`), que devolve o fundo `--papel`, a tinta e a Archivo. Não é componente do sistema.
- As prévias são retratos parados: a caneta roda com `reduced` e o `Papel` zera as transições (`[data-preview-pen] *{transition:none}`). Sem isso, a captura pega a letra do grifo no meio do fade de 260 ms e a anotação da régua no meio do `clip-path` de 380 ms.
- O `Aviso` decide sozinho pela preferência do sistema (framer `useReducedMotion`). A prévia emula "movimento reduzido" com um `matchMedia` que delega os métodos ao objeto real (espalhar o `MediaQueryList` perde `addEventListener` e o framer cai em "sem preferência").
- Em gestos fora da `Fala`, o texto grifado precisa de `position: relative; z-index: 3`: o grifo é a camada "under" (z 2) e o traço por cima é a "over" (z 4).
- `Capa` passa toda imagem pelo proxy `/api/cover` do app, que não existe no Claude Design; as prévias mostram o vão com o título, que é o comportamento real fora do app.
- `ProvaTransicao`, `ProvaLista` e `ProvaDecadas` usam `cardMode: "column"` (eram mais largas que a célula da grade).

## Known render warns

Nenhum no último sync.

## Re-sync risks

- `build-styles.mjs` depende do formato de `globals.css` (a linha do Tailwind e um bloco `@theme { … }` fechado por `}` no começo de linha).
- A fonte em `.design-sync/fonts/` é uma cópia; se o app trocar de família ou de eixos, atualizar à mão.
- Os exemplos das prévias são inventados na voz do amigo (artistas reais, números fictícios), não vêm do histórico de ninguém. As props das Provas espelham `src/modules/conversation/domain/conversation.types.ts`; se o tipo `Evidence` mudar, as prévias quebram no build (`! preview build failed`).
- O shim de `process` cobre só `process.env`; se o `next/link` passar a ler outra coisa de `process`, o bundle volta a quebrar.
- As notas (grades) foram dadas em captura sintética, sem dados reais nem áudio.
