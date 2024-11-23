import { TechnicalIndicators } from '../indicators/index.js';
import { logger } from '../utils/logger.js';

export class TechnicalStrategy {
  constructor(config) {
    this.indicators = new TechnicalIndicators();
    this.config = config;
    this.state = {
      position: null,
      signals: []
    };
  }

  async analyze(candle) {
    try {
      const indicators = await this.calculateIndicators(candle);
      const signal = this.generateSignal(indicators);
      
      if (signal) {
        signal.timestamp = candle.timestamp;
        signal.price = candle.close;
        this.state.signals.push(signal);
        
        return this.validateSignal(signal) ? signal : null;
      }
    } catch (error) {
      logger.error('Error in technical analysis:', error);
      return null;
    }
  }

  async calculateIndicators(candle) {
    return {
      rsi: await this.indicators.calculateRSI(candle),
      macd: await this.indicators.calculateMACD(candle),
      bollinger: await this.indicators.calculateBollingerBands(candle),
      atr: await this.indicators.calculateATR(candle)
    };
  }

  generateSignal(indicators) {
    if (this.isBullishSetup(indicators)) {
      return {
        type: 'LONG',
        strength: this.calculateSignalStrength(indicators),
        stopLoss: this.calculateStopLoss(indicators, 'LONG'),
        takeProfit: this.calculateTakeProfit(indicators, 'LONG')
      };
    }
    
    if (this.isBearishSetup(indicators)) {
      return {
        type: 'SHORT',
        strength: this.calculateSignalStrength(indicators),
        stopLoss: this.calculateStopLoss(indicators, 'SHORT'),
        takeProfit: this.calculateTakeProfit(indicators, 'SHORT')
      };
    }

    return null;
  }

  isBullishSetup(indicators) {
    return (
      indicators.rsi < 30 &&
      indicators.macd.histogram > 0 &&
      indicators.bollinger.lower > indicators.price
    );
  }

  isBearishSetup(indicators) {
    return (
      indicators.rsi > 70 &&
      indicators.macd.histogram < 0 &&
      indicators.bollinger.upper < indicators.price
    );
  }

  calculateSignalStrength(indicators) {
    // Weighted scoring system for signal strength
    const rsiScore = Math.abs(50 - indicators.rsi) / 50;
    const macdScore = Math.abs(indicators.macd.histogram) / indicators.macd.signal;
    const bollingerScore = indicators.bollinger.percentB;
    
    return (rsiScore + macdScore + bollingerScore) / 3;
  }

  validateSignal(signal) {
    return (
      signal.strength > this.config.minSignalStrength &&
      this.isWithinTradingHours() &&
      this.checkCorrelations(signal)
    );
  }
}