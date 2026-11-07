import { useState } from "react";
import { Janela } from "arcadium";
import { Papel } from "./_papel";

// A janela de tempo é uma frase dele: as outras opções são palavras que se trocam no lugar.
function Frase({ start }: { start: "mes" | "ano" }) {
  const [value, setValue] = useState<"mes" | "ano">(start);
  return <p style={{ margin: 0, fontSize: 13, color: "var(--tinta-3)" }}>
    <Janela before="comparando" after="com os 30 dias anteriores" value={value} onChange={setValue}
      options={[{ key: "mes", label: "os últimos 30 dias" }, { key: "ano", label: "o último ano" }]} />
  </p>;
}

export const UltimoMes = () => <Papel><Frase start="mes" /></Papel>;
export const UltimoAno = () => <Papel><Frase start="ano" /></Papel>;
