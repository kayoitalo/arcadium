/** Legacy stored URLs have no version evidence. Resolve again on play. */
export function previewPath(trackId: string): string {
  return `/api/preview/${encodeURIComponent(trackId)}`;
}
