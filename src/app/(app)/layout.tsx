import { ChromaProvider } from "@/components/chroma/chroma-provider";
import { Masthead } from "@/components/layout/masthead";
import { CurrentSpine } from "@/components/layout/spine";
import { Colophon, PressGrain } from "@/components/ui/editorial";

/**
 * O casco: grão de papelão por cima de tudo, cabeçalho de ficha, lombada
 * à esquerda quando há margem e o colofão no pé, como numa contracapa.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChromaProvider>
      <div className="min-h-screen bg-background text-text-primary">
        <PressGrain />
        <Masthead />

        <div className="mx-auto w-full max-w-[1360px] px-4 sm:px-7">
          <div className="grid xl:grid-cols-[2.5rem_minmax(0,1fr)]">
            <CurrentSpine />
            <main className="min-w-0 pb-16 pt-9 xl:pl-9">{children}</main>
          </div>
        </div>

        <Colophon />
      </div>
    </ChromaProvider>
  );
}
