const geminiService = require("../services/geminiService");
const fs = require('fs').promises;

exports.generateNotes = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "PDF file is required" });
    }

    const result = await geminiService.generateNotesFromPDF(req.file.path);
    
    res.json({ 
      success: true, 
      result,
      metadata: {
        analysisType: "notes-generation",
        documentType: "PDF",
        notesFormat: "structured-topics-subtopics"
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    // Clean up uploaded file (optional but recommended)
    if (req.file) {
      await fs.unlink(req.file.path).catch(console.error);
    }
  }
};