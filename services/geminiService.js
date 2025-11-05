const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// API key - Move to environment variables later
const API_KEY = "AIzaSyDJlaM9VhCQp_RjfF3ODpgG9k3nHWbma2w";
const genAI = new GoogleGenerativeAI(API_KEY);

// Use a model with temperature control for consistency
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.0-flash",
  generationConfig: {
    temperature: 0.1, // Lower = more deterministic (0-1)
    topK: 1,          // More deterministic sampling
    topP: 0.1,        // More focused responses
    maxOutputTokens: 1024,
  }
});

// Helper to safely parse JSON returned by Gemini
function safeParseJSON(rawText) {
  try {
    console.log("Raw response:", rawText.substring(0, 300)); // Debug log
    
    // Method 1: Try to find JSON with regex
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonString = jsonMatch[0];
      console.log("Extracted JSON:", jsonString.substring(0, 200)); // Debug log
      const cleaned = jsonString.replace(/```json|```/g, "").trim();
      return JSON.parse(cleaned);
    }
    
    // Method 2: Remove common non-JSON patterns
    let cleaned = rawText
      .replace(/^[^{]*/, '') // Remove everything before first {
      .replace(/[^}]*$/, '') // Remove everything after last }
      .replace(/```json|```/g, "")
      .trim();
    
    console.log("Cleaned JSON:", cleaned.substring(0, 200)); // Debug log
    return JSON.parse(cleaned);
    
  } catch (err) {
    console.error("Failed to parse JSON. Error:", err.message);
    console.error("Raw text that failed:", rawText.substring(0, 500));
    
    // Return fallback response instead of throwing error
    return {
      error: "JSON parsing failed",
      message: err.message
    };
  }
}

