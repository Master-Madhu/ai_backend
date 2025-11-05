const geminiService = require("../services/geminiService");

exports.analyzeFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "File is required" });

    const result = await geminiService.analyzeFile(req.file.path);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
    