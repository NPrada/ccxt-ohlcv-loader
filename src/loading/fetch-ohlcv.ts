import * as ccxt from 'ccxt';

// Constants
const LIMIT = 1000000; // Maximum limit for initial fetch (matches Python version)

// Type definitions
interface OHLCVCandle {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface FetchRequest {
    market: string;
    timeframe: string;
    since: number;
    limit: number;
}

// OHLCV data is returned as [timestamp, open, high, low, close, volume]
type RawOHLCVData = [number, number, number, number, number, number];

// Utility functions
function dateToTimestamp(dateStr: string): number {
    return new Date(dateStr).getTime();
}

function timestampToDate(timestamp: number): string {
    return new Date(timestamp).toISOString().replace('T', ' ').slice(0, 19);
}

// Sleep utility for rate limiting
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch OHLCV data from a single exchange for a market
 * @param exchangeName - Name of the exchange (e.g., 'binance', 'coinbase')
 * @param market - Market symbol (e.g., 'BTC/USDT')
 * @param timeframe - Timeframe (e.g., '1m', '5m', '1h', '1d')
 * @param fromDate - Start date in format 'YYYY-MM-DD HH:MM:SS'
 * @param toDate - End date in format 'YYYY-MM-DD HH:MM:SS' or null for all available data
 * @returns Promise resolving to array of OHLCV data points
 */
export async function fetchOHLCVData(
    exchange: ccxt.Exchange,
    market: string,
    timeframe: string,
    fromDate: string,
    toDate: string | null = null
): Promise<RawOHLCVData[]> {    
    try {
        // Convert dates to timestamps
        const since = dateToTimestamp(fromDate);
        
        // Pre-download: fetch initial data to determine actual limit and timeframe interval
        console.log(`Fetching initial data for ${market} ${timeframe}...`);
        const initialData: RawOHLCVData[] = (await exchange.fetchOHLCV(market, timeframe, since, LIMIT)) as RawOHLCVData[];
        
        if (!initialData || initialData.length === 0) {
            throw new Error("No data available for the requested market and timeframe");
        }
        
        if (initialData.length === 1) {
            throw new Error("Not enough data available for the requested market and timeframe");
        }
        
        // Calculate actual limit and timeframe interval
        const maxLimit = initialData.length;
        const timeframeInterval = initialData[1][0] - initialData[0][0]; // Difference between timestamps
        
        // Calculate total limit needed
        let totalLimit: number;
        if (toDate === null) {
            // Fetch until current time
            totalLimit = Math.ceil((Date.now() - initialData[0][0]) / timeframeInterval);
        } else {
            const endTimestamp = dateToTimestamp(toDate);
            totalLimit = Math.ceil((endTimestamp - initialData[0][0]) / timeframeInterval);
        }
        
        // Calculate number of requests needed
        const numRequests = Math.ceil(totalLimit / maxLimit);
        
        console.log(`Downloading ${market} ${timeframe} data from ${timestampToDate(initialData[0][0])} to ${toDate || 'now'}`);
        console.log(`Total requests needed: ${numRequests}`);
        
        // Prepare requests
        const requests: FetchRequest[] = [];
        for (let i = 0; i < numRequests; i++) {
            requests.push({
                market,
                timeframe,
                since: since + (i * maxLimit * timeframeInterval),
                limit: LIMIT
            });
        }
        
        // Fetch data sequentially to avoid rate limiting
        const allData: RawOHLCVData[] = [];
        let processed = 0;
        
        for (const request of requests) {
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    console.log(`Fetching chunk ${processed + 1}/${numRequests}...`);
                    const chunkData: RawOHLCVData[] = await exchange.fetchOHLCV(
                        request.market,
                        request.timeframe,
                        request.since,
                        request.limit
                    ) as RawOHLCVData[];
                    
                    allData.push(...chunkData);
                    processed++;
                    break; // Success, break retry loop
                    
                } catch (error: any) {
                    if (error.toString().includes('rate limit') || error.toString().includes('429')) {
                        console.log(`Rate limit reached, waiting 60 seconds...`);
                        await sleep(60000); // Wait 60 seconds
                        retryCount++;
                    } else {
                        throw error; // Re-throw non-rate-limit errors
                    }
                }
            }
            
            if (retryCount >= maxRetries) {
                throw new Error(`Failed to fetch data after ${maxRetries} retries due to rate limiting`);
            }
            
            // Small delay between requests to be respectful
            await sleep(100);
        }
        
        // Aggregate and clean data
        console.log(`Aggregating ${allData.length} data points...`);
        
        // Remove duplicates based on timestamp
        const uniqueData: RawOHLCVData[] = [];
        const seenTimestamps = new Set<number>();
        
        for (const candle of allData) {
            const timestamp = candle[0];
            if (!seenTimestamps.has(timestamp)) {
                seenTimestamps.add(timestamp);
                uniqueData.push(candle);
            }
        }
        
        // Sort by timestamp
        uniqueData.sort((a, b) => a[0] - b[0]);
        
        // Trim to requested limit
        const finalData = uniqueData.slice(0, totalLimit);
        
        // Data integrity check
        let missingCandles = 0;
        for (let i = 1; i < finalData.length; i++) {
            const expectedInterval = timeframeInterval;
            const actualInterval = finalData[i][0] - finalData[i - 1][0];
            if (actualInterval !== expectedInterval) {
                const missing = Math.floor(actualInterval / expectedInterval) - 1;
                missingCandles += missing;
            }
        }
        
        if (missingCandles > 0) {
            console.warn(`WARNING: ${missingCandles} candles detected as missing. This is likely due to exchange downtime or gaps in data.`);
        }
        
        console.log(`Successfully fetched ${finalData.length} candles`);
        return finalData;
        
    } catch (error) {
        console.error('Error fetching OHLCV data:', error);
        throw error;
    }
}

// What is returned
// [
//     [
//         1504541580000, // UTC timestamp in milliseconds, integer
//         4235.4,        // (O)pen price, float
//         4240.6,        // (H)ighest price, float
//         4230.0,        // (L)owest price, float
//         4230.7,        // (C)losing price, float
//         37.72941911    // (V)olume float (usually in terms of the base currency, the exchanges docstring may list whether quote or base units are used)
//     ],
//     ...
// ]

// Utility exports
export { dateToTimestamp, timestampToDate };
export type { RawOHLCVData as OHLCVData, OHLCVCandle, FetchRequest };

// // Example usage if run directly
// if (require.main === module) {
//     (async () => {
//         try {
//             const data = await fetchOHLCVData(
//                 'binance',           // exchange
//                 'BTC/USDT',         // market
//                 '1h',               // timeframe
//                 '2023-01-01 00:00:00', // from date
//                 '2023-01-02 00:00:00'  // to date (optional)
//             );
            
//             console.log(`\nFirst few candles:`);
//             console.log(data.slice(0, 3));
//             console.log(`\nLast few candles:`);
//             console.log(data.slice(-3));
            
//         } catch (error: any) {
//             console.error('Error:', error.message);
//         }
//     })();
// }