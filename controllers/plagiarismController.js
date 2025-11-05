const geminiService = require("../services/geminiService");
const fs = require('fs').promises;

// Single PDF Plagiarism Check
exports.checkPlagiarism = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: "PDF file is required" 
      });
    }

    const result = await geminiService.checkPlagiarism(req.file.path);
    
    res.json({ 
      success: true, 
      result,
      metadata: {
        analysisType: "single-document-plagiarism",
        documentType: "PDF"
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    // Clean up uploaded file
    if (req.file) {
      await fs.unlink(req.file.path).catch(console.error);
    }
  }
};

// Remove other functions since we only need one endpoint now