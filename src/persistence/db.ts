import { retry } from "../utils/retry";
import { z } from "zod";
import { Pool, types } from "pg";
import { deduplicateOHLCVData } from "../parsing/ohlcv";
import { env } from "../env";
import { MarketType } from "ccxt";

// Configure timestamp parsing to handle PostgreSQL timestamps
types.setTypeParser(
  1114,
  (str: string) => new Date(str.split(" ").join("T") + "Z")
);

// Shared connection pool for all database operations
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Handle pool errors
pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});

export const OHLCVDataSchema = z.object({
  symbol: z.string(),
  open_time: z.number().int(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string(),
  volume: z.string(),
  close_time: z.number().int(),
});

export type OHLCVDataItem = z.infer<typeof OHLCVDataSchema>;

const getTableName = (exchangeName: string, marketType: MarketType): string => {
  return `${exchangeName}_${marketType}_ohlcv`;
};

export async function ensureTableExists(exchangeName: string, marketType: MarketType): Promise<void> {
  const tableName = getTableName(exchangeName, marketType);
  
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      symbol VARCHAR(50) NOT NULL,
      open_time TIMESTAMP NOT NULL,
      open DECIMAL(20,8) NOT NULL,
      high DECIMAL(20,8) NOT NULL,
      low DECIMAL(20,8) NOT NULL,
      close DECIMAL(20,8) NOT NULL,
      volume DECIMAL(20,8) NOT NULL,
      close_time TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (symbol, open_time)
    );
  `;

    // CREATE INDEX IF NOT EXISTS idx_${tableName}_symbol ON ${tableName} (symbol);
    // CREATE INDEX IF NOT EXISTS idx_${tableName}_close_time ON ${tableName} (close_time);

  await retry(async () => {
    await pool.query(createTableQuery);
  });
}

export async function persistToPostgres(
  data: OHLCVDataItem[], 
  exchangeName: string, 
  marketType: MarketType
): Promise<void> {
  if (data.length === 0) return;


  const tableName = getTableName(exchangeName, marketType);

  try {
    const queryText = `
      INSERT INTO ${tableName}(
        symbol, open_time, open, high, low, close, volume, close_time
      ) VALUES ${data
        .map(
          (_, idx) =>
            `($${8 * idx + 1}, $${8 * idx + 2}, $${8 * idx + 3}, $${
              8 * idx + 4
            }, $${8 * idx + 5}, $${8 * idx + 6}, $${8 * idx + 7}, $${
              8 * idx + 8
            })`
        )
        .join(", ")}
      ON CONFLICT (symbol, open_time) 
      DO UPDATE SET
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        volume = excluded.volume
    `;

    const values = data.flatMap((item) => [
      item.symbol,
      new Date(item.open_time).toISOString(),
      item.open,
      item.high,
      item.low,
      item.close,
      item.volume,
      new Date(item.close_time).toISOString(),
    ]);

    await retry(async () => {
      await pool.query(queryText, values);
    });

    console.log(`Persisted ${data.length} records to ${tableName}`);
  } catch (error) {
    console.error(`Error persisting data to ${tableName}:`, error);
    throw error;
  }
}

export async function getLatestTimesForAllSymbols(
  symbols: string[],
  exchangeName: string,
  marketType: MarketType
): Promise<Map<string, number>> {
  const tableName = getTableName(exchangeName, marketType);
  
  try {
    const queryText = `
      SELECT symbol, EXTRACT(EPOCH FROM MAX(close_time)) * 1000 as latest_time 
      FROM ${tableName}
      WHERE symbol = ANY($1)
      GROUP BY symbol
    `;

    
    const res = await pool.query(queryText, [symbols]);
    const latestTimesMap = new Map<string, number>();

    for (const row of res.rows) {
      latestTimesMap.set(row.symbol, parseInt(row.latest_time));
    }
    
    return latestTimesMap;
  } catch (error) {
    console.log(`Table ${tableName} might not exist yet, returning empty map`);
    return new Map();
  }
}

export async function getEarliestTime(
  exchangeName: string,
  marketType: MarketType
): Promise<number | null> {
  const tableName = getTableName(exchangeName, marketType);
  
  try {
    const queryText = `
      SELECT EXTRACT(EPOCH FROM MIN(close_time)) * 1000 as earliest_time 
      FROM ${tableName}
    `;
    
    const res = await pool.query(queryText);
    return res.rows[0]?.earliest_time ? parseInt(res.rows[0].earliest_time) : null;
  } catch (error) {
    console.log(`Table ${tableName} might not exist yet, returning null`);
    return null;
  }
}

export async function persistOHLCVInBatches(
  data: OHLCVDataItem[],
  exchangeName: string,
  marketType: MarketType,
  maxRetries: number = 3,
  retryDelayMs: number = 1000
): Promise<void> {
  if (!data || data.length === 0) {
    console.warn("No data provided to persistOHLCVInBatches.");
    return;
  }

  await ensureTableExists(exchangeName, marketType);

  const batchSize = env.PERSISTENCE_BATCH_SIZE;
  for (let i = 0; i < data.length; i += batchSize) {
    const batchData = deduplicateOHLCVData(
      data.slice(i, i + batchSize)
    );

    try {
      await retry(
        async () => {
          await persistToPostgres(batchData, exchangeName, marketType);
        },
        maxRetries,
        retryDelayMs
      );
      console.log(
        `Successfully persisted batch for ${exchangeName}_${marketType} starting at index ${i}`
      );
    } catch (error) {
      console.error(
        `Failed to persist batch for ${exchangeName}_${marketType} after ${maxRetries} attempts. Batch starting at index ${i} will not be persisted. Error:`,
        error
      );
    }
  }
}