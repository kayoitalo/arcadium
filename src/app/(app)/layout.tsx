import { ChromaProvider } from "@/components/chroma/chroma-provider";
import { ChromeProvider } from "@/components/layout/chrome";
import { Masthead } from "@/components/layout/masthead";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChromaProvider>
      <ChromeProvider>
        <div className="min-h-screen bg-background text-text-primary">
          <Masthead />
          <main className="mx-auto w-full max-w-[1320px] px-5 pb-28 pt-10 sm:px-8">{children}</main>
        </div>
      </ChromeProvider>
    </ChromaProvider>
  );
}
