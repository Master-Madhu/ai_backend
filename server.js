const express = require("express");
const cors = require("cors");
const analyzeRoutes = require("./routes/analyzeRoutes");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5500', 
    'http://localhost:5500',
    'http://localhost:3000',
    'http://localhost:8000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8000'
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Favicon route - to prevent 404 errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No content
});

// Routes
app.use("/api/analyze", analyzeRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    success: true, 
    message: "AI Analyzer API is running",
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AI Analyzer Backend API",
    version: "1.0.0",
    endpoints: {
      analyze: "/api/analyze",
      health: "/api/health"
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error"
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🚀 AI Analyzer API ready for requests`);
  console.log(`🌐 CORS enabled for multiple development origins`);
});