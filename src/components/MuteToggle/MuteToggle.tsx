import styles from '@/components/MuteToggle/MuteToggle.module.css';

type MuteToggleProps = {
  muted: boolean;
  onToggle: () => void;
};

export function MuteToggle({ muted, onToggle }: MuteToggleProps) {
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label="Mute sound"
      aria-pressed={muted}
      onClick={onToggle}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
