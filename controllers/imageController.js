const geminiService = require("../services/geminiService");

exports.analyzeImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "Image is required" });

    const result = await geminiService.analyzeDeepfakeImage(req.file.path);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
