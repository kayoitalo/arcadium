import { prisma } from "@/lib/db/prisma";
import { sameRecordingText } from "@/lib/music/recording-match";
import { DiscoveryConflict } from "@/modules/recommendations/domain/feedback";
import type { ArtistPhotoResult, ArtistPortraitProvider } from "../domain/artist-portrait";
import { WikimediaPortraitAdapter } from "../infrastructure/wikimedia-portrait-adapter";
export class ArtistPortraitService {
  constructor(private provider:ArtistPortraitProvider=new WikimediaPortraitAdapter()) {}
  async load(userId:string,artistName:string):Promise<ArtistPhotoResult> {
    const event=await prisma.listeningEvent.findFirst({where:{userId,rawArtistName:artistName},orderBy:[{artistId:{sort:"asc",nulls:"last"}},{id:"asc"}],select:{artist:{select:{name:true,mbid:true,metadataStatus:true}}}});
    if(!event)throw new DiscoveryConflict("Artista não encontrado neste histórico.",404);
    if(!event.artist?.mbid||event.artist.metadataStatus!=="RESOLVED"||!sameRecordingText(artistName,event.artist.name))return {status:"MISSING",reason:"NO_ID"};
    try{return await this.provider.lookup(event.artist.mbid);}catch{throw new DiscoveryConflict("A fonte de fotos está ocupada ou indisponível. Você pode tentar novamente em instantes.",503,"PHOTO_TEMPORARY");}
  }
}
