"use client";

import { CheckCircle2, CircleDashed, Database, ImageIcon, Link2 } from "lucide-react";
import type { DataQuality } from "@/modules/statistics/application/overview-service";

function QualityRow({ icon: Icon, label, value, detail }: { icon: typeof Database; label: string; value: number; detail: string }) {
  return <div className="space-y-2" title={detail}>
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="flex items-center gap-2 text-text-secondary"><Icon className="h-3.5 w-3.5 text-accent-gold" />{label}</span>
      <strong className="font-mono text-text-primary">{value}%</strong>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-background">
      <div className="h-full rounded-full bg-gradient-to-r from-accent-copper to-accent-gold transition-[width] duration-700" style={{ width: `${value}%` }} />
    </div>
  </div>;
}

export function DataQualityPanel({ quality }: { quality: DataQuality }) {
  const complete = quality.linkedEventsPercentage === 100 && quality.artistMetadataPercentage === 100 && quality.albumCoverPercentage === 100;
  return <div className="rounded-2xl border border-border/60 bg-surface/40 p-5">
    <div className="mb-5 flex items-start justify-between gap-4">
      <div><span className="eyebrow">CONFIANÇA DOS DADOS</span><p className="mt-1 text-xs text-text-secondary">Cobertura atual do banco canônico</p></div>
      {complete ? <CheckCircle2 className="h-5 w-5 text-status-success" /> : <CircleDashed className="h-5 w-5 text-accent-gold" />}
    </div>
    <div className="grid gap-4 sm:grid-cols-3">
      <QualityRow icon={Link2} label="Eventos vinculados" value={quality.linkedEventsPercentage} detail={`${quality.linkedEvents} eventos associados a artistas canônicos.`} />
      <QualityRow icon={Database} label="Artistas enriquecidos" value={quality.artistMetadataPercentage} detail={`${quality.enrichedArtists} de ${quality.totalArtists} artistas têm metadados resolvidos.`} />
      <QualityRow icon={ImageIcon} label="Capas disponíveis" value={quality.albumCoverPercentage} detail={`${quality.coveredAlbums} de ${quality.totalAlbums} álbuns têm capa armazenada.`} />
    </div>
  </div>;
}

