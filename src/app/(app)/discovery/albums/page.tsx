import { notFound } from "next/navigation";
import { AlbumJourneys } from "@/components/descobertas/album-journeys";
import { findCuratedAlbum } from "@/modules/recommendations/domain/curated-albums";

export default async function AlbumsPage({ searchParams }: { searchParams: Promise<{ item?: string; curadoria?: string | string[] }> }) {
  const params = await searchParams;
  const item = typeof params.item === "string" && params.item.length <= 100 ? params.item : null;
  const curation = typeof params.curadoria === "string" ? findCuratedAlbum(params.curadoria) : null;
  if (params.curadoria !== undefined && (!curation || item)) notFound();
  return <AlbumJourneys key={curation ? `curated:${curation.credit.id}` : item ? `item:${item}` : "library"}
    initialItem={item} initialCuration={curation?.credit.id} />;
}
