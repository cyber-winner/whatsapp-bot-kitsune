const axios = require('axios');
const path = require('path');
const { exec } = require('child_process');


const DEFAULT_LAT = 0;
const DEFAULT_LON = 0;


const weatherToolDefinition = {
  type: 'function',
  function: {
    name: 'get_current_weather',
    description: 'Get the current weather conditions for a location. Use this when someone asks about the weather, temperature, rain, humidity, wind, or any weather-related question.',
    parameters: {
      type: 'object',
      properties: {
        latitude: {
          type: 'number',
          description: `Latitude of the location. Defaults to ${DEFAULT_LAT} if not specified.`
        },
        longitude: {
          type: 'number',
          description: `Longitude of the location. Defaults to ${DEFAULT_LON} if not specified.`
        }
      },
      required: []
    }
  }
};


const datetimeToolDefinition = {
  type: 'function',
  function: {
    name: 'get_current_datetime',
    description: 'Get the current date, time, and day of the week. Use this when someone asks about the current time, date, day, what day it is, or any time/date related question.',
    parameters: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'IANA timezone string. Defaults to UTC if not specified.'
        }
      },
      required: []
    }
  }
};

function getCurrentDateTime(timezone = 'UTC') {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: timezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    const parts = formatter.formatToParts(now);
    const get = (type) => parts.find(p => p.type === type)?.value || '';

    const result = {
      timezone,
      date: `${get('day')} ${get('month')} ${get('year')}`,
      day_of_week: get('weekday'),
      time: `${get('hour')}:${get('minute')}:${get('second')} ${get('dayPeriod')}`,
      iso: now.toLocaleString('en-CA', { timeZone: timezone, hour12: false }),
      unix_timestamp: Math.floor(now.getTime() / 1000)
    };
    return JSON.stringify(result, null, 2);
  } catch (err) {
    console.error('[DateTimeTool] Error:', err.message);
    return JSON.stringify({ error: `Failed to get datetime: ${err.message}` });
  }
}

// Default locality for news
const DEFAULT_LOCALITY = 'Global';

