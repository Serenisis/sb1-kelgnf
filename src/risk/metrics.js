import { InfluxDB } from 'influx';
import { logger } from '../utils/logger.js';

export class RiskMetricsCalculator {
  constructor() {
    this.influx = new InfluxDB({
      host: process.env.INFLUX_HOST,
      database: 'trading_metrics',
      schema: [
        {
          measurement: 'risk_metrics',
          fields: {
            var: 'float',
            cvar: 'float',
            expectedShortfall: 'float',
            drawdown: 'float',
            stressTestLoss: 'float'
          },
          tags: ['strategy', 'symbol', 'timeframe']
        }
      ]
    });
  }

  async calculateRealTimeMetrics(returns, position) {
    const metrics = {
      var: this.calculateVaR(returns, 0.95),
      cvar: this.calculateCVaR(returns, 0.95),
      expectedShortfall: this.calculateExpectedShortfall(returns),
      drawdown: this.calculateDrawdown(position),
      stressTestLoss: await this.runStressTest(position)
    };

    await this.storeMetrics(metrics);
    return metrics;
  }

  calculateVaR(returns, confidence) {
    const sorted = returns.sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * returns.length);
    return -sorted[index];
  }

  calculateCVaR(returns, confidence) {
    const var95 = this.calculateVaR(returns, confidence);
    const tailLosses = returns.filter(r => r <= -var95);
    return -(tailLosses.reduce((a, b) => a + b, 0) / tailLosses.length);
  }

  async runStressTest(position) {
    const scenarios = [
      { name: 'market_crash', shock: -0.15 },
      { name: 'volatility_spike', volMultiplier: 2.5 },
      { name: 'liquidity_crisis', slippage: 0.05 }
    ];

    const losses = await Promise.all(
      scenarios.map(scenario => this.simulateScenario(position, scenario))
    );

    return Math.max(...losses);
  }

  async storeMetrics(metrics) {
    try {
      await this.influx.writePoints([
        {
          measurement: 'risk_metrics',
          tags: {
            strategy: process.env.STRATEGY_NAME,
            symbol: process.env.TRADING_PAIR,
            timeframe: process.env.TIMEFRAME
          },
          fields: metrics
        }
      ]);
    } catch (error) {
      logger.error('Failed to store risk metrics:', error);
    }
  }
}