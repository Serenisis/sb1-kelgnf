import { config } from 'dotenv';
import { TradingEngine } from './core/engine.js';
import { RiskManager } from './risk/manager.js';
import { setupExchangeConnections } from './exchanges/setup.js';
import { logger } from './utils/logger.js';

// Load environment variables
config();

async function main() {
  try {
    // Initialize exchange connections
    const exchanges = await setupExchangeConnections();
    
    // Initialize risk manager
    const riskManager = new RiskManager({
      maxDrawdown: 0.10, // 10% maximum drawdown
      defaultPositionSize: 0.02, // 2% of portfolio per trade
      stopLossMultiplier: 2 // Dynamic stop-loss based on volatility
    });

    // Initialize trading engine
    const engine = new TradingEngine({
      exchanges,
      riskManager,
      pairs: ['BTC/USDT', 'ETH/USDT', 'EUR/USD'],
      strategies: ['trend', 'meanReversion', 'scalping']
    });

    // Start the trading engine
    await engine.start();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down trading engine...');
      await engine.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

main();