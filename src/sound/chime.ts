export type ChimeResult = {
  announced: string[];
  added: string[];
};

/** Forgets ids that are no longer ready, so they chime again once they are. */
export function pruneAnnounced(announced: string[], ready: string[]): string[] {
  const kept = announced.filter((id) => ready.includes(id));
  return kept.length === announced.length ? announced : kept;
}

export function announceReady(announced: string[], ready: string[]): ChimeResult {
  const added = ready.filter((id) => !announced.includes(id));
  return { announced: added.length === 0 ? announced : [...announced, ...added], added };
}
