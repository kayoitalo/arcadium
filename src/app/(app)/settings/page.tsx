import { Suspense } from "react";
import { Ajustes } from "@/components/ajustes/ajustes";

/**
 * O Next exige um limite de Suspense em volta de useSearchParams — é por
 * ele que chega o resultado do callback do Spotify.
 */
export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <Ajustes />
    </Suspense>
  );
}
