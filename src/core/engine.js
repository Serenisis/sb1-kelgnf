import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { StrategyManager } from '../strategies/manager.js';
import { OrderManager } from '../orders/manager.js';

export class TradingEngine extends EventEmitter {
  constructor(config) {
    super();
    this.exchanges = config.exchanges;
    this.riskManager = config.riskManager;
    this.pairs = config.pairs;
    this.isRunning = false;
    
    this.strategyManager = new StrategyManager(config.strategies);
    this.orderManager = new OrderManager(this.exchanges);
  }

  async start() {
    try {
      this.isRunning = true;
      logger.info('Starting trading engine...');
      
      // Initialize market data streams
      await this.setupMarketDataStreams();
      
      // Start strategy execution
      await this.strategyManager.start();
      
      logger.info('Trading engine started successfully');
    } catch (error) {
      logger.error('Failed to start trading engine:', error);
      throw error;
    }
  }

  async stop() {
    this.isRunning = false;
    await this.strategyManager.stop();
    await this.orderManager.cancelAllOrders();
    logger.info('Trading engine stopped');
  }

  async setupMarketDataStreams() {
    for (const exchange of Object.values(this.exchanges)) {
      for (const pair of this.pairs) {
        if (exchange.has.ws) {
          await exchange.watchOrderBook(pair);
          await exchange.watchTrades(pair);
        }
      }
    }
  }
}