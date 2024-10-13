require("dotenv").config();
const multer = require("multer");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const express = require("express");
const path = require("path");
const File = require("./models/File");

const app = express();

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Serve static files (CSS, JS, images)
app.use(express.static('public'));

// Configure multer for file uploads (destination folder: uploads)
const upload = multer({ dest: "uploads" });

// Connect to MongoDB using environment variable for DATABASE_URL
mongoose.connect(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Set the view engine to EJS
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));  // Set path for views

// Route to render the homepage
app.get("/", (req, res) => {
  res.render("index", { fileLink: null });  // Ensure fileLink is sent even if null
});

// Route to handle file uploads
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const fileData = {
      path: req.file.path,
      originalName: req.file.originalname,
    };

    // If password is provided, hash it using bcrypt
    if (req.body.password && req.body.password !== "") {
      fileData.password = await bcrypt.hash(req.body.password, 10);
    }

    // Create the file entry in the database
    const file = await File.create(fileData);

    // Render the index page and pass the download link
    res.render("index", { fileLink: `${req.headers.origin}/file/${file.id}` });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).send("An error occurred while uploading the file.");
  }
});

// Route to handle file download with optional password protection
app.route("/file/:id").get(handleDownload).post(handleDownload);

// Function to handle file download
async function handleDownload(req, res) {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).send("File not found.");
    }

    // If the file is password-protected
    if (file.password) {
      // If password is not provided in the POST request, render the password page
      if (!req.body.password) {
        return res.render("password", { error: false });
      }

      // Compare the entered password with the stored hashed password
      const passwordMatch = await bcrypt.compare(req.body.password, file.password);
      if (!passwordMatch) {
        return res.render("password", { error: true });
      }
    }

    // Increment the download count
    file.downloadCount++;
    await file.save();
    console.log(`File downloaded ${file.downloadCount} times`);

    // Initiate the file download
    res.download(file.path, file.originalName);
  } catch (err) {
    console.error('File download error:', err);
    res.status(500).send("An error occurred while downloading the file.");
  }
}

// Listen on the specified port from the environment variable or default to 3000
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
