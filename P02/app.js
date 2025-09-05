const express = require("express");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const bcrypt = require("bcrypt");
const fs = require("fs");

const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new FileStore({}),
    secret: "secret",
    resave: false,
    saveUninitialized: false,
  })
);

const USERS_FILE = "./users.json";

function getUsers() {
  return fs.existsSync(USERS_FILE)
    ? JSON.parse(fs.readFileSync(USERS_FILE))
    : [];
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users));
}

app.get("/register", (req, res) => {
  res.render("register", { error: null });
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const users = getUsers();
  if (users.find((u) => u.username === username)) {
    return res.render("register", { error: "Username already exists" });
  }
  const hashed = await bcrypt.hash(password, 10);
  users.push({ username, password: hashed });
  saveUsers(users);
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = getUsers().find((u) => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.render("login", { error: "Invalid credentials" });
  }
  req.session.user = username;
  res.redirect("/dashboard");
});

app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("dashboard", { user: req.session.user });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// Redirect root URL to login page
app.get('/', (req, res) => {
  res.redirect('/login');
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
