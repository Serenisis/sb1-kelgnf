import { HistoricalDataProvider } from './data-provider.js';
import { BacktestStrategy } from './strategy.js';
import { PerformanceAnalyzer } from '../analysis/performance.js';
import { logger } from '../utils/logger.js';

export class BacktestEngine {
  constructor(config) {
    this.dataProvider = new HistoricalDataProvider();
    this.strategy = new BacktestStrategy(config.strategy);
    this.analyzer = new PerformanceAnalyzer();
    this.slippageModel = this.createSlippageModel(config.slippage);
    this.transactionCosts = config.transactionCosts;
  }

  async runBacktest(startDate, endDate, instruments) {
    logger.info('Starting backtest simulation...');
    
    const results = {
      trades: [],
      metrics: {},
      equity: []
    };

    for (const instrument of instruments) {
      const historicalData = await this.dataProvider.fetchData(
        instrument, 
        startDate, 
        endDate
      );

      for (const candle of historicalData) {
        const signal = await this.strategy.analyze(candle);
        
        if (signal) {
          const slippage = this.calculateSlippage(signal, candle);
          const costs = this.calculateTransactionCosts(signal);
          const trade = this.executeTrade(signal, slippage, costs);
          
          results.trades.push(trade);
          results.equity.push(this.calculateEquity());
        }
      }
    }

    results.metrics = await this.analyzer.calculateMetrics(results);
    return results;
  }

  calculateSlippage(signal, candle) {
    const volume = candle.volume;
    const volatility = this.calculateVolatility(candle);
    return this.slippageModel.estimate(signal.size, volume, volatility);
  }

  calculateTransactionCosts(signal) {
    return {
      commission: signal.size * this.transactionCosts.commission,
      spread: Math.abs(signal.price * this.transactionCosts.spread)
    };
  }

  createSlippageModel(config) {
    return {
      estimate: (size, volume, volatility) => {
        // Advanced slippage model considering market impact
        const marketImpact = Math.pow(size / volume, 0.5);
        const volatilityImpact = volatility * config.volatilityFactor;
        return marketImpact * volatilityImpact;
      }
    };
  }

  calculateVolatility(candle) {
    // Implement advanced volatility calculation
    return Math.abs(candle.high - candle.low) / candle.close;
  }
}