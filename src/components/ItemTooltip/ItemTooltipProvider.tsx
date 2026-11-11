import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ItemTooltip } from '@/components/ItemTooltip/ItemTooltip';

/** The item an icon stands for; the name shows while the details load, or alone when they fail. */
export type TooltipItem = { itemId: number; name: string };

export type TooltipPoint = { x: number; y: number };

type OpenTooltip = (item: TooltipItem, at: TooltipPoint) => void;

type OpenState = { item: TooltipItem; at: TooltipPoint };

type ItemTooltipProviderProps = {
  children: ReactNode;
};

const ItemTooltipContext = createContext<OpenTooltip | null>(null);

/** Null outside a provider: the icon then stays a plain picture (component tests render without one). */
export function useItemTooltip(): OpenTooltip | null {
  return useContext(ItemTooltipContext);
}

/** Holds the one open item tooltip; any press, Escape, scroll or resize closes it. */
export function ItemTooltipProvider({ children }: ItemTooltipProviderProps) {
  const [open, setOpen] = useState<OpenState | null>(null);
  const openTooltip = useCallback<OpenTooltip>((item, at) => setOpen({ item, at }), []);
  const isOpen = open !== null;

  useEffect(() => {
    if (!isOpen) return;
    const close = () => setOpen(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    // A press on another icon closes this one first, then that icon's click opens its own.
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', closeOnEscape);
    // Capture so a scroll inside any inner scroller counts too.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);

  return (
    <ItemTooltipContext.Provider value={openTooltip}>
      {children}
      {open !== null && createPortal(<ItemTooltip key={open.item.itemId} item={open.item} at={open.at} />, document.body)}
    </ItemTooltipContext.Provider>
  );
}
