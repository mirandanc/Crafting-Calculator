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
A GitHub Actions workflow (`.github/workflows/auction-prices.yml`) runs `scripts/fetch-auction-prices.ts` at
08:00 and 19:00 GMT-3 (11:00 and 22:00 UTC). The script works out a market value per item (the average of the cheapest
listings covering 15% of what's for sale) and stores it in the Cloudflare KV namespace bound as
`AUCTION_PRICES`. The Worker serves it at `/api/auction-prices`. A run that gets a broken or tiny answer stops
without saving, so the page keeps the last good prices and shows their age at the bottom.

- Locally: put `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET` in `.env`, then `npm run fetch:auction-prices`
  (writes the git-ignored `auction-prices.json`) or `npm run auction:houses` (lists the Alliance houses).
- GitHub secrets the workflow needs: `BLIZZARD_CLIENT_ID`, `BLIZZARD_CLIENT_SECRET`, `CLOUDFLARE_API_TOKEN`
  (Workers KV Storage: Edit only) and `CLOUDFLARE_ACCOUNT_ID`.
- GitHub pauses scheduled workflows after 60 days without commits; run "Auction prices" by hand from the
  Actions tab to turn the schedule back on.

## Market analysis

The left page has two bookmarks: "Market list" (the shopping list sheet) and "Market analysis", which ranks
the recipes most worth crafting right now.

- The margin is the profit after the auction house's 5% cut, divided by the reagent cost.
- Reagents use the cheaper of the auction and vendor price; a vendor price is tagged "Vendor".
- Recipes with a cooldown are left out, and so are results where fewer than 5 are listed for sale.
- The minimum profit per craft starts at 50c. The open tab, the minimum profit and the chosen professions are saved
  in the browser. The professions also narrow the recipe search on the Market list.

## Deployment

Cloudflare Workers Builds deploys `master` automatically. The Worker reads the key from the secret `FOREVERDB_API_KEY` (Settings → Variables and Secrets, for both Production and Previews Base).
