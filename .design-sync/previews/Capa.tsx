import { Capa } from "arcadium";
import { Papel } from "./_papel";

// No app toda capa passa pelo proxy /api/cover; fora dele a imagem não carrega e a
// capa mostra o vão honesto com o título do disco — o estado que estas prévias mostram.
export const SemImagem = () => <Papel><div style={{ paddingBottom: 32,  width: 240 }}>
  <Capa cover={{ url: null, title: "Clube da Esquina", artist: "Milton Nascimento & Lô Borges" }} />
</div></Papel>;

export const LadoALado = () => <Papel><div style={{ paddingBottom: 32,  display: "flex", gap: 24 }}>
  {[["Cartola", "Cartola"], ["Chaos A.D.", "Sepultura"], ["Inolvidables", "Lucho Gatica"]].map(([title, artist]) =>
    <div key={title} style={{ width: 160 }}><Capa cover={{ url: null, title, artist }} /></div>)}
</div></Papel>;

export const Miniatura = () => <Papel><div style={{ paddingBottom: 32,  display: "flex", gap: 12, alignItems: "center" }}>
  <div style={{ width: 56 }}><Capa label={false} cover={{ url: null, title: "Cartola", artist: "Cartola" }} /></div>
  <span style={{ fontSize: 14 }}>Cartola · <span style={{ color: "var(--tinta-3)" }}>1976</span></span>
</div></Papel>;
