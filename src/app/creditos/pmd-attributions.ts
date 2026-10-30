export interface PmdCreditData {
  snapshot: string; repository: string; licenseUrl: string;
  artists: { id: string; name: string }[];
  resources: { id: string; contributions: { artistId: string }[] }[];
}
export interface PmdCreditManifest {
  snapshot: string;
  pokemon: {
    entityId: string; name: string; form: string;
    variants: Record<string, { animations: Partial<Record<string, { creditId: string; shadow?: { creditId: string } }>> } | null>;
  }[];
}

/** Join the generated resource credits, not a handwritten list or an assumed base-form author. */
export function pmdAttributions(credits: PmdCreditData, manifest: PmdCreditManifest) {
  const artists = [...credits.artists].sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id));
  const byArtist = new Map(artists.map(artist => [artist.id, artist]));
  const byResource = new Map(credits.resources.map(resource => [resource.id, resource]));
  const forms = manifest.pokemon.filter(pokemon => pokemon.form !== 'base').map(pokemon => ({
    id: pokemon.entityId, name: pokemon.name, form: pokemon.form,
    variants: Object.entries(pokemon.variants).flatMap(([name, variant]) => {
      if (!variant) return [];
      const resourceIds = Object.values(variant.animations).flatMap(animation => animation ? [animation.creditId, ...(animation.shadow ? [animation.shadow.creditId] : [])] : []);
      const ids = new Set(resourceIds.flatMap(id => byResource.get(id)?.contributions.map(credit => credit.artistId) ?? []));
      return [{ name, artists: artists.filter(artist => ids.has(artist.id)) }];
    }),
  }));
  // Preserve every generated artist, even authors of currently unused Happy/Sad portraits.
  return { artists: [...byArtist.values()], forms };
}
