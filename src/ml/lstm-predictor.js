import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../utils/logger.js';

export class LSTMPredictor {
  constructor(config) {
    this.config = {
      sequenceLength: config.sequenceLength || 60,
      features: config.features || 5,
      batchSize: config.batchSize || 32,
      epochs: config.epochs || 100,
      learningRate: config.learningRate || 0.001
    };
    
    this.model = null;
    this.optimizer = null;
    this.scaler = null;
  }

  async buildModel() {
    this.model = tf.sequential();

    // Multi-layer LSTM architecture
    this.model.add(tf.layers.lstm({
      units: 128,
      returnSequences: true,
      inputShape: [this.config.sequenceLength, this.config.features]
    }));

    this.model.add(tf.layers.dropout(0.2));

    this.model.add(tf.layers.lstm({
      units: 64,
      returnSequences: false
    }));

    this.model.add(tf.layers.dense({
      units: 32,
      activation: 'relu'
    }));

    this.model.add(tf.layers.dense({
      units: 1,
      activation: 'linear'
    }));

    // Custom learning rate scheduler
    const learningRateScheduler = (epoch) => {
      return this.config.learningRate * Math.pow(0.95, Math.floor(epoch / 10));
    };

    this.optimizer = tf.train.adam(learningRateScheduler(0));

    this.model.compile({
      optimizer: this.optimizer,
      loss: 'meanSquaredError',
      metrics: ['mse', 'mae']
    });

    return this.model;
  }

  preprocessFeatures(data) {
    // Normalize features using z-score standardization
    const mean = tf.mean(data, 0);
    const std = tf.std(data, 0);
    return data.sub(mean).div(std);
  }

  async train(data, validation) {
    const { features, labels } = await this.prepareTrainingData(data);
    const { features: valFeatures, labels: valLabels } = 
      await this.prepareTrainingData(validation);

    const history = await this.model.fit(features, labels, {
      epochs: this.config.epochs,
      batchSize: this.config.batchSize,
      validationData: [valFeatures, valLabels],
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          const lr = await this.optimizer.learningRate.read();
          logger.info(
            `Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(6)}, ` +
            `val_loss = ${logs.val_loss.toFixed(6)}, ` +
            `lr = ${lr.toFixed(6)}`
          );
        }
      }
    });

    return history;
  }

  async predict(sequence) {
    const tensor = tf.tensor3d([sequence]);
    const normalized = this.preprocessFeatures(tensor);
    const prediction = await this.model.predict(normalized);
    return prediction.dataSync()[0];
  }
}