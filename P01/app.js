const express = require("express");
const fileUpload = require("express-fileupload");
const { body, validationResult } = require("express-validator");
const path = require("path");
const fs = require("fs");

const app = express();

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("form", { errors: [], old: {} });
});

app.post(
  "/submit",
  [
    body("username").notEmpty().withMessage("Username is required"),
    body("email").isEmail().withMessage("Valid email required"),
    body("password")
      .isLength({ min: 5 })
      .withMessage("Password must be at least 5 chars"),
    body("confirm_password").custom((value, { req }) => {
      if (value !== req.body.password)
        throw new Error("Passwords do not match");
      return true;
    }),
    body("gender").notEmpty().withMessage("Gender is required"),
    body("hobbies")
      .isArray({ min: 1 })
      .withMessage("Select at least one hobby"),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("form", { errors: errors.array(), old: req.body });
    }

    const profilePic = req.files?.profile_pic;
    const otherPics = req.files?.other_pics;

    const uploadDir = path.join(__dirname, "public", "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

    let profilePath = "";
    if (profilePic) {
      profilePath = `/uploads/${Date.now()}_${profilePic.name}`;
      profilePic.mv(path.join(__dirname, "public", profilePath));
    }

    let otherPaths = [];
    if (otherPics) {
      const files = Array.isArray(otherPics) ? otherPics : [otherPics];
      files.forEach((file) => {
        const filePath = `/uploads/${Date.now()}_${file.name}`;
        file.mv(path.join(__dirname, "public", filePath));
        otherPaths.push(filePath);
      });
    }

    const userData = {
      username: req.body.username,
      email: req.body.email,
      gender: req.body.gender,
      hobbies: req.body.hobbies,
      profilePic: profilePath,
      otherPics: otherPaths,
    };

    const fileContent = JSON.stringify(userData, null, 2);
    const filePath = path.join(__dirname, "public", "user_data.txt");
    fs.writeFileSync(filePath, fileContent);

    res.render("result", { data: userData });
  }
);

app.get("/download", (req, res) => {
  const filePath = path.join(__dirname, "public", "user_data.txt");
  res.download(filePath);
});

app.listen(3000, () => {
  console.log("server is running on port 3000");
});
