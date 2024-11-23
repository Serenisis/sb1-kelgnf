import { logger } from '../utils/logger.js';
import { InfluxDB } from 'influx';

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
            sharpe: 'float',
            sortino: 'float',
            maxDrawdown: 'float'
          },
          tags: ['strategy', 'timeframe']
        }
      ]
    });
  }

  async calculateVaR(returns, confidence = 0.95) {
    const sortedReturns = returns.sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * returns.length);
    const var95 = -sortedReturns[index];

    await this.storeMetric('var', var95);
    return var95;
  }

  async calculateCVaR(returns, confidence = 0.95) {
    const var95 = await this.calculateVaR(returns, confidence);
    const tailLosses = returns.filter(r => r <= -var95);
    const cvar = -(tailLosses.reduce((a, b) => a + b, 0) / tailLosses.length);

    await this.storeMetric('cvar', cvar);
    return cvar;
  }

  async storeMetric(name, value, tags = {}) {
    try {
      await this.influx.writePoints([
        {
          measurement: 'risk_metrics',
          tags: {
            ...tags,
            timestamp: new Date().toISOString()
          },
          fields: {
            [name]: value
          }
        }
      ]);
    } catch (error) {
      logger.error(`Failed to store ${name} metric:`, error);
    }
  }

  calculateVolatility(returns) {
    const mean = returns.reduce((a, b) => a + b) / returns.length;
    return Math.sqrt(
      returns.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / 
      (returns.length - 1)
    );
  }
}