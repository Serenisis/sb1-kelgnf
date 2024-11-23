import { logger } from '../utils/logger.js';

export class MonteCarloSimulator {
  constructor(config) {
    this.iterations = config.iterations || 1000;
    this.confidenceLevel = config.confidenceLevel || 0.95;
    this.timeHorizon = config.timeHorizon || 252; // Trading days
  }

  async simulateReturns(strategy, historicalData) {
    const simulations = [];
    const baseEquityCurve = await strategy.backtest(historicalData);

    for (let i = 0; i < this.iterations; i++) {
      const simulatedReturns = this.generateSimulatedReturns(
        baseEquityCurve,
        this.timeHorizon
      );
      simulations.push(this.calculateMetrics(simulatedReturns));
    }

    return this.aggregateResults(simulations);
  }

  generateSimulatedReturns(baseReturns, horizon) {
    const { mean, stdDev } = this.calculateDistributionParams(baseReturns);
    const simulatedReturns = [];

    for (let i = 0; i < horizon; i++) {
      const randomReturn = this.generateRandomReturn(mean, stdDev);
      simulatedReturns.push(randomReturn);
    }

    return simulatedReturns;
  }

  calculateDistributionParams(returns) {
    const mean = returns.reduce((a, b) => a + b) / returns.length;
    const variance = returns.reduce((sq, n) => 
      sq + Math.pow(n - mean, 2), 0) / (returns.length - 1);

    return {
      mean,
      stdDev: Math.sqrt(variance)
    };
  }

  generateRandomReturn(mean, stdDev) {
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + stdDev * z;
  }

  aggregateResults(simulations) {
    const sorted = simulations.sort((a, b) => a.finalValue - b.finalValue);
    const varIndex = Math.floor((1 - this.confidenceLevel) * simulations.length);
    
    return {
      var: sorted[varIndex].finalValue,
      cvar: this.calculateCVaR(sorted, varIndex),
      worstCase: sorted[0].finalValue,
      bestCase: sorted[sorted.length - 1].finalValue,
      median: sorted[Math.floor(sorted.length / 2)].finalValue
    };
  }

  calculateCVaR(sortedResults, varIndex) {
    const tailLosses = sortedResults.slice(0, varIndex);
    return tailLosses.reduce((sum, result) => 
      sum + result.finalValue, 0) / tailLosses.length;
  }
}