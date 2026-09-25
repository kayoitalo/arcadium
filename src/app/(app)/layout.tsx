import { ChromaProvider } from "@/components/chroma/chroma-provider";
import { ChromeProvider } from "@/components/layout/chrome";
import { AppShell } from "@/components/layout/app-shell";

// ChromaProvider e ChromeProvider ficam só enquanto houver tela antiga que os chama
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChromaProvider>
      <ChromeProvider>
        <AppShell>{children}</AppShell>
      </ChromeProvider>
    </ChromaProvider>
  );
}
