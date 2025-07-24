import ccxt from 'ccxt';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import config from './config';

type okx = InstanceType<typeof ccxt.okx>;
type binance = InstanceType<typeof ccxt.binance>;

type Exchange = okx | binance;

export class DataFetcher {
  private exchange: Exchange;

  constructor(exchangeId: string) {
    const exchangeConfig: any = {
      enableRateLimit: true,
      timeout: 30000, // 30 seconds timeout
    };

    // Set proxy if proxy URL is configured
    if (config.proxyUrl) {
      logger.info(`Using proxy URL: ${config.proxyUrl}`);
      // Use ccxt built-in proxy support
      exchangeConfig.httpProxy = config.proxyUrl;
    } else {
      logger.info('No proxy URL configured');
    }

    // Dynamically create exchange instance
    if (ccxt.exchanges.includes(exchangeId)) {
      this.exchange = new (ccxt as any)[exchangeId](exchangeConfig);
      logger.debug(`${exchangeId} exchange instance created successfully`);
    } else {
      throw new Error(`Exchange ${exchangeId} is not supported by ccxt`);
    }
  }

  /**
   * Get historical daily data for a given symbol from the beginning of trading
   * @param symbol Trading pair symbol
   * @param since Start time (milliseconds)
   * @param limit Limit number of data points per request (default: 100)
   */
  public async fetchSymbolData(symbol: string, since?: number, limit: number = 100): Promise<any[]> {
    try {
      logger.info(`Starting to fetch all historical daily data for ${symbol} from ${this.exchange.id} exchange`);

      // Check exchange connection
      logger.debug('Loading exchange market data');
      const markets = await this.exchange.loadMarkets();
      logger.debug(`Exchange has ${Object.keys(markets).length} trading pairs`);

      // Check if symbol exists
      if (!markets[symbol]) {
        // Try to find symbol with different separators
        const symbolVariants = [
          symbol,
          symbol.replace('/', '-'),
          symbol.replace('/', '_')
        ];

        const foundSymbol = symbolVariants.find(variant => markets[variant]);
        if (foundSymbol) {
          logger.info(`Found symbol variant: ${foundSymbol}`);
          symbol = foundSymbol;
        } else {
          logger.warn(`${symbol} trading pair not found in exchange`);
          return [];
        }
      }

      logger.info(`Using trading pair symbol: ${symbol}`);

      // If since is not provided, start from a reasonable date
      const startDate = since || new Date('2020-01-01').getTime();
      logger.info(`Fetching data starting from: ${new Date(startDate).toISOString().split('T')[0]}`);

      const allData: any[] = [];
      let currentSince = startDate;
      let totalRequests = 0;

      while (true) {
        totalRequests++;
        logger.debug(`Fetching data batch #${totalRequests}, since: ${new Date(currentSince).toISOString().split('T')[0]}, limit: ${limit}`);

        // Add delay between requests to avoid rate limiting
        if (totalRequests > 1) {
          // Wait for 1 second between requests
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const ohlcv = await this.exchange.fetchOHLCV(symbol, '1d', currentSince, limit);
        logger.debug(`Received ${ohlcv.length} data points in batch #${totalRequests}`);

        if (ohlcv.length === 0) {
          // No more data available
          logger.info('No more data available, breaking loop');
          break;
        }

        // Add new data to allData
        allData.push(...ohlcv);

        // Update currentSince to the timestamp of the last data point plus 1 millisecond
        const lastEntry = ohlcv[ohlcv.length - 1];
        if (lastEntry && Array.isArray(lastEntry) && lastEntry.length > 0) {
          const lastTimestamp = lastEntry[0];
          if (typeof lastTimestamp === 'number') {
            currentSince = lastTimestamp + 1;
          } else {
            logger.warn('Invalid timestamp in last data entry, breaking loop');
            break;
          }
        } else {
          logger.warn('Invalid last entry format, breaking loop');
          break;
        }

        // If we got less data than the limit, we've reached the end
        if (ohlcv.length < limit) {
          logger.info(`Received less data (${ohlcv.length}) than limit (${limit}), breaking loop`);
          break;
        }
      }

      logger.info(`Successfully fetched all data: ${allData.length} data points in ${totalRequests} requests`);

      return allData;
    } catch (error: any) {
      logger.error('Failed to fetch data', {
        message: error.message || 'Unknown error',
        stack: error.stack || 'No stack trace',
        name: error.constructor?.name || 'Unknown error type'
      });

      // Record ccxt specific error information if available
      if (error.constructor?.name) {
        logger.error(`Error type: ${error.constructor.name}`);
      }

      // Record more information about network errors
      if (error.constructor?.name === 'NetworkError') {
        logger.error('Network error, possibly due to proxy configuration issues or network connectivity problems');
      }

      // Handle rate limiting errors
      if (error.constructor?.name === 'DDoSProtection' ||
        error.constructor?.name === 'RateLimitExceeded' ||
        (error.message && (error.message.includes('rate limit') || error.message.includes('Rate limit')))) {
        logger.error('Rate limit exceeded. Consider increasing delay between requests.');
      }

      throw error;
    }
  }

  /**
   * Write data to CSV file
   * @param data OHLCV data
   * @param exchangeId Exchange identifier
   * @param symbol Trading pair symbol
   * @param filePath File path
   */
  public async writeDataToCSV(data: any[], exchangeId: string, symbol: string, filePath?: string): Promise<void> {
    try {
      // Generate file path if not provided
      if (!filePath) {
        // Replace problematic characters in symbol for file naming
        const cleanSymbol = symbol.replace('/', '-').replace('\\', '-');
        filePath = `./data/${exchangeId}_${cleanSymbol}_daily.csv`;
      }

      logger.info(`Starting to write data to CSV file: ${filePath}`);

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // CSV header
      let csvContent = 'timestamp,open,high,low,close,volume\n';

      // Add data rows
      for (const item of data) {
        const [timestamp, open, high, low, close, volume] = item;
        // Format date as YYYY-MM-DD
        const date = new Date(timestamp);
        const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        csvContent += `"${formattedDate}",${open},${high},${low},${close},${volume}\n`;
      }

      // Write to file
      fs.writeFileSync(filePath, csvContent, 'utf8');
      logger.info(`Data successfully written to CSV file: ${filePath}, wrote ${data.length} rows`);
    } catch (error: any) {
      logger.error('Failed to write CSV file', {
        message: error.message || 'Unknown error',
        stack: error.stack || 'No stack trace'
      });
      throw error;
    }
  }
}