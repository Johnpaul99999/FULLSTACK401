require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const path = require("path");
const axios = require("axios");
const bcrypt = require("bcrypt");

const app = express();

const serviceAct = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAct),
});

const db = admin.firestore();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const API_NINJAS_KEY = "VvzbyJBbehUxS0dSoTUVcA==i0yyFonwEGxZAw07";

app.get("/signup", (req, res) => {
  res.render("signup", { error: null });
});

app.post("/signup", async (req, res) => {
  const { username, email, phone, password, confirm_password } = req.body;

  if (password !== confirm_password) {
    return res.render("signup", { error: "Passwords do not match" });
  }

  if (!/^\d{10}$/.test(phone)) {
    return res.render("signup", {
      error: "Phone number must be exactly 10 digits",
    });
  }

  try {
    const exist = await db.collection("users").where("email", "==", email).get();
    if (!exist.empty) {
      return res.render("signup", { error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.collection("users").add({
      username,
      email,
      phone,
      password: hashedPassword,
    });

    res.redirect("/login");
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const exist = await db.collection("users").where("email", "==", email).get();
    if (exist.empty) {
      return res.render("login", { error: "Invalid email or password" });
    }
    const user = exist.docs[0].data();
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      return res.redirect(`/dashboard?username=${user.username}`);
    } else {
      return res.render("login", { error: "Invalid email or password" });
    }
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

app.get("/dashboard", (req, res) => {
  const { username } = req.query;
  res.render("dashboard", { username, animalData: null, error: null });
});

app.post("/search", async (req, res) => {
  const { animalName } = req.body;
  const { username } = req.query;

  try {
    const response = await axios.get(`https://api.api-ninjas.com/v1/animals?name=${animalName}`, {
      headers: {
        "X-Api-Key": API_NINJAS_KEY,
      }
    });

    if (response.data && response.data.length > 0) {
      const animalData = response.data[0];
      res.render("dashboard", {
        username,
        animalData: {
          name: animalData.name,
          scientific_name: animalData.taxonomy.scientific_name,
          classification: `${animalData.taxonomy.class} (${animalData.taxonomy.kingdom})`,
          diet: animalData.characteristics.diet,
          habitat: animalData.characteristics.habitat,
          location: animalData.characteristics.location,
        },
        error: null
      });
    } else {
      res.render("dashboard", {
        username,
        animalData: null,
        error: "Animal name not found. Please ensure the name is in small letters and spelled correctly."
      });
    }
  } catch (err) {
    console.error("Error fetching animal data:", err.response ? err.response.data : err.message);
    res.render("dashboard", {
      username,
      animalData: null,
      error: "Error fetching animal data. Please try again later."
    });
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