// Google News RSS topic IDs for India (en-IN)
const NEWS_CATEGORIES = {
  headlines:     { id: null,                                                                   label: 'Top Stories' },
  world:         { id: 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pKVGlnQVAB',         label: 'World' },
  nation:        { id: 'CAAqIQgKIhtDQkFTRGdvSUwyMHZNRFZxYUdjU0FtVnVLQUFQAQ',                 label: 'India' },
  business:      { id: 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pKVGlnQVAB',         label: 'Business' },
  technology:    { id: 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pKVGlnQVAB',         label: 'Technology' },
  entertainment: { id: 'CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtVnVHZ0pKVGlnQVAB',         label: 'Entertainment' },
  sports:        { id: 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtVnVHZ0pKVGlnQVAB',         label: 'Sports' },
  science:       { id: 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pKVGlnQVAB',         label: 'Science' },
  health:        { id: 'CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVLQUFQAQ',                 label: 'Health' }
};

// Groq tool definition for the news function
const newsToolDefinition = {
  type: 'function',
  function: {
    name: 'get_local_news',
    description: `Get the latest news headlines. Use this when someone asks about news, what is happening, current events, or any news-related question. You can either pick a category for curated topic news, or provide a custom search query for specific locality/topic news. Available categories: ${Object.keys(NEWS_CATEGORIES).join(', ')}. Defaults to Global area search if neither category nor query is specified.`,
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: Object.keys(NEWS_CATEGORIES),
          description: `News category for curated topic feeds. One of: ${Object.keys(NEWS_CATEGORIES).join(', ')}. Use this for broad topic requests like "sports news", "tech news", "what's happening in the world", etc.`
        },
        query: {
          type: 'string',
          description: `Custom search query for news. Use this for specific searches like "Global", "IPL", "election results", etc. If category is also provided, query is ignored. Defaults to "${DEFAULT_LOCALITY}" if neither category nor query is given.`
        },
        count: {
          type: 'number',
          description: 'Number of news headlines to return (1-10). Defaults to 5.'
        }
      },
      required: []
    }
  }
};

/**
 * Parse Google News RSS XML and extract items
 */
function parseRssItems(xml, count) {
  const items = [];
  const itemRegex = /<item>(.*?)<\/item>/gs;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < count) {
    const itemXml = match[1];
    const title = (itemXml.match(/<title>(.*?)<\/title>/) || [])[1] || '';
    const link = (itemXml.match(/<link>(.*?)<\/link>/) || [])[1] || '';
    const pubDate = (itemXml.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
    const source = (itemXml.match(/<source[^>]*>(.*?)<\/source>/) || [])[1] || '';

    // Clean HTML entities
    const cleanTitle = title
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    if (cleanTitle) {
      items.push({
        headline: cleanTitle,
        source: source || 'Unknown',
        published: pubDate ? new Date(pubDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Unknown',
        link
      });
    }
  }
  return items;
}

/**
 * Fetch latest news from Google News RSS (free, no API key)
 * Supports both category-based topic feeds and freeform search
 */
async function getLocalNews(query = DEFAULT_LOCALITY, count = 5, category = null) {
  try {
    count = Math.max(1, Math.min(10, count || 5));
    let rssUrl;
    let label;

    if (category && NEWS_CATEGORIES[category.toLowerCase()]) {
      const cat = NEWS_CATEGORIES[category.toLowerCase()];
      label = cat.label;
      if (cat.id) {
        rssUrl = `https://news.google.com/rss/topics/${cat.id}?hl=en-IN&gl=IN&ceid=IN:en`;
      } else {
        // Headlines fallback
        rssUrl = `https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en`;
      }
    } else {
      label = `Search: ${query}`;
      const encodedQuery = encodeURIComponent(query);
      rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-IN&gl=IN&ceid=IN:en`;
    }

    const response = await axios.get(rssUrl, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
      }
    });

    const items = parseRssItems(response.data, count);

    const result = {
      category: label,
      query: category ? null : query,
      total_results: items.length,
      headlines: items
    };

    return JSON.stringify(result, null, 2);
  } catch (err) {
    console.error('[NewsTool] Error fetching news:', err.message);
    return JSON.stringify({ error: `Failed to fetch news: ${err.message}` });
  }
}


const WMO_CODES = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail'
};

async function getCurrentWeather(latitude = DEFAULT_LAT, longitude = DEFAULT_LON) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast`;
    const response = await axios.get(url, {
      params: {
        latitude,
        longitude,
        current: [
          'temperature_2m',
          'relative_humidity_2m',
          'apparent_temperature',
          'is_day',
          'precipitation',
          'rain',
          'weather_code',
          'cloud_cover',
          'wind_speed_10m',
          'wind_direction_10m',
          'wind_gusts_10m',
          'surface_pressure'
        ].join(','),
        daily: [
          'temperature_2m_max',
          'temperature_2m_min',
          'sunrise',
          'sunset',
          'uv_index_max',
          'precipitation_sum',
          'precipitation_probability_max',
          'wind_speed_10m_max'
        ].join(','),
        timezone: 'UTC',
        forecast_days: 1
      },
      timeout: 8000
    });

    const data = response.data;
    const current = data.current;
    const daily = data.daily;
    const units = data.current_units;

    const weatherDescription = WMO_CODES[current.weather_code] || 'Unknown';
    const isDay = current.is_day === 1;

    const result = {
      location: {
        latitude,
        longitude,
        timezone: data.timezone
      },
      current: {
        temperature: `${current.temperature_2m}${units.temperature_2m}`,
        feels_like: `${current.apparent_temperature}${units.apparent_temperature}`,
        humidity: `${current.relative_humidity_2m}${units.relative_humidity_2m}`,
        condition: weatherDescription,
        cloud_cover: `${current.cloud_cover}%`,
        wind_speed: `${current.wind_speed_10m} ${units.wind_speed_10m}`,
        wind_gusts: `${current.wind_gusts_10m} ${units.wind_gusts_10m}`,
        wind_direction: `${current.wind_direction_10m}°`,
        precipitation: `${current.precipitation} ${units.precipitation}`,
        rain: `${current.rain} ${units.rain || 'mm'}`,
        pressure: `${current.surface_pressure} ${units.surface_pressure}`,
        is_day: isDay ? 'Daytime' : 'Nighttime'
      },
      today: {
        max_temp: `${daily.temperature_2m_max[0]}°C`,
        min_temp: `${daily.temperature_2m_min[0]}°C`,
        sunrise: daily.sunrise[0],
        sunset: daily.sunset[0],
        uv_index: daily.uv_index_max[0],
        total_precipitation: `${daily.precipitation_sum[0]} mm`,
        rain_chance: `${daily.precipitation_probability_max[0]}%`,
        max_wind: `${daily.wind_speed_10m_max[0]} km/h`
      }
    };

    return JSON.stringify(result, null, 2);
  } catch (err) {
    console.error('[WeatherTool] Error fetching weather:', err.message);
    return JSON.stringify({ error: `Failed to fetch weather data: ${err.message}` });
  }
}


const fifaToolDefinition = {
  type: 'function',
  function: {
    name: 'get_fifa_matches',
    description: 'Get the latest live scores, schedules, and matchups for FIFA football (soccer) matches. Use this when the user asks about football/soccer scores, who is playing, or match results.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
};

async function getFifaMatches() {
  try {
    const res = await axios.get('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard');
    const matches = [];
    if (res.data.events && res.data.events.length > 0) {
      for (const event of res.data.events) {
        matches.push({
          name: event.name,
          date: event.date,
          status: event.status?.type?.detail || 'Unknown',
          competitors: event.competitions?.[0]?.competitors?.map(c => ({
            team: c.team?.displayName || 'Unknown',
            score: c.score || '0',
            winner: c.winner || false
          })) || []
        });
      }
    }
    return JSON.stringify({ league: res.data.leagues?.[0]?.name || 'FIFA World Cup', matches: matches }, null, 2);
  } catch (err) {
    console.error('[FifaTool] Error fetching FIFA matches:', err.message);
    return JSON.stringify({ error: `Failed to fetch FIFA data: ${err.message}` });
  }
}


const searchToolDefinition = {
  type: 'function',
  function: {
    name: 'search_web_engine',
    description: 'Search the web for general knowledge, facts, Wikipedia summaries, and information. Use this when the user asks a question about history, science, people, definitions, or general facts.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query (e.g. "Quantum computing", "Albert Einstein", "How do airplanes fly?")'
        }
      },
      required: ['query']
    }
  }
};

async function searchWebEngine(query) {
  try {
    const encoded = encodeURIComponent(query);
    
    
    const ddgRes = await axios.get(`https://api.duckduckgo.com/?q=${encoded}&format=json`);
    if (ddgRes.data && ddgRes.data.AbstractText) {
      return JSON.stringify({ source: 'DuckDuckGo', query, result: ddgRes.data.AbstractText });
    }

    
    const wikiSearchRes = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&utf8=&format=json`, {
      headers: { 'User-Agent': 'KitsuneBot/1.0 (contact@example.com)' }
    });
    
    const searchResults = wikiSearchRes.data.query?.search;
    if (searchResults && searchResults.length > 0) {
      const firstTitle = searchResults[0].title;
      
      const detailRes = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&titles=${encodeURIComponent(firstTitle)}&format=json&explaintext=true`, {
        headers: { 'User-Agent': 'KitsuneBot/1.0 (contact@example.com)' }
      });
      
      const pages = detailRes.data.query?.pages;
      if (pages) {
        const firstPageId = Object.keys(pages)[0];
        const extract = pages[firstPageId]?.extract;
        if (extract) {
          
          const text = extract.length > 800 ? extract.substring(0, 800) + '...' : extract;
          return JSON.stringify({ source: `Wikipedia: ${firstTitle}`, query, result: text });
        }
      }
    }

    return JSON.stringify({ error: `No reliable information found for "${query}".` });
  } catch (err) {
    console.error('[SearchTool] Error:', err.message);
    return JSON.stringify({ error: `Search failed: ${err.message}` });
  }
}


