import { ChromaProvider } from "@/components/chroma/chroma-provider";
import { TopNav } from "@/components/layout/top-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChromaProvider>
      <div className="min-h-screen bg-background text-text-primary">
        <TopNav />
        <main className="mx-auto w-full max-w-[1320px] px-5 pb-24 pt-8 sm:px-8">{children}</main>
      </div>
    </ChromaProvider>
  );
}
