import * as ccxt from 'ccxt';
import { fetchOHLCVData } from './fetch-ohlcv';
import { env } from '../env';
import { getLatestTimesForAllSymbols, persistOHLCVInBatches } from '../persistence/db';
import { parseOHLCVData } from '../parsing/ohlcv';

export type MarketType = "spot" | "swap";

const formatUnixDatetimeForCCXT = (date: number) => new Date(date).toISOString().replace("T", ' ')

const defaultQuoteFilter = (markets: ccxt.Market[]) => {
   return markets.filter((el) => {

    const interestedQuoteCurrencies = ['USD','USDT', 'USDC','EUR','EURI']
    const interestedFuturesSettlementCurrencies = ['USD','USDC','USDT','EUR']
    
    //for futures the settlement should be in those pairs
    if(el?.type === 'swap' && (el?.settle == null || !interestedFuturesSettlementCurrencies.includes(el?.settle))){
      return false
    }

    if(!el?.quote || !interestedQuoteCurrencies.includes(el.quote)){
      return false
    }

    return true
  })
}

const defaultMarketsFilter = (markets: ccxt.Market[]) => {
  return markets.filter((el) => {
    //swap is perp futures, "futures" is with expiry
    const interestedMarkets = env.MARKET_TYPES;

    if (el?.type == null) {
      console.log(
        "Market type was not specified for",
        el?.symbol,
        "skipping..."
      );
      return false;
    }

    if (
      !interestedMarkets.includes(el.type) ||
      (el?.future === false && el?.swap === false && el?.contract === false)
    ) {
      return false;
    }
    if(el?.active === false){
      return false
    }
    return true
  })
}

export async function fetchExchangeOHLCV(exchangeName: string, options: {
  marketsFilter?: (markets: ccxt.Market[]) =>  ccxt.Market[]
  quoteFilter?: (markets: ccxt.Market[]) =>  ccxt.Market[]
} = {}){

  const marketsFilter = options.marketsFilter || defaultMarketsFilter
  const quoteFilter = options.quoteFilter || defaultQuoteFilter

  // Initialize exchange
  const ExchangeClass = ccxt[exchangeName as keyof typeof ccxt] as any;
  if (!ExchangeClass || typeof ExchangeClass !== 'function') {
      throw new Error(`Exchange '${exchangeName}' is not supported`);
  }
  const exchange: ccxt.Exchange = new ExchangeClass();

  if(!exchange.has.fetchOHLCV){
    console.log(`Exchange ${exchangeName} does not support fetchOHLCV`)
  }

  if(!Object.keys(exchange.timeframes).includes('1m')){
    console.log(`${exchange.id} does not support 1-minute candles.`)
  }

  try {

  const markets = await exchange.loadMarkets()

  if(markets == null){
    console.error(`Unable to load markets for ${markets}`)
  }


  const marketsArr: ccxt.Market[] = Object.values(markets) as unknown as ccxt.Market[]

  const filteredMarkets = marketsFilter(quoteFilter(marketsArr))

  // const symbols
  const symbols = filteredMarkets.map(el => el?.symbol).filter(Boolean) as string[]

  const latestSpotSymbolsTime = await getLatestTimesForAllSymbols(symbols, exchangeName, 'swap')
  const latestPerpSymbolsTime = await getLatestTimesForAllSymbols(symbols, exchangeName, 'spot')

  for(let i = 0; i< symbols.length;i++){
    const symbol = symbols[i]
    const type = markets[symbol]?.type as MarketType
    if (!type) {
      console.warn(`No type found for symbol ${symbol}, skipping...`)
      continue
    }

    const latestTime = type === 'spot' ? latestSpotSymbolsTime.get(symbol) : latestPerpSymbolsTime.get(symbol)

    const from = latestTime != null ? formatUnixDatetimeForCCXT(latestTime) : formatUnixDatetimeForCCXT(Date.now() - env.HISTORICAL_DATA_TO_KEEP_MS)

    const rawOhlcvData = await fetchOHLCVData(exchange, symbol, '1m', from)
    const ohlcvData =  parseOHLCVData(rawOhlcvData, symbol)

    await persistOHLCVInBatches(ohlcvData, exchangeName, type)

    console.log(`[${i+1}/${symbols.length}] (${exchangeName}) Sraped ${symbol} with ${ohlcvData.length} datapoints`)
  }

  } catch(err){
    console.error(err)
  } finally {
        // Clean up exchange connection if needed
        if (exchange.close) {
            await exchange.close();
        }
    }
  }