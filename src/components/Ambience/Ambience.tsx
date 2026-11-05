import styles from '@/components/Ambience/Ambience.module.css';

type EmberDrift = 'a' | 'b' | 'c';

type Ember = {
  drift: EmberDrift;
  leftPercent: number;
  sizePx: number;
  durationS: number;
  delayS: number;
};

const EMBERS: Ember[] = [
  { drift: 'a', leftPercent: 4, sizePx: 3, durationS: 10, delayS: -1 },
  { drift: 'b', leftPercent: 11, sizePx: 4, durationS: 13, delayS: -6 },
  { drift: 'c', leftPercent: 17, sizePx: 2, durationS: 9, delayS: -3 },
  { drift: 'a', leftPercent: 23, sizePx: 3, durationS: 12, delayS: -9 },
  { drift: 'b', leftPercent: 30, sizePx: 5, durationS: 15, delayS: -4 },
  { drift: 'c', leftPercent: 36, sizePx: 2, durationS: 8, delayS: -2 },
  { drift: 'a', leftPercent: 42, sizePx: 3, durationS: 11, delayS: -7 },
  { drift: 'b', leftPercent: 48, sizePx: 4, durationS: 14, delayS: -11 },
  { drift: 'c', leftPercent: 54, sizePx: 2, durationS: 10, delayS: -5 },
  { drift: 'b', leftPercent: 60, sizePx: 3, durationS: 12, delayS: -1 },
  { drift: 'a', leftPercent: 66, sizePx: 4, durationS: 9, delayS: -8 },
  { drift: 'c', leftPercent: 72, sizePx: 2, durationS: 13, delayS: -3 },
  { drift: 'a', leftPercent: 78, sizePx: 5, durationS: 16, delayS: -10 },
  { drift: 'b', leftPercent: 83, sizePx: 3, durationS: 10, delayS: -6 },
  { drift: 'c', leftPercent: 88, sizePx: 2, durationS: 12, delayS: -2 },
  { drift: 'a', leftPercent: 93, sizePx: 4, durationS: 11, delayS: -9 },
  { drift: 'b', leftPercent: 97, sizePx: 3, durationS: 14, delayS: -4 },
  { drift: 'c', leftPercent: 51, sizePx: 2, durationS: 18, delayS: -13 },
];

const DRIFT_CLASS: Record<EmberDrift, string> = {
  a: styles.driftA,
  b: styles.driftB,
  c: styles.driftC,
};

export function Ambience() {
  return (
    <div className={styles.ambience} aria-hidden="true">
      <div className={styles.glow} />
      <svg className={styles.grain} width="100%" height="100%">
        <filter id="ambience-grain">
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves={3} stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#ambience-grain)" />
      </svg>
      <div className={styles.vignette} />
      <div className={styles.embers}>
        {EMBERS.map((ember) => (
          <span
            key={`${ember.leftPercent}-${ember.delayS}`}
            className={`${styles.ember} ${DRIFT_CLASS[ember.drift]}`}
            style={{
              left: `${ember.leftPercent}%`,
              width: `${ember.sizePx}px`,
              height: `${ember.sizePx}px`,
              animationDuration: `${ember.durationS}s`,
              animationDelay: `${ember.delayS}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
