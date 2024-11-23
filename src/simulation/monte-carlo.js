import { logger } from '../utils/logger.js';

export class MonteCarloSimulator {
  constructor(config) {
    this.iterations = config.iterations || 10000;
    this.confidenceLevel = config.confidenceLevel || 0.95;
    this.windowSize = config.windowSize || 252; // Trading days
  }

  generateNormalRandom() {
    // Box-Muller transform implementation
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0;
  }

  async simulateReturns(historicalReturns) {
    const { mean, stdDev } = this.estimateParameters(historicalReturns);
    const simulations = [];

    for (let i = 0; i < this.iterations; i++) {
      const path = this.generatePath(mean, stdDev);
      const metrics = this.calculatePathMetrics(path);
      simulations.push(metrics);
    }

    return this.aggregateResults(simulations);
  }

  estimateParameters(returns) {
    // Maximum Likelihood Estimation for normal distribution
    const mean = returns.reduce((a, b) => a + b) / returns.length;
    const variance = returns.reduce((sq, n) => 
      sq + Math.pow(n - mean, 2), 0) / (returns.length - 1);

    return {
      mean,
      stdDev: Math.sqrt(variance)
    };
  }

  generatePath(mean, stdDev) {
    const path = [];
    let currentValue = 100; // Starting value

    for (let i = 0; i < this.windowSize; i++) {
      const randomReturn = this.generateNormalRandom() * stdDev + mean;
      currentValue *= Math.exp(randomReturn);
      path.push(currentValue);
    }

    return path;
  }

  calculatePathMetrics(path) {
    const returns = [];
    for (let i = 1; i < path.length; i++) {
      returns.push((path[i] - path[i-1]) / path[i-1]);
    }

    return {
      finalValue: path[path.length - 1],
      maxDrawdown: this.calculateMaxDrawdown(path),
      volatility: this.calculateVolatility(returns),
      returns
    };
  }

  calculateConfidenceIntervals(simulations) {
    const sorted = simulations.map(s => s.finalValue).sort((a, b) => a - b);
    const lowerIdx = Math.floor((1 - this.confidenceLevel) * this.iterations);
    const upperIdx = Math.floor(this.confidenceLevel * this.iterations);

    return {
      lower: sorted[lowerIdx],
      upper: sorted[upperIdx]
    };
  }
}