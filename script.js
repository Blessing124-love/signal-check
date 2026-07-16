// PIN Security
const DEFAULT_PIN = '1234';
let isUnlocked = false;

function checkPin() {
  const pinInput = document.getElementById('pinInput').value;
  const storedPin = localStorage.getItem('signalCheckPin') || DEFAULT_PIN;
  
  if (pinInput === storedPin) {
    isUnlocked = true;
    document.getElementById('pinScreen').classList.add('hidden');
    document.getElementById('appContent').classList.remove('hidden');
    document.getElementById('pinInput').value = '';
  } else {
    alert('Incorrect PIN');
    document.getElementById('pinInput').value = '';
  }
}

function logout() {
  isUnlocked = false;
  document.getElementById('pinScreen').classList.remove('hidden');
  document.getElementById('appContent').classList.add('hidden');
  document.getElementById('results').classList.add('hidden');
  document.getElementById('pinInput').value = '';
}

// API Keys Management
function saveApiKeys() {
  const alphaVantageKey = document.getElementById('alphaVantageKey').value;
  const newsApiKey = document.getElementById('newsApiKey').value;
  const geminiKey = document.getElementById('geminiKey').value;
  
  if (alphaVantageKey && newsApiKey && geminiKey) {
    localStorage.setItem('alphaVantageKey', alphaVantageKey);
    localStorage.setItem('newsApiKey', newsApiKey);
    localStorage.setItem('geminiKey', geminiKey);
    alert('API keys saved locally on your device');
  } else {
    alert('Please fill in all API keys');
  }
}

function getApiKeys() {
  return {
    alphaVantage: localStorage.getItem('alphaVantageKey'),
    newsApi: localStorage.getItem('newsApiKey'),
    gemini: localStorage.getItem('geminiKey')
  };
}

// Stock Analysis
async function searchStock() {
  const ticker = document.getElementById('tickerInput').value.toUpperCase();
  if (!ticker) {
    alert('Please enter a ticker');
    return;
  }
  
  const keys = getApiKeys();
  if (!keys.alphaVantage || !keys.newsApi) {
    alert('Please add API keys first');
    return;
  }
  
  try {
    // Fetch stock data
    const stockData = await fetchStockData(ticker, keys.alphaVantage);
    if (!stockData) return;
    
    // Fetch news
    const news = await fetchNews(ticker, keys.newsApi);
    
    // Calculate signals
    const trend = calculateTrend(stockData);
    const rsi = calculateRSI(stockData);
    const sentiment = calculateSentiment(news);
    
    // Display results
    displayResults(ticker, stockData, trend, rsi, sentiment, news);
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error fetching data. Check your API keys and try again.');
  }
}

async function fetchStockData(ticker, apiKey) {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data['Error Message']) {
      alert('Ticker not found');
      return null;
    }
    
    if (!data['Time Series (Daily)']) {
      alert('Unable to fetch data. Check your API key.');
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}

