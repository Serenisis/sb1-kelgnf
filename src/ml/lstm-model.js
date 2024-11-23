import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../utils/logger.js';

export class LSTMPricePredictor {
  constructor(config) {
    this.config = {
      sequenceLength: config.sequenceLength || 60,
      features: config.features || 5,
      hiddenUnits: config.hiddenUnits || 50,
      epochs: config.epochs || 100,
      batchSize: config.batchSize || 32
    };
    
    this.model = null;
    this.scaler = null;
  }

  async buildModel() {
    this.model = tf.sequential();

    // Input LSTM layer
    this.model.add(tf.layers.lstm({
      units: this.config.hiddenUnits,
      returnSequences: true,
      inputShape: [this.config.sequenceLength, this.config.features]
    }));

    // Additional LSTM layers
    this.model.add(tf.layers.lstm({
      units: Math.floor(this.config.hiddenUnits / 2),
      returnSequences: false
    }));

    // Dense output layers
    this.model.add(tf.layers.dense({
      units: Math.floor(this.config.hiddenUnits / 4),
      activation: 'relu'
    }));

    this.model.add(tf.layers.dense({
      units: 1,
      activation: 'linear'
    }));

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mse']
    });

    return this.model;
  }

  async train(data) {
    const { features, labels } = this.preprocessData(data);
    
    const history = await this.model.fit(features, labels, {
      epochs: this.config.epochs,
      batchSize: this.config.batchSize,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          logger.info(
            `Epoch ${epoch + 1}/${this.config.epochs}, ` +
            `Loss: ${logs.loss.toFixed(4)}, ` +
            `Val Loss: ${logs.val_loss.toFixed(4)}`
          );
        }
      }
    });

    return history;
  }

  preprocessData(data) {
    const sequences = [];
    const targets = [];

    for (let i = 0; i < data.length - this.config.sequenceLength; i++) {
      sequences.push(data.slice(i, i + this.config.sequenceLength));
      targets.push(data[i + this.config.sequenceLength].close);
    }

    return {
      features: tf.tensor3d(sequences),
      labels: tf.tensor2d(targets.map(t => [t]))
    };
  }

  async predict(sequence) {
    const tensor = tf.tensor3d([sequence]);
    const prediction = await this.model.predict(tensor);
    return prediction.dataSync()[0];
  }
}