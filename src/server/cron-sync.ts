import type { Params as ChronParams } from "fastify-cron";
import ccxt from "ccxt";
import { env } from "../env";
import { fetchExchangeOHLCV } from "../loading/fetch-exchange-ohlcv";

let syncing = false;

export const cronSyncData: ChronParams = {
  name: "daily-ohlcv-sync",
  start: true,
  runOnInit: true, // Run on startup for initial sync
  cronTime: "0 0 * * *", // Every day at midnight
  onTick: async () => {
    try {
      if (!syncing) {
        syncing = true;
        console.log("🚀 Starting CCXT OHLCV sync process...");

        let exchangeNames = env.EXCHANGE_NAMES;
        const supportedExchangeNames = ccxt.exchanges;

        exchangeNames = exchangeNames.filter((el) => {
          if (supportedExchangeNames.includes(el)) {
            return true;
          }
          console.log(
            `WARNING: ccxt does not support ${el}, we are filtering it out`
          );
        });

        for (let i = 0; i < exchangeNames.length; i++) {
          await fetchExchangeOHLCV(exchangeNames[i]);
        }

        console.log("✅ CCXT OHLCV sync completed");
      }
    } catch (error) {
      console.error("❌ Error during CCXT OHLCV sync:", error);
    } finally {
      syncing = false;
    }
  },
};