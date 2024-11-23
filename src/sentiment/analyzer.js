import natural from 'natural';
import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';

export class SentimentAnalyzer {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.classifier = new natural.BayesClassifier();
  }

  async analyzeSentiment(text) {
    const tokens = this.tokenizer.tokenize(text);
    const sentiment = await this.classifier.classify(tokens);
    
    return {
      score: this.calculateSentimentScore(sentiment),
      confidence: this.classifier.getClassifications(tokens)[0].value,
      tokens: tokens
    };
  }

  async analyzeNews(symbol) {
    try {
      const news = await this.fetchNews(symbol);
      const sentiments = await Promise.all(
        news.map(item => this.analyzeSentiment(item.title + ' ' + item.description))
      );
      
      return this.aggregateSentiments(sentiments);
    } catch (error) {
      logger.error('News sentiment analysis failed:', error);
      return null;
    }
  }

  async analyzeSocialMedia(symbol) {
    try {
      const posts = await this.fetchSocialMediaPosts(symbol);
      const sentiments = await Promise.all(
        posts.map(post => this.analyzeSentiment(post.content))
      );
      
      return this.aggregateSentiments(sentiments);
    } catch (error) {
      logger.error('Social media sentiment analysis failed:', error);
      return null;
    }
  }

  aggregateSentiments(sentiments) {
    const scores = sentiments.map(s => s.score);
    
    return {
      average: scores.reduce((a, b) => a + b, 0) / scores.length,
      variance: this.calculateVariance(scores),
      trend: this.calculateTrend(scores)
    };
  }
}