async function fetchNews(ticker, apiKey) {
  const url = `https://newsapi.org/v2/everything?q=${ticker}&sortBy=publishedAt&language=en&pageSize=10&apiKey=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.articles || [];
  } catch (error) {
    console.error('News fetch error:', error);
    return [];
  }
}

function calculateTrend(stockData) {
  const timeSeries = stockData['Time Series (Daily)'];
  const dates = Object.keys(timeSeries).sort().reverse();
  
  // Calculate 20 and 50 day moving averages
  const prices20 = dates.slice(0, 20).map(d => parseFloat(timeSeries[d]['4. close']));
  const prices50 = dates.slice(0, 50).map(d => parseFloat(timeSeries[d]['4. close']));
  
  const ma20 = prices20.reduce((a, b) => a + b) / prices20.length;
  const ma50 = prices50.reduce((a, b) => a + b) / prices50.length;
  const currentPrice = prices20[0];
  
  return {
    current: currentPrice,
    ma20: ma20,
    ma50: ma50,
    signal: currentPrice > ma20 && ma20 > ma50 ? 'positive' : currentPrice < ma20 && ma20 < ma50 ? 'negative' : 'neutral'
  };
}

function calculateRSI(stockData) {
  const timeSeries = stockData['Time Series (Daily)'];
  const dates = Object.keys(timeSeries).sort().reverse();
  const prices = dates.slice(0, 14).map(d => parseFloat(timeSeries[d]['4. close'])).reverse();
  
  let gains = 0, losses = 0;
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  let signal = 'neutral';
  if (rsi > 70) signal = 'negative'; // Overbought
  if (rsi < 30) signal = 'positive'; // Oversold
  
  return {
    value: rsi.toFixed(2),
    signal: signal
  };
}

function calculateSentiment(news) {
  if (!news.length) return { positive: 0, negative: 0, neutral: 0, signal: 'neutral' };
  
  let sentiments = { positive: 0, negative: 0, neutral: 0 };
  
  const positiveWords = ['gain', 'surge', 'jump', 'beat', 'rally', 'soar', 'growth', 'profit', 'bull', 'strong'];
  const negativeWords = ['fall', 'drop', 'plunge', 'miss', 'loss', 'decline', 'bear', 'weak', 'crash', 'slump'];
  
  news.forEach(article => {
    const text = (article.title + ' ' + article.description).toLowerCase();
    const posCount = positiveWords.filter(word => text.includes(word)).length;
    const negCount = negativeWords.filter(word => text.includes(word)).length;
    
    if (posCount > negCount) sentiments.positive++;
    else if (negCount > posCount) sentiments.negative++;
    else sentiments.neutral++;
  });
  
  const dominant = sentiments.positive > sentiments.negative ? 'positive' : sentiments.negative > sentiments.positive ? 'negative' : 'neutral';
  
  return { ...sentiments, signal: dominant };
}

function displayResults(ticker, stockData, trend, rsi, sentiment, news) {
  document.getElementById('results').classList.remove('hidden');
  
  // Stock header
  document.getElementById('stockName').textContent = ticker;
  document.getElementById('stockPrice').textContent = `$${trend.current.toFixed(2)}`;
  
  // Trend signal
  const trendEmoji = trend.signal === 'positive' ? '📈' : trend.signal === 'negative' ? '📉' : '↔️';
  document.getElementById('trendSignal').textContent = trendEmoji;
  document.getElementById('trendSignal').className = `signal-value ${trend.signal}`;
  document.getElementById('trendDetails').textContent = `MA20: $${trend.ma20.toFixed(2)} | MA50: $${trend.ma50.toFixed(2)}`;
  
  // Momentum signal
  const momentumEmoji = rsi.signal === 'positive' ? '🚀' : rsi.signal === 'negative' ? '⚠️' : '⚡';
  document.getElementById('momentumSignal').textContent = momentumEmoji;
  document.getElementById('momentumSignal').className = `signal-value ${rsi.signal}`;
  document.getElementById('momentumDetails').textContent = `RSI: ${rsi.value} (${rsi.value > 70 ? 'Overbought' : rsi.value < 30 ? 'Oversold' : 'Neutral'})`;
  
  // Sentiment signal
  const sentimentEmoji = sentiment.signal === 'positive' ? '😊' : sentiment.signal === 'negative' ? '😞' : '😐';
  document.getElementById('sentimentSignal').textContent = sentimentEmoji;
  document.getElementById('sentimentSignal').className = `signal-value ${sentiment.signal}`;
  document.getElementById('sentimentDetails').textContent = `Positive: ${sentiment.positive} | Negative: ${sentiment.negative} | Neutral: ${sentiment.neutral}`;
  
  // Overall recommendation
  const posSignals = [trend.signal === 'positive' ? 1 : 0, rsi.signal === 'positive' ? 1 : 0, sentiment.signal === 'positive' ? 1 : 0].reduce((a, b) => a + b);
  const negSignals = [trend.signal === 'negative' ? 1 : 0, rsi.signal === 'negative' ? 1 : 0, sentiment.signal === 'negative' ? 1 : 0].reduce((a, b) => a + b);
  
  let recommendation, timeHorizon;
  if (posSignals >= 2) {
    recommendation = '✅ Worth a Closer Look';
    timeHorizon = 'Short to Medium Term (1-3 months)';
  } else if (negSignals >= 2) {
    recommendation = '🛑 Caution Advised';
    timeHorizon = 'Consider Waiting (1+ months)';
  } else {
    recommendation = '⚠️ Mixed Signals';
    timeHorizon = 'Do More Research';
  }
  
  document.getElementById('recommendation').textContent = recommendation;
  document.getElementById('timeHorizon').textContent = timeHorizon;
  
  // News list
  displayNews(news);
  
  // Store current stock for AI
  window.currentStock = { ticker, data: stockData, trend, rsi, sentiment };
}

function displayNews(news) {
  const newsList = document.getElementById('newsList');
  newsList.innerHTML = '';
  
  news.slice(0, 5).forEach(article => {
    const positiveWords = ['gain', 'surge', 'jump', 'beat', 'rally', 'soar', 'growth', 'profit', 'bull', 'strong'];
    const negativeWords = ['fall', 'drop', 'plunge', 'miss', 'loss', 'decline', 'bear', 'weak', 'crash', 'slump'];
    
    const text = (article.title + ' ' + article.description).toLowerCase();
    const posCount = positiveWords.filter(word => text.includes(word)).length;
    const negCount = negativeWords.filter(word => text.includes(word)).length;
    
    const sentiment = posCount > negCount ? 'positive' : negCount > posCount ? 'negative' : 'neutral';
    
    const newsItem = document.createElement('div');
    newsItem.className = 'news-item';
    newsItem.innerHTML = `
      <h4>${article.title}</h4>
      <span class="sentiment ${sentiment}">${sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}</span>
    `;
    newsList.appendChild(newsItem);
  });
}

// AI Assistant
async function askAI() {
  const question = document.getElementById('aiQuestion').value;
  if (!question) return;
  
  const keys = getApiKeys();
  if (!keys.gemini) {
    alert('Please add Gemini API key first');
    return;
  }
  
  if (!window.currentStock) {
    alert('Please search for a stock first');
    return;
  }
  
  // Add user message to chat
  addChatMessage(question, 'user');
  document.getElementById('aiQuestion').value = '';
  
  try {
    const context = `
    Stock: ${window.currentStock.ticker}
    Current Price: ${window.currentStock.trend.current}
    Trend Signal: ${window.currentStock.trend.signal} (MA20: ${window.currentStock.trend.ma20.toFixed(2)}, MA50: ${window.currentStock.trend.ma50.toFixed(2)})
    RSI: ${window.currentStock.rsi.value}
    Sentiment: ${window.currentStock.sentiment.signal}
    `;
    
    const prompt = `You are an investment assistant. Answer this question about ${window.currentStock.ticker}:\n\n${question}\n\nContext:\n${context}\n\nRemember: This is educational only, not financial advice.`;
    
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + keys.gemini, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    
    const data = await response.json();
    const answer = data.candidates[0].content.parts[0].text;
    addChatMessage(answer, 'assistant');
    
  } catch (error) {
    console.error('AI Error:', error);
    addChatMessage('Sorry, I encountered an error. Please check your API key.', 'assistant');
  }
}

function addChatMessage(text, sender) {
  const chatHistory = document.getElementById('chatHistory');
  const message = document.createElement('div');
  message.className = `chat-message ${sender}`;
  message.textContent = text;
  chatHistory.appendChild(message);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Allow Enter key to search and ask AI
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('pinInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') checkPin();
  });
  
  document.getElementById('tickerInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') searchStock();
  });
  
  document.getElementById('aiQuestion').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') askAI();
  });
});
