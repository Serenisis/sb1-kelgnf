import { MonteCarloSimulator } from '../simulation/monte-carlo.js';
import { RiskMetricsCalculator } from '../risk/metrics.js';
import { LSTMPredictor } from '../ml/lstm-predictor.js';
import { logger } from '../utils/logger.js';

export class IntegratedTradingSystem {
  constructor(config) {
    this.simulator = new MonteCarloSimulator(config.simulation);
    this.riskCalculator = new RiskMetricsCalculator();
    this.predictor = new LSTMPredictor(config.lstm);
    
    this.websocket = null;
    this.positions = new Map();
  }

  async initialize() {
    await this.predictor.buildModel();
    await this.setupWebSocket();
    await this.startMetricsStream();
  }

  async processMarketData(data) {
    try {
      // Parallel processing of different components
      const [prediction, riskMetrics, simulation] = await Promise.all([
        this.predictor.predict(data.sequence),
        this.riskCalculator.calculateRealTimeMetrics(data.returns, this.positions),
        this.simulator.simulateReturns(data.returns)
      ]);

      const signal = this.generateTradeSignal(prediction, riskMetrics, simulation);
      
      if (signal) {
        await this.executeTradeSignal(signal);
      }
    } catch (error) {
      logger.error('Error processing market data:', error);
    }
  }

  async setupWebSocket() {
    // WebSocket implementation for real-time data
    this.websocket = new WebSocket(process.env.MARKET_DATA_WS_URL);
    
    this.websocket.on('message', async (data) => {
      const parsed = JSON.parse(data);
      await this.processMarketData(parsed);
    });
  }

  generateTradeSignal(prediction, riskMetrics, simulation) {
    if (riskMetrics.var > this.config.maxVaR ||
        riskMetrics.drawdown > this.config.maxDrawdown) {
      return null;
    }

    const confidence = simulation.confidenceIntervals;
    const signal = {
      type: prediction > 0 ? 'LONG' : 'SHORT',
      size: this.calculatePositionSize(riskMetrics),
      confidence: confidence
    };

    return this.validateSignal(signal) ? signal : null;
  }
}