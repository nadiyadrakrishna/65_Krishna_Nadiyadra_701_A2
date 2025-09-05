// routes/weatherRoutes.js
const express = require("express");
const axios = require("axios");
const router = express.Router();

// --- Simple In-Memory Cache Setup ---
const weatherCache = new Map(); // Stores weather data: key -> { data: {weather, forecast}, timestamp: Date.now() }
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

// Helper function to generate a cache key from city or lat/lon
function generateCacheKey(city, lat, lon) {
    if (city) {
        return `city:${city.toLowerCase()}`;
    } else if (lat && lon) {
        return `latlon:${lat},${lon}`;
    }
    return 'invalid_key'; // Should not happen with validation
}

// GET route for the homepage (initial load)
router.get("/", (req, res) => {
  res.render("index", { weather: null, error: null, inputCity: '', forecast: null });
});

// POST route to handle weather and forecast requests
router.post("/", async (req, res) => {
  let city = req.body.city ? req.body.city.trim() : '';
  let lat = req.body.lat;
  let lon = req.body.lon;
  const apiKey = process.env.WEATHER_API_KEY;

  let inputCityForDisplay = city; // Store original input for display in the form

  // Generate a cache key
  const cacheKey = generateCacheKey(city, lat, lon);

  // --- Check Cache First ---
  if (weatherCache.has(cacheKey)) {
      const cachedEntry = weatherCache.get(cacheKey);
      if (Date.now() - cachedEntry.timestamp < CACHE_DURATION) {
          console.log(`Serving from cache for key: ${cacheKey}`);
          // Use cached data
          return res.render("index", {
              weather: cachedEntry.data.weather,
              error: null,
              inputCity: cachedEntry.data.inputCityForDisplay,
              forecast: cachedEntry.data.forecast
          });
      } else {
          console.log(`Cache expired for key: ${cacheKey}`);
          weatherCache.delete(cacheKey); // Remove expired entry
      }
  }

  // If not in cache or expired, proceed with API calls
  let currentWeatherUrl = '';
  let forecastUrl = '';

  if (city) {
    currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
  } else if (lat && lon) {
    currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&appid=${apiKey}&units=metric`;
    forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&appid=${apiKey}&units=metric`;
    inputCityForDisplay = ''; // Clear city input if using location (will be updated from API response)
  } else {
    return res.render("index", { weather: null, error: "Please enter a city name or use 'Get My Location'.", inputCity: '', forecast: null });
  }

  try {
    // --- Fetch Current Weather ---
    const currentWeatherResponse = await axios.get(currentWeatherUrl);
    const currentWeatherData = currentWeatherResponse.data;

    const weather = {
      city: currentWeatherData.name,
      temp: currentWeatherData.main.temp,
      desc: currentWeatherData.weather[0].description,
      icon: currentWeatherData.weather[0].icon,
      humidity: currentWeatherData.main.humidity,
      windSpeed: currentWeatherData.wind.speed,
      feelsLike: currentWeatherData.main.feels_like,
      timezone: currentWeatherData.timezone // CRITICAL FIX: Add timezone
    };
    inputCityForDisplay = currentWeatherData.name; // Update with actual city name from API

    // --- Fetch Forecast Data ---
    const forecastResponse = await axios.get(forecastUrl);
    const forecastList = forecastResponse.data.list; // Array of 3-hourly forecasts

    // Process forecast data to group by day
    const dailyForecast = {};
    forecastList.forEach(item => {
        const date = new Date(item.dt * 1000).toISOString().split('T')[0];
        
        if (!dailyForecast[date]) {
            dailyForecast[date] = {
                date: new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                temp_min: item.main.temp,
                temp_max: item.main.temp,
                icon: item.weather[0].icon,
                description: item.weather[0].description,
                details: []
            };
        }
        dailyForecast[date].temp_min = Math.min(dailyForecast[date].temp_min, item.main.temp);
        dailyForecast[date].temp_max = Math.max(dailyForecast[date].temp_max, item.main.temp);
        
        dailyForecast[date].details.push({
            time: new Date(item.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
            temp: item.main.temp,
            icon: item.weather[0].icon,
            description: item.weather[0].description
        });
    });

    const processedForecast = Object.values(dailyForecast).slice(0, 5);

    // --- Store in Cache Before Responding ---
    weatherCache.set(cacheKey, {
        data: {
            weather: weather, // This 'weather' object now contains 'timezone'
            inputCityForDisplay: inputCityForDisplay,
            forecast: processedForecast
        },
        timestamp: Date.now()
    });
    console.log(`Data cached for key: ${cacheKey}`);

    // Render the index.ejs template with current weather, input city, and forecast data
    res.render("index", { weather: weather, error: null, inputCity: inputCityForDisplay, forecast: processedForecast });

  } catch (err) {
    let errorMessage = "Could not fetch weather data or forecast.";
    if (err.response) {
        if (err.response.status === 401) {
            errorMessage = "Invalid API Key. Please check your .env file.";
        } else if (err.response.status === 404) {
            errorMessage = "Location not found or invalid. Please check input.";
        } else if (err.response.status === 429) {
            errorMessage = "Too many requests. Please try again later.";
        } else {
            errorMessage = `Error: ${err.response.status} - ${err.response.statusText}`;
        }
    } else if (err.request) {
        errorMessage = "No response from weather server. Please check your internet connection.";
    } else {
        errorMessage = "An unexpected error occurred while making the request.";
    }
    // Always pass null for weather and forecast if there's an error
    res.render("index", { weather: null, error: errorMessage, inputCity: inputCityForDisplay, forecast: null });
  }
});

// --- NEW: API endpoint for city suggestions ---
router.get("/api/suggest-cities", async (req, res) => {
    const query = req.query.q; // Get the partial city name from the query parameter
    const apiKey = process.env.WEATHER_API_KEY;

    if (!query || query.length < 2) { // Require at least 2 characters for suggestions
        return res.json([]);
    }

    const geocodingUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${apiKey}`;

    try {
        const response = await axios.get(geocodingUrl);
        // Format suggestions as { name: "City Name", lat: X, lon: Y }
        const suggestions = response.data.map(item => ({
            name: item.name,
            state: item.state, // Include state/region if available
            country: item.country,
            lat: item.lat,
            lon: item.lon
        }));
        res.json(suggestions);
    } catch (error) {
        console.error("Error fetching city suggestions:", error.message);
        res.status(500).json({ error: "Could not fetch city suggestions." });
    }
});

module.exports = router;