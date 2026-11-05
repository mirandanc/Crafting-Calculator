import styles from '@/App.module.css';
import { CardList } from '@/components/CardList/CardList';
import { Invoice } from '@/components/Invoice/Invoice';
import { MuteToggle } from '@/components/MuteToggle/MuteToggle';
import { useCommittedLines } from '@/invoice/useCommittedLines';
import { useRecipe } from '@/recipe/useRecipe';
import { useCoinSound } from '@/sound/useCoinSound';

export function App() {
  const { recipe, setTitle, addCard, updateCard, normalizeCardPrice, removeCard, clearAll, setMuted } = useRecipe();
  const playCoin = useCoinSound(recipe.muted);
  const lines = useCommittedLines(recipe.cards, playCoin);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Crafting Calculator</h1>
        <MuteToggle muted={recipe.muted} onToggle={() => setMuted(!recipe.muted)} />
      </header>
      <main className={styles.layout}>
        <section className={styles.editor} aria-label="Recipe">
          <label className={styles.titleField}>
            <span>Recipe name</span>
            <input value={recipe.title} placeholder="e.g. Flask of the Titans" onChange={(event) => setTitle(event.target.value)} />
          </label>
          <CardList
            cards={recipe.cards}
            onAdd={addCard}
            onChange={updateCard}
            onNormalizePrice={normalizeCardPrice}
            onRemove={removeCard}
            onClearAll={clearAll}
          />
        </section>
        <Invoice title={recipe.title} lines={lines} />
      </main>
    </div>
  );
}
