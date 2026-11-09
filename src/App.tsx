import styles from '@/App.module.css';
import { Ambience } from '@/components/Ambience/Ambience';
import { CardList } from '@/components/CardList/CardList';
import { Footer } from '@/components/Footer/Footer';
import { Invoice } from '@/components/Invoice/Invoice';
import { MuteToggle } from '@/components/MuteToggle/MuteToggle';
import { Page } from '@/components/Page/Page';
import { Ribbon } from '@/components/Ribbon/Ribbon';
import { useCommittedLines } from '@/invoice/useCommittedLines';
import { useRecipe } from '@/recipe/useRecipe';
import { useCoinSound } from '@/sound/useCoinSound';

export function App() {
  const { recipe, setTitle, addCard, updateCard, normalizeCardPrice, removeCard, clearAll, setMuted } = useRecipe();
  const playCoin = useCoinSound(recipe.muted);
  const lines = useCommittedLines(recipe.cards, playCoin);

  return (
    <div className={styles.page}>
      <Ambience />
      <header className={styles.header}>
        <h1 className={styles.heading}>Crafting Calculator</h1>
        <MuteToggle muted={recipe.muted} onToggle={() => setMuted(!recipe.muted)} />
      </header>
      <main className={styles.book}>
        <div className={styles.stitching} aria-hidden="true" />
        <Page side="left" label="Recipe" heading="Reagents">
          <label className={styles.titleField}>
            <span className={styles.titleCaption}>Recipe</span>
            <input
              className={styles.titleInput}
              aria-label="Recipe name"
              value={recipe.title}
              placeholder="e.g. Flask of the Titans"
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <CardList
            cards={recipe.cards}
            onAdd={addCard}
            onChange={updateCard}
            onNormalizePrice={normalizeCardPrice}
            onRemove={removeCard}
            onClearAll={clearAll}
          />
        </Page>
        <Invoice title={recipe.title} lines={lines} />
        <Ribbon />
      </main>
      <Footer />
    </div>
  );
}
