import { HttpProxyAgent } from 'http-proxy-agent';
import https from 'https';
import http from 'http';
import { logger } from './modules/logger';
import config from './modules/config';

async function testProxy() {
  try {
    logger.info('Starting proxy connection test');
    
    if (!config.proxyUrl) {
      logger.warn('No proxy URL configured');
      return;
    }
    
    logger.info(`Testing proxy URL: ${config.proxyUrl}`);
    
    const agent = new HttpProxyAgent(config.proxyUrl);
    
    // Test connection to OKX API
    const options = {
      hostname: 'www.okx.com',
      port: 443,
      path: '/api/v5/market/tickers',
      method: 'GET',
      agent: agent
    };
    
    const req = https.request(options, (res) => {
      logger.info(`Response status code: ${res.statusCode}`);
      res.on('data', (chunk) => {
        logger.info(`Received data: ${chunk.length} bytes`);
      });
      res.on('end', () => {
        logger.info('Request completed');
      });
    });
    
    req.on('error', (error) => {
      logger.error('Request failed', error);
    });
    
    req.end();
  } catch (error) {
    logger.error('Error occurred during testing', error);
  }
}

testProxy();