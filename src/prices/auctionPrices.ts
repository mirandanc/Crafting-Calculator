export type AuctionHouse = {
  ruleset: number;
  id: number;
  name: string;
};

/** What the update job stores in KV and the Worker serves at /api/auction-prices. */
export type AuctionPriceList = {
  /** ISO time of the download. */
  updatedAt: string;
  house: AuctionHouse;
  /** Market value in copper per Blizzard (= ForeverDB) item id. */
  prices: Record<string, number>;
};