const readUrlToolDefinition = {
  type: 'function',
  function: {
    name: 'read_url_content',
    description: 'Read the text content of any website URL. Use this when the user asks you to check a specific website or when you need to read an article from a search result link.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The full URL to read (e.g. "https://genshin.hoyoverse.com/en/news")'
        }
      },
      required: ['url']
    }
  }
};

async function readUrlContent(url) {
  try {
    const res = await axios.get(`https://r.jina.ai/${url}`, {
      headers: { 'User-Agent': 'KitsuneBot/1.0' }
    });
    
    const content = res.data.length > 3000 ? res.data.substring(0, 3000) + '... [TRUNCATED]' : res.data;
    return JSON.stringify({ source: url, content: content });
  } catch (err) {
    console.error('[ReadUrlTool] Error:', err.message);
    return JSON.stringify({ error: `Failed to read URL: ${err.message}` });
  }
}


const mathToolDefinition = {
  type: 'function',
  function: {
    name: 'evaluate_math_expression',
    description: 'Evaluate a mathematical expression. Use this tool WHENEVER the user asks a math question, calculation, conversion, or equation (e.g. "what is 2 + 2", "15% of 80", "sin(45 deg)", "5 cm to inches"). This ensures 100% accurate mathematical results.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'The mathematical expression to evaluate (e.g., "2 + 2", "10 * (5 - 3)", "sin(45 deg)", "5 cm to inch").'
        }
      },
      required: ['expression']
    }
  }
};