// --- PDF Text Extraction ---
async function extractTextFromPDF(filePath) {
  try {
    const fileBytes = fs.readFileSync(filePath);
    
    const prompt = `
Extract all textual content from this PDF document. Return ONLY the plain text content without any formatting, headers, or additional commentary.

Important:
- Extract ALL text including headings, paragraphs, lists
- Preserve the logical flow of content
- Ignore images, tables, and non-text elements
- Return only the extracted text, nothing else
`;

    const result = await model.generateContent([
      { text: prompt },
      { 
        inlineData: { 
          mimeType: "application/pdf", 
          data: fileBytes.toString("base64") 
        } 
      },
    ]);
    
    return result.response.text();
  } catch (error) {
    console.error("PDF text extraction error:", error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

// --- PLAGIARISM CHECK (Single PDF) ---
async function checkPlagiarism(filePath) {
  try {
    const documentText = await extractTextFromPDF(filePath);
    
    const prompt = `
CRITICAL: You are a plagiarism detection expert. Analyze this document for plagiarism against academic databases and online sources.

**DOCUMENT TO ANALYZE:**
${documentText.substring(0, 3000)}

**CHECK FOR PLAGIARISM:**

Return STRICT JSON format:
{
  "plagiarismPercentage": 0-100,
  "similarityDetails": "Overall assessment of similarity with existing sources",
  "confidenceScore": 0-100,
  "matchedSections": [
    {
      "text": "specific text excerpt from document",
      "similarityType": "exact|paraphrased|conceptual",
      "confidence": 0-100
    }
  ],
  "recommendation": "Action recommendation based on similarity"
}
`;

    const result = await model.generateContent([{ text: prompt }]);
    return safeParseJSON(result.response.text());

  } catch (error) {
    console.error("Plagiarism check error:", error);
    return {
      plagiarismPercentage: 0,
      similarityDetails: "Analysis failed",
      confidenceScore: 0,
      matchedSections: [],
      recommendation: "Unable to complete analysis",
      error: error.message
    };
  }
}

// --- AI/HUMAN CONTENT ANALYSIS (Separate Function) ---
async function analyzeFile(filePath) {
  const fileBytes = fs.readFileSync(filePath);
  
  const prompt = `
CRITICAL: You are an AI detection expert. Analyze this document and provide CONSISTENT results.

**ANALYSIS FRAMEWORK - FOLLOW STRICTLY:**

1. **AI INDICATORS** (Score 1 point for each present):
   - Overly formal/polite language
   - Repetitive sentence structures
   - Lack of personal pronouns/experiences
   - Perfect grammar with no errors
   - Generic phrasing without specifics
   - Consistent tone without variation
   - Logical flow but lacking depth

2. **HUMAN INDICATORS** (Score 1 point for each present):
   - Personal anecdotes/experiences
   - Minor grammatical imperfections
   - Varied sentence lengths
   - Emotional language/opinions
   - Specific examples/details
   - Inconsistent tone shifts
   - Creative metaphors/idioms

**SCORING SYSTEM:**
- Count AI indicators (0-7)
- Count Human indicators (0-7)
- TOTAL indicators = AI indicators + Human indicators
- AI Percentage = (AI indicators / TOTAL indicators) * 100
- Human Percentage = (Human indicators / TOTAL indicators) * 100
- **CRITICAL: Ensure AI Percentage + Human Percentage = 100 exactly**

**DOCUMENT ANALYSIS:**
Provide analysis based on the above framework.

Return STRICT JSON format:
{
  "aiPercentage": calculated_number,
  "humanPercentage": calculated_number,
  "analysisDetails": "Brief explanation of key indicators found",
  "aiGeneratedSentences": ["quote actual sentences that show AI patterns"],
  "confidenceScore": 0-100,
  "indicatorsFound": {
    "aiIndicators": ["list specific indicators found"],
    "humanIndicators": ["list specific indicators found"]
  }
}
`;

  try {
    const result = await model.generateContent([
      { text: prompt },
      { 
        inlineData: { 
          mimeType: "application/pdf", 
          data: fileBytes.toString("base64") 
        } 
      },
    ]);
    
    const analysis = safeParseJSON(result.response.text());
    
    // Ensure percentages add to 100% (final safety check)
    if (analysis.aiPercentage + analysis.humanPercentage !== 100) {
      analysis.aiPercentage = Math.round(analysis.aiPercentage);
      analysis.humanPercentage = 100 - analysis.aiPercentage;
    }
    
    return analysis;
  } catch (error) {
    console.error("File analysis error:", error);
    // Return fallback response
    return {
      aiPercentage: 50,
      humanPercentage: 50,
      analysisDetails: "File analysis failed due to API error",
      aiGeneratedSentences: [],
      confidenceScore: 0,
      indicatorsFound: {
        aiIndicators: [],
        humanIndicators: []
      },
      error: error.message
    };
  }
}

// --- Consistent Text Analysis (Single Run) ---
async function analyzeTextDeterministic(text) {
  const prompt = `
CRITICAL: You are an AI detection expert. Analyze this text and provide CONSISTENT results.

**ANALYSIS FRAMEWORK - FOLLOW STRICTLY:**

1. **AI INDICATORS** (Score 1 point for each present):
   - Overly formal/polite language
   - Repetitive sentence structures
   - Lack of personal pronouns/experiences (I, we, my, our)
   - Perfect grammar with no errors
   - Generic phrasing without specifics
   - Consistent tone without variation
   - Logical flow but lacking depth/emotion

2. **HUMAN INDICATORS** (Score 1 point for each present):
   - Personal anecdotes/experiences/stories
   - Minor grammatical imperfections
   - Varied sentence lengths and structures
   - Emotional language/opinions/subjectivity
   - Specific examples/concrete details
   - Inconsistent tone shifts/natural flow
   - Creative metaphors/idioms/colloquialisms

**SCORING SYSTEM:**
- Count AI indicators (0-7)
- Count Human indicators (0-7)
- TOTAL indicators = AI indicators + Human indicators
- AI Percentage = (AI indicators / TOTAL indicators) * 100
- Human Percentage = (Human indicators / TOTAL indicators) * 100
- **CRITICAL: Ensure AI Percentage + Human Percentage = 100 exactly**

**TEXT TO ANALYZE:**
"${text.substring(0, 1500)}"

**IMPORTANT:**
- Return ONLY valid JSON, no additional text
- Do not include explanations before or after JSON
- Do not use markdown code blocks

Return ONLY this JSON format, nothing else:
{
  "aiPercentage": calculated_number,
  "humanPercentage": calculated_number,
  "analysisDetails": "Brief explanation of key indicators found",
  "aiGeneratedSentences": ["quote actual sentences that show strong AI patterns"],
  "humanIndicatorsSentences": ["quote sentences that show human characteristics"],
  "confidenceScore": 0-100,
  "indicatorsFound": {
    "aiIndicators": ["list specific AI indicators found"],
    "humanIndicators": ["list specific human indicators found"]
  }
}
`;

  try {
    const result = await model.generateContent([{ text: prompt }]);
    const analysis = safeParseJSON(result.response.text());
    
    // Ensure percentages add to 100% (final safety check)
    if (analysis.aiPercentage + analysis.humanPercentage !== 100) {
      analysis.aiPercentage = Math.round(analysis.aiPercentage);
      analysis.humanPercentage = 100 - analysis.aiPercentage;
    }
    
    return analysis;
  } catch (error) {
    console.error("Text analysis error:", error);
    // Return fallback response
    return {
      aiPercentage: 50,
      humanPercentage: 50,
      analysisDetails: "Analysis failed due to API error",
      aiGeneratedSentences: [],
      humanIndicatorsSentences: [],
      confidenceScore: 0,
      indicatorsFound: {
        aiIndicators: [],
        humanIndicators: []
      },
      error: error.message
    };
  }
}

// --- Enhanced Deepfake Image Analysis ---
async function analyzeDeepfakeImage(imagePath, runs = 3) {
  const results = [];
  
  for (let i = 0; i < runs; i++) {
    try {
      const result = await analyzeDeepfakeSingleRun(imagePath);
      results.push(result);
      
      if (i < runs - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.warn(`Deepfake run ${i + 1} failed:`, error.message);
    }
  }
  
  return calculateDeepfakeAverageResults(results);
}

// Single deepfake analysis run
async function analyzeDeepfakeSingleRun(imagePath) {
  const fileBytes = fs.readFileSync(imagePath);
  
  const prompt = `
CRITICAL: You are a deepfake detection expert. Analyze this image for signs of AI manipulation.

**DEEPFAKE INDICATORS - CHECK FOR THESE:**

1. **FACIAL FEATURES:**
   - Asymmetrical eyes or eyebrows
   - Unnatural skin texture or smoothing
   - Inconsistent lighting on face
   - Strange reflections in eyes
   - Misaligned facial features

2. **BACKGROUND & CONTEXT:**
   - Blurry or distorted background
   - Inconsistent shadows
   - Artifacts around hair/edges
   - Unnatural blurring patterns

3. **IMAGE QUALITY:**
   - Unusual compression artifacts
   - Inconsistent resolution
   - Strange color patterns
   - Watermark inconsistencies

**ANALYSIS FRAMEWORK:**

Score each category (0-3 points):
- Facial Features: 0-3 points
- Background & Context: 0-3 points  
- Image Quality: 0-3 points

**SCORING:**
- Total Score = Sum of all categories (0-9)
- Deepfake Probability = (Total Score / 9) * 100
- Confidence = Based on clarity of indicators

**FINAL DETERMINATION:**
- isDeepfake: true if Deepfake Probability > 60%
- confidence: 0-100 based on indicator strength

Return STRICT JSON format:
{
  "isDeepfake": true/false,
  "confidence": 0-100,
  "deepfakeProbability": 0-100,
  "details": "Specific indicators found",
  "indicatorsFound": {
    "facialFeatures": ["asymmetrical eyes", "unnatural skin"],
    "backgroundIssues": ["inconsistent shadows", "blurry edges"],
    "imageQuality": ["compression artifacts", "color issues"]
  },
  "analysisSummary": "Brief overall assessment"
}
`;

  const result = await model.generateContent([
    { text: prompt },
    { 
      inlineData: { 
        mimeType: "image/jpeg", 
        data: fileBytes.toString("base64") 
      } 
    },
  ]);
  
  return safeParseJSON(result.response.text());
}

// Calculate average for deepfake results
function calculateDeepfakeAverageResults(results) {
  if (results.length === 0) {
    throw new Error("All deepfake analysis runs failed");
  }
  
  const deepfakeVotes = results.filter(r => r.isDeepfake === true).length;
  const deepfakeConsensus = deepfakeVotes / results.length;
  
  const avgConfidence = Math.round(results.reduce((sum, r) => sum + (r.confidence || 50), 0) / results.length);
  const avgProbability = Math.round(results.reduce((sum, r) => sum + (r.deepfakeProbability || 0), 0) / results.length);
  
  const finalIsDeepfake = deepfakeConsensus >= 0.5;
  
  const averaged = {
    isDeepfake: finalIsDeepfake,
    confidence: avgConfidence,
    deepfakeProbability: avgProbability,
    details: results[0].details,
    consensus: Math.round(deepfakeConsensus * 100),
    runsPerformed: results.length,
    agreement: calculateDeepfakeAgreement(results),
    indicatorsFound: combineIndicators(results),
    analysisSummary: results[0].analysisSummary,
    _voteBreakdown: {
      deepfakeVotes: deepfakeVotes,
      realVotes: results.length - deepfakeVotes,
      consensusPercentage: Math.round(deepfakeConsensus * 100)
    }
  };
  
  console.log(`✅ Deepfake analysis: ${finalIsDeepfake ? 'DEEPFAKE' : 'REAL'} (${avgProbability}% probability, ${avgConfidence}% confidence)`);
  
  return averaged;
}

function calculateDeepfakeAgreement(results) {
  if (results.length < 2) return 100;
  
  const consistentResults = results.filter(r => r.isDeepfake === results[0].isDeepfake);
  return Math.round((consistentResults.length / results.length) * 100);
}

function combineIndicators(results) {
  const allIndicators = {
    facialFeatures: [],
    backgroundIssues: [],
    imageQuality: []
  };
  
  results.forEach(result => {
    if (result.indicatorsFound) {
      Object.keys(allIndicators).forEach(category => {
        if (result.indicatorsFound[category] && Array.isArray(result.indicatorsFound[category])) {
          result.indicatorsFound[category].forEach(indicator => {
            if (!allIndicators[category].includes(indicator)) {
              allIndicators[category].push(indicator);
            }
          });
        }
      });
    }
  });
  
  return allIndicators;
}

// Quick deepfake check (single run for faster response)
async function analyzeDeepfakeQuick(imagePath) {
  return await analyzeDeepfakeSingleRun(imagePath);
}

// --- Grammar Check ---
async function checkGrammar(text) {
  const prompt = `
Check the following text for grammar, spelling, and style issues.  
Return JSON with this format:
{
  "correctedText": "<corrected text>",
  "issues": [
    { "line": 1, "type": "grammar|spelling|style", "original": "...", "suggestion": "..." }
  ]
}
Text to analyze:
${text}
Only return valid JSON.
`;
  const result = await model.generateContent([{ text: prompt }]);
  return safeParseJSON(result.response.text());
}

// --- Enhanced Notes Maker ---
async function generateNotesFromPDF(filePath) {
  try {
    const fileBytes = fs.readFileSync(filePath);
    
    const prompt = `
CRITICAL: You are an expert academic note-taker. Generate comprehensive, well-structured notes from this PDF document.

**NOTE-TAKING FRAMEWORK:**

1. **STRUCTURE REQUIREMENTS:**
   - MAIN TOPICS: Use ALL CAPS with clear numbering (1., 2., 3.)
   - SUBTOPICS: Use Title Case with proper indentation
   - KEY POINTS: Use bullet points with clear explanations
   - IMPORTANT CONCEPTS: Highlight key definitions and theories
   - EXAMPLES: Include relevant examples where applicable

2. **CONTENT REQUIREMENTS:**
   - Extract all key concepts, theories, and important information
   - Maintain academic rigor and accuracy
   - Use clear, concise language
   - Include definitions for technical terms
   - Preserve the logical flow of the original content

3. **FORMATTING RULES:**
   - Do NOT use Markdown symbols (#, *, -, **)
   - Use ONLY spaces and newlines for structure
   - Use indentation for hierarchy (2 spaces per level)
   - Separate major sections with blank lines

**ORGANIZE NOTES AS FOLLOWS:**

MAIN TOPIC 1
  Subtopic 1.1
    • Key point with detailed explanation
    • Another key point with examples
  Subtopic 1.2
    • Important concept definition
    • Supporting details

MAIN TOPIC 2
  Subtopic 2.1
    • Theory explanation
    • Practical applications
  Subtopic 2.2
    • Case studies
    • Analysis and conclusions

Return the notes in this exact structured format. Focus on clarity, completeness, and academic value.
`;

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: "application/pdf", data: fileBytes.toString("base64") } },
    ]);
    
    return result.response.text();
    
  } catch (error) {
    console.error("Notes generation error:", error);
    return `Notes generation failed: ${error.message}. Please try again with a different document.`;
  }
}

module.exports = {
  analyzeTextDeterministic, // Text AI/Human analysis
  analyzeFile,              // File AI/Human analysis  
  checkPlagiarism,          // Single PDF plagiarism check
  analyzeDeepfakeImage,     // Multi-run deepfake analysis
  analyzeDeepfakeQuick,     // Single run deepfake analysis
  checkGrammar,
  generateNotesFromPDF,     // Enhanced notes maker
};