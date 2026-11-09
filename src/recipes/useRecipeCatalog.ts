import { useEffect, useState } from 'react';
import type { RecipeCatalog } from '@/recipes/catalog';
import { loadRecipeCatalog } from '@/recipes/loadRecipeCatalog';

/** The recipe catalog, or null while it loads (or if it could not load: recipe search then stays empty). */
export function useRecipeCatalog(): RecipeCatalog | null {
  const [catalog, setCatalog] = useState<RecipeCatalog | null>(null);

  useEffect(() => {
    let active = true;
    loadRecipeCatalog().then(
      (loaded) => {
        if (active) setCatalog(loaded);
      },
      (error: unknown) => {
        // loadRecipeCatalog() resets its cache on failure, so the next mount tries again.
        if (active) console.error('Failed to load the recipe catalog', error);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return catalog;
}