async function evaluateMathExpression(expression) {
  try {
    const encoded = encodeURIComponent(expression);
    const res = await axios.get(`http://api.mathjs.org/v4/?expr=${encoded}`);
    return JSON.stringify({ expression, result: res.data });
  } catch (err) {
    console.error('[MathTool] Error:', err.message);
    return JSON.stringify({ error: `Math evaluation failed: ${err.response?.data || err.message}` });
  }
}


const newtonToolDefinition = {
  type: 'function',
  function: {
    name: 'evaluate_advanced_calculus',
    description: 'Use this tool for ADVANCED math like Calculus (integrals, derivatives), Algebra, and Trigonometry. YOU MUST CALL THIS TOOL TO EVALUATE OR VERIFY ALL MATH EQUATIONS, EVEN IF YOU THINK YOU KNOW THE ANSWER. Operations allowed: simplify, factor, derive, integrate, zeroes, cos, sin, tan, arccos, arcsin, arctan, abs, log.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['simplify', 'factor', 'derive', 'integrate', 'zeroes', 'cos', 'sin', 'tan', 'arccos', 'arcsin', 'arctan', 'abs', 'log'],
          description: 'The mathematical operation to perform.'
        },
        expression: {
          type: 'string',
          description: 'The mathematical expression (e.g., "x^2 + 2x", "x*arctan(x)"). Do NOT include the operation name in the expression.'
        }
      },
      required: ['operation', 'expression']
    }
  }
};

async function evaluateNewtonMath(operation, expression) {
  return new Promise((resolve) => {
    try {
      const scriptPath = path.join(__dirname, 'sympy_solver.py');
      
      const safeExpr = expression.replace(/"/g, '\\"');
      exec(`python3 ${scriptPath} "${operation}" "${safeExpr}"`, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('[SymPyTool] Error:', error.message);
          return resolve(JSON.stringify({ error: `Advanced math evaluation failed: ${stderr || error.message}` }));
        }
        resolve(JSON.stringify({ operation, expression, result: stdout.trim() }));
      });
    } catch (err) {
      console.error('[SymPyTool] Error:', err.message);
      resolve(JSON.stringify({ error: `Advanced math evaluation failed: ${err.message}` }));
    }
  });
}

module.exports = {
  weatherToolDefinition,
  datetimeToolDefinition,
  newsToolDefinition,
  fifaToolDefinition,
  searchToolDefinition,
  readUrlToolDefinition,
  getCurrentWeather,
  getCurrentDateTime,
  getLocalNews,
  getFifaMatches,
  searchWebEngine,
  readUrlContent,
  mathToolDefinition,
  evaluateMathExpression,
  newtonToolDefinition,
  evaluateNewtonMath,
  DEFAULT_LAT,
  DEFAULT_LON,
  DEFAULT_LOCALITY
};
