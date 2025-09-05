// app.js
import express from 'express';
import session from 'express-session';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';

const app = express();
const PORT = 3000;

// Create Redis client
const redisClient = createClient();
await redisClient.connect();

// Create Redis session store
const store = new RedisStore({
  client: redisClient,
});

app.use(express.urlencoded({ extended: true }));

// Setup session middleware
app.use(
  session({
    store: store,
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60000 }, // 1 minute
  })
);

// GET /login route to serve a simple HTML login form
app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login</title>
      <style>
        body {
          background: linear-gradient(135deg, #74ebd5 0%, #ACB6E5 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Segoe UI', Arial, sans-serif;
        }
        .login-container {
          background: #fff;
          padding: 2.5rem 2rem 2rem 2rem;
          border-radius: 16px;
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.2);
          min-width: 320px;
        }
        .login-container h2 {
          margin-bottom: 1.5rem;
          color: #333;
          text-align: center;
        }
        .login-container input[type="text"] {
          width: 100%;
          padding: 0.75rem;
          margin-bottom: 1.2rem;
          border: 1px solid #bdbdbd;
          border-radius: 8px;
          font-size: 1rem;
          outline: none;
          transition: border 0.2s;
        }
        .login-container input[type="text"]:focus {
          border: 1.5px solid #74ebd5;
        }
        .login-container button {
          width: 100%;
          padding: 0.75rem;
          background: linear-gradient(90deg, #74ebd5 0%, #ACB6E5 100%);
          border: none;
          border-radius: 8px;
          color: #fff;
          font-size: 1.1rem;
          font-weight: bold;
          cursor: pointer;
          transition: background 0.2s;
        }
        .login-container button:hover {
          background: linear-gradient(90deg, #ACB6E5 0%, #74ebd5 100%);
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <h2>Login</h2>
        <form method="POST" action="/login">
          <input type="text" name="username" placeholder="Enter your username" required />
          <button type="submit">Login</button>
        </form>
      </div>
    </body>
    </html>
  `);
});
// Login route
app.post('/login', (req, res) => {
  const { username } = req.body;
  if (username) {
    req.session.user = username;
    res.send(`✅ Logged in as ${username}`);
  } else {
    res.status(400).send('❌ Username is required');
  }
});

// Protected route
app.get('/dashboard', (req, res) => {
  if (req.session.user) {
    res.send(`👋 Welcome back, ${req.session.user}`);
  } else {
    res.status(401).send('🔒 Please log in first');
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.send('👋 Logged out');
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
