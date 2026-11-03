import { AlbumJourneys } from "@/components/descobertas/album-journeys";
export default async function AlbumsPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const params = await searchParams;
  return <AlbumJourneys initialItem={typeof params.item === "string" && params.item.length <= 100 ? params.item : null} />;
}
