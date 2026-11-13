import { markPieces } from "@/components/amigo/measure";
import { knownTint } from "@/components/amigo/use-cover-tint";
import { fitHeadline, layoutMarked, layoutPlain, type CardLine } from "@/lib/card-layout";
import { coverProxyUrl } from "@/lib/cover";
import { readTint, type Tint } from "@/lib/cover-tint";
import type { ConversationCover, ConversationMoment } from "@/modules/conversation/domain/conversation.types";

/*
 * O cartão da leitura: um assunto da conversa como imagem 4:5, pra mandar
 * pra alguém. Mesmo papel, mesma letra, o grifo no mesmo trecho e as capas
 * da prova. É desenhado no navegador, num canvas: nada sai daqui pra
 * servidor nenhum, e só vira arquivo quando você pede.
 */

export const CARD = { width: 1080, height: 1350 } as const;

const INK = { papel: "#0b0b0a", tinta: "#f2efe7", tinta2: "#b4afa5", tinta3: "#928c82", fio2: "#3b3935", marca: "#f3d31b" };
const MARGIN = 96;

type Stretch = "extra-condensed" | "condensed" | "semi-condensed" | "normal" | "expanded";
type Context = CanvasRenderingContext2D & { fontStretch?: string; letterSpacing?: string };

function setFont(context: Context, family: string, size: number, weight: number, stretch: Stretch, tracking = 0) {
  // a largura variável da Archivo: onde o canvas ainda não sabe estreitar, a letra sai na largura normal e a quebra de linha se ajusta sozinha
  context.font = `${weight} ${size}px ${family}`;
  if ("fontStretch" in context) context.fontStretch = stretch;
  if ("letterSpacing" in context) context.letterSpacing = `${(size * tracking).toFixed(2)}px`;
}

