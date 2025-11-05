const express = require("express");
const router = express.Router();

// Import controllers
const grammarController = require("../controllers/grammarController");
const plagiarismController = require("../controllers/plagiarismController");
const notesController = require("../controllers/notesController");
const textController = require("../controllers/textController");
const fileController = require("../controllers/fileController");
const imageController = require("../controllers/imageController");

const multer = require("multer");

// ✅ Use memory storage instead of disk storage (Vercel-safe)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Analysis routes (no authentication required)
router.post("/text", textController.analyzeText);
router.post("/file", upload.single("file"), fileController.analyzeFile);
router.post("/image", upload.single("image"), imageController.analyzeImage);
router.post("/grammar", grammarController.checkGrammar);
router.post("/plagiarism", upload.single("file"), plagiarismController.checkPlagiarism);
router.post("/notes", upload.single("file"), notesController.generateNotes);

module.exports = router;
