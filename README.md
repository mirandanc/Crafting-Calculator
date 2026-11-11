# Crafting Calculator

WoW Forever crafting calculator: pick recipes and items, price them, and get a shopping list. Data by [ForeverDB.net](https://foreverdb.net).

## Local development

1. `npm ci`
2. Copy `.env.example` to `.env` and to `.dev.vars`, and put your ForeverDB API key in both. Both files are git-ignored; never commit the key.
3. The Worker's env types are committed in `worker/worker-configuration.d.ts`. After editing `wrangler.jsonc` (for example adding a binding), run `npm run types` before using the new binding in code, then commit the regenerated file.
4. Run the app:
   - `npm run dev:worker`: builds the app and serves it with the `/api` Worker on http://localhost:8787 (closest to production).
   - Or, for hot reload: `npm run dev:worker` in one terminal and `npm run dev` in another. Vite (http://localhost:5173) forwards `/api` to the Worker.
5. `npm test` runs every unit and integration test.

## Recipe data

`src/data/recipes.json` is generated from the ForeverDB API and committed. After a game patch, refresh it with `npm run fetch:recipes` (it reads the key from `.env` and takes about an hour, because it also reads each recipe's cooldown and every vendor's stock under ForeverDB's 60 requests/minute limit), then commit the new JSON.

## Auction prices

Prices fill in from the WoW Forever auction house through Blizzard's Battle.net API: US, Alliance house 110.
A GitHub Actions workflow (`.github/workflows/auction-prices.yml`) runs `scripts/fetch-auction-prices.ts` six times
a day: 06:00, 07:30, 12:45, 18:00, 19:30 and 00:45 GMT-3. The script works out a market value per item (the average of
the cheapest listings covering 15% of what's for sale) and stores it in the Cloudflare KV namespace bound as
`AUCTION_PRICES`. The Worker serves it at `/api/auction-prices`. A run that gets a broken or tiny answer stops
without saving, so the page keeps the last good prices and shows their age at the bottom.

The API only shows what is listed, never what sold, so the script estimates sales by comparing each run with the
previous one:

- A listing that vanishes, or a commodity stack that shrinks, before its time left could have run out counts as sold
  at its listed price. Cancels count too.
- Gaps are measured between the times Blizzard published its data (about hourly), not the run times. The other gaps
  (about 5 h) count listings that had more than 8 hours left. A 1h30 pair (06:00 → 07:30, 18:00 → 19:30) measures
  1 h or 2 h; at 1 h it also counts listings that had more than 2 hours left.
- Sales from the last 7 days give each item's sales per day and average sale price. A missed run doesn't count as a
  day without sales.
- The previous snapshot and the sales are kept in the KV key `auction-history`, about 4 MB. The workflow downloads it
  before the script and uploads it after. If it is missing or unreadable, a new history starts.

- Locally: put `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET` in `.env`, then `npm run fetch:auction-prices`
  (writes the git-ignored `auction-prices.json` and `auction-history.json`; a later run compares with it once
  Blizzard has published new data, about hourly) or
  `npm run auction:houses` (lists the Alliance houses).
- GitHub secrets the workflow needs: `BLIZZARD_CLIENT_ID`, `BLIZZARD_CLIENT_SECRET`, `CLOUDFLARE_API_TOKEN`
  (Workers KV Storage: Edit only) and `CLOUDFLARE_ACCOUNT_ID`.
- GitHub pauses scheduled workflows after 60 days without commits; run "Auction prices" by hand from the
  Actions tab to turn the schedule back on.

## Market analysis

The left page has two bookmarks: "Market list" (the shopping list sheet) and "Market analysis", which ranks
the recipes most worth crafting right now.

- The margin is the profit after the auction house's 5% cut, divided by the reagent cost.
- Reagents use the cheaper of the auction and vendor price; a vendor price is tagged "Vendor".
- Results are sold at the lower of today's auction price and their average sale price.
- Left out: recipes with a cooldown, results where fewer than 5 are listed for sale, results that sell fewer than
  5 a day or have fewer than 5 sales counted so far, and anything above a 1500% margin (a listing far above the item's worth that nobody buys).
- "Sort by" picks Profit per day (profit per craft × sales per day, the default) or Margin. Each card shows
  "N sold in a day" after the profession (rounded down, as 1.2k or 2.7m from a thousand up) and "≈ profit/day" under
  its prices, and a note above the cards says how many days of sales the ranking uses.
  Until the job has compared two runs, the ranking uses margin only and says so.
- The minimum profit per craft starts at 50c. The open tab, the minimum profit, the sort and the chosen professions
  are saved in the browser. The professions also narrow the recipe search on the Market list.

## Deployment

Cloudflare Workers Builds deploys `master` automatically. The Worker reads the key from the secret `FOREVERDB_API_KEY` (Settings → Variables and Secrets, for both Production and Previews Base).
