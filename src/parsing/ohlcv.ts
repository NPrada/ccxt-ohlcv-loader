
import { OHLCVData } from "../loading/fetch-ohlcv";
import { OHLCVDataItem } from "../persistence/db";

export function parseOHLCVData(
  ohlcvData: OHLCVData[],
  symbol: string,
  excludeIncomplete: boolean = true
): OHLCVDataItem[] {
  const parsedData = ohlcvData.map((candle) => {
    const [timestamp, open, high, low, close, volume] = candle;
    
    return {
      symbol,
      open_time: timestamp,
      open: open.toString(),
      high: high.toString(),
      low: low.toString(),
      close: close.toString(),
      volume: volume.toString(),
      close_time: timestamp + 60000, // 1 minute later
    };
  });

  // Filter out incomplete candles by default
  return excludeIncomplete ? filterCompleteCandles(parsedData) : parsedData;
}

export function deduplicateOHLCVData(data: OHLCVDataItem[]): OHLCVDataItem[] {
  const seen = new Set<string>();
  return data.filter((item) => {
    const key = `${item.symbol}-${item.close_time}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function filterCompleteCandles(data: OHLCVDataItem[]): OHLCVDataItem[] {
  const now = Date.now();
  return data.filter((item) => {
    // Only include candles that have already closed
    // For 1-minute candles, the close_time should be in the past
    return item.close_time <= now;
  });
}