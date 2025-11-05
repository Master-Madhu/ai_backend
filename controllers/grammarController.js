  const geminiService = require("../services/geminiService");

  exports.checkGrammar = async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ success: false, error: "Text is required" });

      const result = await geminiService.checkGrammar(text);
      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  };
