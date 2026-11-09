import styles from '@/components/RemoveButton/RemoveButton.module.css';

type RemoveButtonSize = 'normal' | 'small';

type RemoveButtonProps = {
  label: string;
  size: RemoveButtonSize;
  onClick: () => void;
};

const GLYPH_PX: Record<RemoveButtonSize, number> = {
  normal: 16,
  small: 13,
};

export function RemoveButton({ label, size, onClick }: RemoveButtonProps) {
  return (
    <button type="button" className={`${styles.remove} ${styles[size]}`} aria-label={label} onClick={onClick}>
      <svg
        width={GLYPH_PX[size]}
        height={GLYPH_PX[size]}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M6 6l12 12" />
        <path d="M18 6L6 18" />
      </svg>
    </button>
  );
}
