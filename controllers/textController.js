const geminiService = require("../services/geminiService");

exports.analyzeText = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, error: "Text is required" });

    const result = await geminiService.analyzeTextDeterministic(text);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
