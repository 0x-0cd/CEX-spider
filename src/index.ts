import { DataFetcher } from './modules/dataFetcher';
import { logger } from './modules/logger';
import config from './modules/config';

async function main() {
  try {
    logger.info('Starting data fetching task for configured exchanges and symbols');
    
    // Process each exchange
    for (const exchangeId of config.exchanges) {
      try {
        logger.info(`Processing exchange: ${exchangeId}`);
        
        // Create data fetcher instance for this exchange
        const fetcher = new DataFetcher(exchangeId);
        
        // Process each symbol for this exchange
        for (const symbol of config.symbols) {
          try {
            logger.info(`Processing symbol: ${symbol} on exchange: ${exchangeId}`);
            
            // Fetch historical daily data
            const data = await fetcher.fetchSymbolData(symbol);
            
            // Write data to CSV file
            await fetcher.writeDataToCSV(data, exchangeId, symbol);
          } catch (symbolError: any) {
            logger.error(`Error processing symbol ${symbol} on exchange ${exchangeId}`, {
              message: symbolError.message,
              stack: symbolError.stack
            });
            // Continue with next symbol
            continue;
          }
        }
      } catch (exchangeError: any) {
        logger.error(`Error processing exchange ${exchangeId}`, {
          message: exchangeError.message,
          stack: exchangeError.stack
        });
        // Continue with next exchange
        continue;
      }
    }
    
    logger.info('All data fetching tasks completed');
  } catch (error: any) {
    logger.error('Error occurred during execution', {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

main();