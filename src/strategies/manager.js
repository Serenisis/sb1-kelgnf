import { TrendFollowing } from './trend.js';
import { MeanReversion } from './mean-reversion.js';
import { Scalping } from './scalping.js';
import { logger } from '../utils/logger.js';

export class StrategyManager {
  constructor(enabledStrategies) {
    this.strategies = new Map();
    
    if (enabledStrategies.includes('trend')) {
      this.strategies.set('trend', new TrendFollowing());
    }
    if (enabledStrategies.includes('meanReversion')) {
      this.strategies.set('meanReversion', new MeanReversion());
    }
    if (enabledStrategies.includes('scalping')) {
      this.strategies.set('scalping', new Scalping());
    }
  }

  async start() {
    logger.info('Starting strategy execution...');
    for (const [name, strategy] of this.strategies) {
      await strategy.start();
      logger.info(`Strategy ${name} started`);
    }
  }

  async stop() {
    for (const [name, strategy] of this.strategies) {
      await strategy.stop();
      logger.info(`Strategy ${name} stopped`);
    }
  }
}