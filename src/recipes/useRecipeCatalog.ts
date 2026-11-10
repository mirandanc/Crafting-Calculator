import { useEffect, useState } from 'react';
import type { RecipeCatalog } from '@/recipes/catalog';
import { loadRecipeCatalog } from '@/recipes/loadRecipeCatalog';

export type RecipeCatalogState = {
  /** null while it loads, and after a failed load. */
  catalog: RecipeCatalog | null;
  /** True once the load has failed: recipe search then stays empty for this page. */
  failed: boolean;
};

const LOADING: RecipeCatalogState = { catalog: null, failed: false };

export function useRecipeCatalog(): RecipeCatalogState {
  const [state, setState] = useState<RecipeCatalogState>(LOADING);

  useEffect(() => {
    let active = true;
    loadRecipeCatalog().then(
      (catalog) => {
        if (active) setState({ catalog, failed: false });
      },
      (error: unknown) => {
        // loadRecipeCatalog() resets its cache on failure, so the next mount tries again.
        if (!active) return;
        console.error('Failed to load the recipe catalog', error);
        setState({ catalog: null, failed: true });
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return state;
}
