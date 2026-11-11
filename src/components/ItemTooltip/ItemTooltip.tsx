import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from '@/components/ItemTooltip/ItemTooltip.module.css';
import type { TooltipItem, TooltipPoint } from '@/components/ItemTooltip/ItemTooltipProvider';
import { MoneyText } from '@/components/MoneyText/MoneyText';
import {
  damageLine,
  dpsLine,
  effectLine,
  loadItemDetail,
  slotLine,
  speedText,
  statLine,
  type ItemDetail,
} from '@/foreverdb/itemDetail';

type ItemTooltipProps = {
  item: TooltipItem;
  at: TooltipPoint;
};

type DetailState = { status: 'loading' } | { status: 'ready'; detail: ItemDetail } | { status: 'failed' };

type TooltipPosition = { left: number; top: number };

type DetailLinesProps = {
  detail: ItemDetail;
};

/** Gap between the pointer and the box, and the least room kept from the viewport edge. */
const POINTER_GAP = 12;
const EDGE_GAP = 8;

/** WoW's item quality colours, by qualityId. */
const QUALITY_COLORS: Record<number, string> = {
  0: '#9d9d9d',
  1: '#ffffff',
  2: '#1eff00',
  3: '#0070dd',
  4: '#a335ee',
  5: '#ff8000',
  6: '#e6cc80',
};

const DEFAULT_NAME_COLOR = '#ffffff';

function DetailLines({ detail }: DetailLinesProps) {
  const slot = slotLine(detail);
  return (
    <>
      {detail.itemLevel > 0 && <p className={styles.itemLevel}>Item Level {detail.itemLevel}</p>}
      {detail.bonding !== null && detail.bonding !== '' && <p>{detail.bonding}</p>}
      {detail.unique && <p>Unique</p>}
      {slot !== null && (
        <p className={styles.split}>
          <span>{slot.slot}</span>
          <span>{slot.type}</span>
        </p>
      )}
      {detail.damage !== null && detail.speed !== null && (
        <>
          <p className={styles.split}>
            <span>{damageLine(detail.damage)}</span>
            <span>{speedText(detail.speed)}</span>
          </p>
          <p>{dpsLine(detail.damage, detail.speed)}</p>
        </>
      )}
      {detail.damage !== null && detail.speed === null && <p>{damageLine(detail.damage)}</p>}
      {detail.stats.map((stat) => (
        <p key={stat.stat}>{statLine(stat)}</p>
      ))}
      {detail.requiredLevel > 0 && <p>Requires Level {detail.requiredLevel}</p>}
      {detail.effects.map((effect, index) => (
        <p key={index} className={styles.effect}>
          {effectLine(effect)}
        </p>
      ))}
      {detail.sellPrice !== null && detail.sellPrice > 0 && (
        <p className={styles.sell}>
          Sell Price: <MoneyText copper={detail.sellPrice} />
        </p>
      )}
    </>
  );
}

/** A WoW-style item tooltip at the click point, flipped to the other side of the pointer when it would leave the viewport. */
export function ItemTooltip({ item, at }: ItemTooltipProps) {
  const [state, setState] = useState<DetailState>({ status: 'loading' });
  const [position, setPosition] = useState<TooltipPosition>({ left: at.x + POINTER_GAP, top: at.y + POINTER_GAP });
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    loadItemDetail(item.itemId).then(
      (detail) => {
        if (active) setState({ status: 'ready', detail });
      },
      () => {
        if (active) setState({ status: 'failed' });
      },
    );
    return () => {
      active = false;
    };
  }, [item.itemId]);

  // Measured after each content change, since loading lines change the box's size.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (box === null) return;
    const { width, height } = box.getBoundingClientRect();
    let left = at.x + POINTER_GAP;
    let top = at.y + POINTER_GAP;
    if (left + width > window.innerWidth - EDGE_GAP) left = at.x - width - POINTER_GAP;
    if (top + height > window.innerHeight - EDGE_GAP) top = at.y - height - POINTER_GAP;
    setPosition({ left: Math.max(EDGE_GAP, left), top: Math.max(EDGE_GAP, top) });
  }, [state.status, at]);

  const name = state.status === 'ready' ? state.detail.name : item.name;
  const qualityId = state.status === 'ready' ? state.detail.qualityId : -1;
  const color = QUALITY_COLORS[qualityId] ?? DEFAULT_NAME_COLOR;

  return (
    <div ref={boxRef} role="tooltip" className={styles.tooltip} style={{ left: position.left, top: position.top }}>
      <p className={styles.name} style={{ color }}>
        {name}
      </p>
      {state.status === 'loading' && <p className={styles.muted}>Loading…</p>}
      {state.status === 'ready' && <DetailLines detail={state.detail} />}
    </div>
  );
}
