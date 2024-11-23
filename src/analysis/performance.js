import { logger } from '../utils/logger.js';
import { InfluxDB } from 'influx';

export class PerformanceAnalyzer {
  constructor() {
    this.influx = new InfluxDB({
      host: process.env.INFLUX_HOST,
      database: 'trading_metrics'
    });
  }

  async calculateMetrics(results) {
    const metrics = {
      sharpeRatio: this.calculateSharpeRatio(results.equity),
      maxDrawdown: this.calculateMaxDrawdown(results.equity),
      winRate: this.calculateWinRate(results.trades),
      profitFactor: this.calculateProfitFactor(results.trades),
      calmarRatio: this.calculateCalmarRatio(results.equity),
      sortinoRatio: this.calculateSortinoRatio(results.equity)
    };

    await this.storeMetrics(metrics);
    return metrics;
  }

  calculateSharpeRatio(equity) {
    const returns = this.calculateReturns(equity);
    const avgReturn = returns.reduce((a, b) => a + b) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sq, n) => sq + Math.pow(n - avgReturn, 2), 0) / 
      (returns.length - 1)
    );
    
    return (avgReturn / stdDev) * Math.sqrt(252); // Annualized
  }

  calculateMaxDrawdown(equity) {
    let peak = equity[0];
    let maxDrawdown = 0;

    for (const value of equity) {
      if (value > peak) peak = value;
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return maxDrawdown;
  }

  calculateCalmarRatio(equity) {
    const annualizedReturn = this.calculateAnnualizedReturn(equity);
    const maxDrawdown = this.calculateMaxDrawdown(equity);
    return annualizedReturn / maxDrawdown;
  }

  calculateSortinoRatio(equity) {
    const returns = this.calculateReturns(equity);
    const negativeReturns = returns.filter(r => r < 0);
    const downside = Math.sqrt(
      negativeReturns.reduce((sq, n) => sq + Math.pow(n, 2), 0) / 
      negativeReturns.length
    );
    
    return (returns.reduce((a, b) => a + b) / returns.length) / downside;
  }

  async storeMetrics(metrics) {
    try {
      await this.influx.writePoints([
        {
          measurement: 'trading_performance',
          tags: { version: process.env.VERSION },
          fields: metrics
        }
      ]);
    } catch (error) {
      logger.error('Failed to store metrics:', error);
    }
  }
}