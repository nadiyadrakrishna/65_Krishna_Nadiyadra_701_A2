// app.js
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const weatherRoutes = require('./routes/weatherRoutes'); // Import your weather routes

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, JS, images) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse URL-encoded bodies (for form data)
app.use(express.urlencoded({ extended: true }));

// Use the weather routes
app.use('/', weatherRoutes);

// Basic error handling for routes not found
app.use((req, res, next) => {
    res.status(404).send("Sorry, that route doesn't exist!");
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`OpenWeatherMap API Key: ${process.env.WEATHER_API_KEY ? 'Loaded' : 'NOT LOADED - Check .env file!'}`);
});