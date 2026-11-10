import { useMemo, useState } from 'react';
import { Autocomplete, type SearchOption } from '@/components/Autocomplete/Autocomplete';
import { EntryNumeral } from '@/components/EntryNumeral/EntryNumeral';
import { ReagentRow } from '@/components/ReagentRow/ReagentRow';
import styles from '@/components/RecipeBlockEditor/RecipeBlockEditor.module.css';
import { RemoveButton } from '@/components/RemoveButton/RemoveButton';
import type { Coins } from '@/money/money';
import { searchRecipes, type CatalogItem, type CatalogRecipe, type RecipeCatalog } from '@/recipes/catalog';
import { craftNote, planCrafts, reagentQuantity } from '@/sheet/crafts';
import { MAX_WANTED, parseWanted, priceKey, priceOf, type Prices, type RecipeBlock } from '@/sheet/sheet';

type RecipeBlockEditorProps = {
  block: RecipeBlock;
  position: number;
  catalog: RecipeCatalog | null;
  prices: Prices;
  onChoose: (recipe: CatalogRecipe, items: Record<string, CatalogItem>) => void;
  onWantedChange: (wanted: number | null) => void;
  onRemoveReagent: (itemId: number) => void;
  onPriceChange: (key: string, price: Coins) => void;
  onPriceBlur: (key: string) => void;
  onRemove: () => void;
};

export function RecipeBlockEditor({
  block,
  position,
  catalog,
  prices,
  onChoose,
  onWantedChange,
  onRemoveReagent,
  onPriceChange,
  onPriceBlur,
  onRemove,
}: RecipeBlockEditorProps) {
  const { recipe } = block;
  // The search text is local: a picked recipe stays until another one is picked, and leaving the
  // field puts its name back.
  const [query, setQuery] = useState(recipe?.name ?? '');
  const matches = useMemo(() => (catalog === null ? [] : searchRecipes(catalog, query)), [catalog, query]);
  const options: SearchOption[] = matches.map((match) => ({
    key: String(match.id),
    label: match.name,
    detail: match.profession,
    icon: match.icon,
  }));
  const plan = planCrafts(block.wanted, recipe?.makes ?? null);
  const note = recipe === null ? null : craftNote(plan, recipe.makes);
  const casts = recipe !== null && recipe.makes === null;

  const choose = (option: SearchOption) => {
    const chosen = matches.find((match) => String(match.id) === option.key);
    if (chosen === undefined || catalog === null) return;
    setQuery(chosen.name);
    onChoose(chosen, catalog.items);
  };

  return (
    <article className={styles.block} aria-label={`Recipe ${position}`}>
      <EntryNumeral position={position} icon={recipe?.icon ?? null} />
      <Autocomplete
        label="Recipe"
        value={query}
        placeholder="Search a recipe"
        options={options}
        inputClassName={styles.search}
        onInputChange={setQuery}
        onSelect={choose}
        onBlur={() => {
          if (recipe !== null) setQuery(recipe.name);
        }}
      />
      <RemoveButton label={`Remove recipe ${position}`} size="normal" onClick={onRemove} />
      {recipe !== null && (
        <div className={styles.details}>
          <div className={styles.amount}>
            <label className={styles.wanted}>
              <span className={styles.times} aria-hidden="true">
                ×
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_WANTED}
                placeholder="1"
                aria-label={casts ? 'Casts' : 'Amount wanted'}
                className={styles.wantedInput}
                value={block.wanted ?? ''}
                onChange={(event) => onWantedChange(parseWanted(event.target.value))}
              />
              <span className={styles.caption}>{casts ? 'casts' : 'wanted'}</span>
            </label>
            <span className={styles.profession}>{recipe.profession}</span>
          </div>
          {note !== null && <p className={styles.note}>{note}</p>}
          {recipe.reagents.length > 0 ? (
            <ul className={styles.reagents} aria-label={`Reagents for ${recipe.name}`}>
              {recipe.reagents.map((reagent) => {
                const key = priceKey(reagent.name);
                return (
                  <ReagentRow
                    key={reagent.itemId}
                    reagent={reagent}
                    recipeName={recipe.name}
                    quantity={reagentQuantity(reagent.perCraft, plan)}
                    price={priceOf(prices, key)}
                    onPriceChange={(price) => onPriceChange(key, price)}
                    onPriceBlur={() => onPriceBlur(key)}
                    onRemove={() => onRemoveReagent(reagent.itemId)}
                  />
                );
              })}
            </ul>
          ) : (
            <p className={styles.note}>Every reagent was removed. Pick the recipe again to bring them back.</p>
          )}
        </div>
      )}
    </article>
  );
}
