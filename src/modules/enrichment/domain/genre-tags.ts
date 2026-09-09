
const NON_GENRE_TAGS = new Set([
  // função e formação
  "singer", "singer-songwriter", "songwriter", "composer", "producer", "musician",
  "vocalist", "guitarist", "drummer", "bassist", "pianist", "rapper", "dj",
  "band", "duo", "trio", "group", "solo", "artist", "quartet", "orchestra",
  // atributos de voz
  "female vocals", "male vocals", "female vocalists", "male vocalists",
  "female vocalist", "male vocalist", "female", "male", "instrumental",
  // metadados de coleção e ruído de aplicativo
  "seen live", "favorites", "favourites", "favorite", "favourite", "my favourites",
  "awesome", "love", "loved", "best", "cool", "good", "great", "amazing",
  "likedis auto", "spotify", "radio", "playlist", "albums i own", "check out",
  "under 2000 listeners", "beautiful", "sexy", "epic", "classic", "legend", "legends",
  // nacionalidade e idioma
  "usa", "us", "uk", "japan", "japanese", "american", "british", "english",
  "brazilian", "brasil", "brazil", "canadian", "australian", "german", "french",
  "spanish", "italian", "swedish", "norwegian", "finnish", "irish", "scottish",
  "korean", "chinese", "mexican", "argentine", "colombian", "puerto rico",
  "estados unidos", "reino unido", "nacional", "internacional",
  // formato
  "cover", "covers", "live", "remix", "remixes", "single", "album", "ep",
]);

const DECADE_PATTERN = /^(19|20)?\d{1,3}s$/;

const GENRE_ROOTS = [
  "rock", "pop", "metal", "punk", "rap", "hip hop", "hip-hop", "jazz", "blues",
  "soul", "funk", "disco", "house", "techno", "trance", "electro", "electronic",
  "edm", "ambient", "folk", "country", "reggae", "reggaeton", "ska", "dub",
  "samba", "pagode", "sertanejo", "forro", "forró", "mpb", "bossa", "axé", "axe",
  "salsa", "cumbia", "bachata", "merengue", "tango", "flamenco", "fado",
  "classical", "clássica", "classica", "opera", "ópera", "orchestral", "choral",
  "grunge", "emo", "indie", "hardcore", "drill", "trap", "grime", "garage",
  "industrial", "gospel", "worship", "r&b", "rnb", "latin", "latino", "afrobeat",
  "afrobeats", "k-pop", "j-pop", "new wave", "synth", "shoegaze", "psychedelic",
  "progressive", "experimental", "noise", "lo-fi", "lofi", "soundtrack", "score",
  "bolero", "swing", "bebop", "fusion", "breakbeat", "jungle", "drum and bass",
  "dancehall", "soca", "highlife", "chanson", "polka", "core", "wave", "beat",
];

function hasGenreRoot(tag: string): boolean {
  return GENRE_ROOTS.some((root) => tag === root || tag.includes(root));
}

export function looksLikeGenre(rawTag: string): boolean {
  const tag = rawTag.trim().toLowerCase();
  if (tag.length < 2 || tag.length > 40) return false;
  if (NON_GENRE_TAGS.has(tag)) return false;
  if (DECADE_PATTERN.test(tag)) return false;
  return hasGenreRoot(tag);
}

export function filterGenreTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (!looksLikeGenre(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    kept.push(normalized);
  }

  return kept;
}
