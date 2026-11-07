import { Aviso, Resposta } from "arcadium";
import { Papel } from "./_papel";

// Quando não há assunto (carregando, erro, falta de histórico), ele avisa na mesma voz
// e a caneta grifa o fim da frase. As respostas vêm logo abaixo.

// O Aviso decide pela preferência do sistema (useReducedMotion) se a caneta anima.
// O retrato parado é o estado de "movimento reduzido", que o app suporta: a prévia
// emula essa preferência antes do primeiro render para o traço aparecer inteiro.
if (typeof window !== "undefined") {
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query: string) => {
    const real = original(query);
    if (!/prefers-reduced-motion/.test(query)) return real;
    // os métodos vivem no protótipo e exigem o objeto de verdade como `this`
    return { matches: true, media: query, onchange: null,
      addEventListener: real.addEventListener.bind(real), removeEventListener: real.removeEventListener.bind(real),
      addListener: real.addListener.bind(real), removeListener: real.removeListener.bind(real),
      dispatchEvent: real.dispatchEvent.bind(real) } as MediaQueryList;
  };
}
export const Carregando = () => <Papel><Aviso headline="Peraí, tô ouvindo aqui." /></Papel>;

export const Erro = () => <Papel><Aviso headline="Me perdi no teu histórico."
  narrative="Deu erro do meu lado lendo o que você ouviu. Tenta de novo?"><Resposta>tenta de novo</Resposta></Aviso></Papel>;

export const SemHistorico = () => <Papel><Aviso window="ainda não te conheço" headline="Ainda não ouvi nada teu."
  narrative="Me passa teu Last.fm que eu leio tudo que você já ouviu e volto com o que reparei.">
  <Resposta href="/settings">conectar o Last.fm</Resposta></Aviso></Papel>;

export const Compacto = () => <Papel><Aviso compact headline="Daqui eu tiro tudo que te conto."
  narrative="De onde vem cada número, o que fica guardado aqui e pra onde as descobertas podem ir." /></Papel>;
