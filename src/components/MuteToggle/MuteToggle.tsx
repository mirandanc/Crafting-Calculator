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
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
        {muted ? (
          <>
            <path d="M16 9.5l5 5" />
            <path d="M21 9.5l-5 5" />
          </>
        ) : (
          <>
            <path d="M15.5 9a4 4 0 0 1 0 6" />
            <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
          </>
        )}
      </svg>
    </button>
  );
}
