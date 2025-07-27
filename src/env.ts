import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

export const envConfigSchema = z.object({
  DATABASE_URL: z.string(),
  NODE_ENV: z
    .union([z.literal("development"), z.literal("production")])
    .default("development"),
  SYMBOL_BLACKLIST: z
    .string()
    .transform((str) => str ? str.split(",").map((s) => s.trim()) : [])
    .default(""),
  EXCLUDE_INCOMPLETE_CANDLES: z
    .string()
    .transform((str) => str === "true")
    .default("true"),
  EXCHANGE_NAMES: z
    .string()
    .transform((str) => str.split(",").map((s) => s.trim()))
    .default("binance,hyperliquid,kraken"),
  MARKET_TYPES: z
    .string()
    .transform((str) => str ? str.split(",").map((s) => s.trim()) : ["spot", "swap"])
    .default("spot,swap"),
  PERSISTENCE_BATCH_SIZE: z
    .string()
    .transform((str) => parseInt(str, 10))
    .default("1000"),
  HISTORICAL_DATA_TO_KEEP_MS: z
    .string()
    .transform((str) => parseInt(str, 10))
    .default((3 * 30 * 24 * 60 * 60 * 1000).toString()),
});

export type EnvConfigType = z.infer<typeof envConfigSchema>;

export let env: EnvConfigType;
try {
  env = envConfigSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    SYMBOL_BLACKLIST: process.env.SYMBOL_BLACKLIST,
    EXCLUDE_INCOMPLETE_CANDLES: process.env.EXCLUDE_INCOMPLETE_CANDLES,
    EXCHANGE_NAMES: process.env.EXCHANGE_NAMES,
    MARKET_TYPES: process.env.MARKET_TYPES,
    PERSISTENCE_BATCH_SIZE: process.env.PERSISTENCE_BATCH_SIZE,
    HISTORICAL_DATA_TO_KEEP_MS: process.env.HISTORICAL_DATA_TO_KEEP_MS,
  });
} catch (err: any) {
  console.log("error parsing env vars");
  throw new Error(err);
}