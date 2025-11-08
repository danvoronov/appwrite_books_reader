const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Helper function for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
// Fibonacci delays in seconds
const retryDelays = [1, 1, 2, 3, 5];

// Helper function to format character count
function formatCharCount(count) {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = process.env.MODEL1;
const secondModel = process.env.MODEL2;

const systemInstruction = fs.readFileSync("./data/systemInstruction.txt", 'utf8');
const primaryGenerator = genAI.getGenerativeModel({model, systemInstruction});
const backupGenerator = genAI.getGenerativeModel({model: secondModel, systemInstruction});

const generationConfig = {
  temperature: 0.3,
  topP: 0.95
};


async function run(text) {
  const maxRetries = 4;
  const emptyResponse = { chapter_summary: '', chapter_cards: [] };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Choose generator based on attempt number
      const currentGenerator = attempt <= 2 ? primaryGenerator : backupGenerator;
      const currentModel = attempt <= 2 ? model : secondModel;

      // Add delay before retries (skip first attempt)
      if (attempt > 1) {
        const delaySeconds = retryDelays[attempt - 2];
        await delay(delaySeconds * 1000*2);
      }

      const chatSession = currentGenerator.startChat({
        generationConfig,
        history: [{ role: "user", parts: [{ text }] }]
      });
      
      const result = await chatSession.sendMessageStream('');
      
      let fullResponse = '';
      let characterCount = 0;
      let firstLine = '';
      let isFirstLineComplete = false;

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        
        // Check first line as soon as we have a complete line
        if (!isFirstLineComplete) {
          firstLine += chunkText;
          if (firstLine.includes('\n')) {
            isFirstLineComplete = true;
            if (!firstLine.trim().startsWith('```json')) {
              // Break the stream early - no need to continue reading
              break;
            }
          }
        }

        fullResponse += chunkText;
        characterCount += chunkText.length;
        process.stdout.write(`\rReceived characters: ${formatCharCount(characterCount)}`);
      }

      // If we broke early due to invalid first line
      if (!firstLine.trim().startsWith('```json')) {
        continue;
      }

      // Parse JSON from the response
      const lines = fullResponse.trim().split('\n');
      const jsonLines = lines.slice(1, -1).join('\n');
      return JSON.parse(jsonLines);

    } catch (error) {
      if (attempt === maxRetries) {
        console.error('LLM error:', error.message);
        return emptyResponse;
      }
    }
  }

  return emptyResponse;
} 

module.exports = { run };