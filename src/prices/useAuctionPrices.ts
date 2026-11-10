import { useEffect, useState } from 'react';
import { parseAuctionPriceList, type AuctionPriceList, type AuctionPricesState } from '@/prices/auctionPrices';

const LOADING: AuctionPricesState = { list: null, failed: false };

async function fetchAuctionPrices(): Promise<AuctionPriceList> {
  const response = await fetch('/api/auction-prices');
  if (!response.ok) throw new Error(`Auction prices request failed: ${response.status}`);
  const list = parseAuctionPriceList(await response.json());
  if (list === null) throw new Error('Auction prices request failed: invalid response');
  return list;
}

/** Loads the auction price list once per page; on failure the page keeps working with typed prices only. */
export function useAuctionPrices(): AuctionPricesState {
  const [state, setState] = useState<AuctionPricesState>(LOADING);

  useEffect(() => {
    let active = true;
    fetchAuctionPrices().then(
      (list) => {
        if (active) setState({ list, failed: false });
      },
      (error: unknown) => {
        if (!active) return;
        console.error('Failed to load auction prices', error);
        setState({ list: null, failed: true });
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return state;
}