function loadImage(source: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

/** As capas que a prova do assunto mostra: as duas do salto, ou a do ranking. */
export function cardCovers(moment: ConversationMoment): ConversationCover[] {
  const { evidence } = moment;
  if (evidence.kind === "transition") return [evidence.from.cover, evidence.to.cover];
  if (evidence.kind === "ranking") return [evidence.cover];
  return [];
}

function drawCover(context: Context, image: HTMLImageElement | null, cover: ConversationCover, x: number, y: number, side: number, tint: Tint | null, family: string) {
  if (tint) {
    context.save();
    context.shadowColor = `rgb(${tint} / 0.6)`;
    context.shadowBlur = 90;
    context.shadowOffsetY = 36;
    context.fillStyle = INK.papel;
    context.fillRect(x + 20, y + 20, side - 40, side - 40);
    context.restore();
  }
  if (image) {
    // recorte central: capa que não é quadrada não estica
    const crop = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(image, (image.naturalWidth - crop) / 2, (image.naturalHeight - crop) / 2, crop, crop, x, y, side, side);
  } else {
    // sem imagem, o mesmo vão honesto da tela: o título no lugar da capa
    context.fillStyle = "#1a1917";
    context.fillRect(x, y, side, side);
    setFont(context, family, 24, 500, "normal");
    context.fillStyle = INK.tinta3;
    context.textAlign = "center";
    layoutPlain(cover.title, side - 40, (text) => context.measureText(text).width, 3)
      .forEach((line, index) => context.fillText(line, x + side / 2, y + side / 2 + index * 32));
    context.textAlign = "left";
  }
}

function drawHeadline(context: Context, lines: CardLine[], size: number, x: number, top: number): number {
  const leading = size * 1.02;
  // as maiúsculas da Archivo: é nelas que a faixa do grifo se apoia, como na tela
  const cap = context.measureText("H").actualBoundingBoxAscent || size * 0.7;
  lines.forEach((line, index) => {
    const baseline = top + cap + index * leading;
    let cursor = x;
    for (const segment of line) {
      const width = context.measureText(segment.text).width;
      if (segment.marked) {
        context.fillStyle = INK.marca;
        context.fillRect(cursor - size * 0.08, baseline - cap - size * 0.07, width + size * 0.16, cap + size * 0.13);
      }
      context.fillStyle = segment.marked ? INK.papel : INK.tinta;
      context.fillText(segment.text, cursor, baseline);
      cursor += width;
    }
  });
  return top + cap + (lines.length - 1) * leading;
}

/** Desenha o cartão de um assunto e devolve o canvas pronto. */
export async function drawCard(moment: ConversationMoment, family: string): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD.width;
  canvas.height = CARD.height;
  const context = canvas.getContext("2d") as Context | null;
  if (!context) throw new Error("canvas indisponível");
  const measure = (text: string) => context.measureText(text).width;
  const inner = CARD.width - MARGIN * 2;

  const covers = cardCovers(moment);
  const images = await Promise.all(covers.map((cover) => {
    const source = coverProxyUrl(cover.url);
    return source ? loadImage(source) : Promise.resolve(null);
  }));
  const tints = covers.map((cover, index) => knownTint(cover.url) ?? (images[index] ? readTint(images[index]!) : null));

  context.fillStyle = INK.papel;
  context.fillRect(0, 0, CARD.width, CARD.height);
  context.textBaseline = "alphabetic";

  // a luz da capa no papel, a mesma da tela: baixa, do lado da prova
  const light = tints.find((tint): tint is Tint => Boolean(tint));
  if (light) {
    const halo = context.createRadialGradient(CARD.width * 0.72, CARD.height * 0.7, 0, CARD.width * 0.72, CARD.height * 0.7, 640);
    halo.addColorStop(0, `rgb(${light} / 0.3)`);
    halo.addColorStop(0.5, `rgb(${light} / 0.09)`);
    halo.addColorStop(1, `rgb(${light} / 0)`);
    context.fillStyle = halo;
    context.fillRect(0, 0, CARD.width, CARD.height);
  }

  setFont(context, family, 34, 820, "expanded", -0.03);
  context.fillStyle = INK.tinta;
  context.fillText("arcadium", MARGIN, 128);
  setFont(context, family, 26, 520, "normal");
  context.fillStyle = INK.tinta3;
  context.textAlign = "right";
  context.fillText(moment.window, CARD.width - MARGIN, 128);
  context.textAlign = "left";

  const footTop = CARD.height - 150;
  const coverSide = covers.length === 0 ? 0 : 280;
  const proofTop = footTop - 64 - coverSide - (covers.length ? 54 : 0);

  const marks = moment.evidence.kind === "transition"
    ? [moment.evidence.to.track, moment.evidence.from.track, moment.evidence.to.artist, moment.evidence.from.artist]
    : moment.evidence.kind === "ranking"
      ? [moment.evidence.rows[moment.evidence.focusIndex]?.label, moment.evidence.rows[moment.evidence.focusIndex]?.sub].filter((value): value is string => Boolean(value))
      : undefined;
  const pieces = markPieces(moment.headline, marks);
  const headline = fitHeadline([124, 112, 100, 88, 76, 66], covers.length ? 4 : 6, (size) => {
    setFont(context, family, size, 820, "condensed", -0.03);
    return layoutMarked(pieces, inner - size * 0.1, measure);
  });
  setFont(context, family, headline.size, 820, "condensed", -0.03);
  const headlineEnd = drawHeadline(context, headline.lines, headline.size, MARGIN, 236);

  setFont(context, family, 34, 420, "normal", -0.01);
  context.fillStyle = INK.tinta2;
  const room = Math.max(0, Math.floor((proofTop - headlineEnd - 110) / 48));
  layoutPlain(moment.narrative, inner * 0.86, measure, Math.min(4, room))
    .forEach((line, index) => context.fillText(line, MARGIN, headlineEnd + 86 + index * 48));

  if (covers.length === 2 && moment.evidence.kind === "transition") {
    const [left, right] = [MARGIN, CARD.width - MARGIN - coverSide];
    drawCover(context, images[0], covers[0], left, proofTop, coverSide, tints[0], family);
    drawCover(context, images[1], covers[1], right, proofTop, coverSide, tints[1], family);
    // a cota dele entre as duas capas, e o grito no meio
    const [a, b, y] = [left + coverSide + 28, right - 28, proofTop + coverSide * 0.56];
    context.strokeStyle = INK.marca;
    context.lineWidth = 4;
    context.lineCap = "square";
    context.beginPath();
    context.moveTo(a, y - 22); context.lineTo(a, y + 22);
    context.moveTo(b, y - 22); context.lineTo(b, y + 22);
    context.moveTo(a, y); context.lineTo(b, y);
    context.stroke();
    setFont(context, family, 64, 860, "condensed", -0.01);
    context.fillStyle = INK.marca;
    context.textAlign = "center";
    context.fillText("PAM.", (a + b) / 2, y - 34);
    setFont(context, family, 22, 500, "normal");
    context.fillText(moment.evidence.gapMinutes < 1 ? "logo em seguida" : `${moment.evidence.gapMinutes} min depois`, (a + b) / 2, y + 44);
    context.textAlign = "left";
    [moment.evidence.from, moment.evidence.to].forEach((side, index) => {
      const x = index === 0 ? left : right;
      setFont(context, family, 22, 500, "normal");
      context.fillStyle = INK.tinta3;
      context.fillText(layoutPlain(`${side.artist} · ${side.when.split(" · ")[0]}`, coverSide, measure, 1)[0] ?? "", x, proofTop + coverSide + 38);
    });
  } else if (covers.length === 1) {
    drawCover(context, images[0], covers[0], MARGIN, proofTop, coverSide, tints[0], family);
    const x = MARGIN + coverSide + 40;
    setFont(context, family, 40, 700, "semi-condensed", -0.01);
    context.fillStyle = INK.tinta;
    layoutPlain(covers[0].title, inner - coverSide - 40, measure, 2).forEach((line, index) => context.fillText(line, x, proofTop + coverSide - 78 + index * 46 - 46));
    setFont(context, family, 24, 500, "normal");
    context.fillStyle = INK.tinta3;
    context.fillText(layoutPlain(covers[0].artist, inner - coverSide - 40, measure, 1)[0] ?? "", x, proofTop + coverSide - 12);
  }

  context.fillStyle = INK.fio2;
  context.fillRect(MARGIN, footTop, inner, 1);
  setFont(context, family, 22, 500, "normal");
  context.fillStyle = INK.tinta3;
  context.fillText("um amigo obcecado por música lendo o teu histórico", MARGIN, footTop + 52);
  return canvas;
}

/** O cartão como arquivo PNG. */
export async function renderCard(moment: ConversationMoment, family: string): Promise<File> {
  const canvas = await drawCard(moment, family);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("não consegui montar a imagem");
  return new File([blob], "arcadium-leitura.png", { type: "image/png" });
}

/**
 * Entrega o cartão: no celular, a folha de compartilhar do sistema; onde
 * ela não aceita arquivo, a imagem é baixada. Cancelar a folha não é erro.
 */
export async function deliverCard(file: File): Promise<"shared" | "saved" | "cancelled"> {
  if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "saved";
}
