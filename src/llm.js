const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Helper function for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
// Fibonacci delays in seconds
const retryDelays = [1, 1, 2, 3, 5];

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = "gemini-2.0-flash-thinking-exp-01-21" // "gemini-exp-1206"

const systemInstruction = fs.readFileSync("./data/systemInstruction.txt", 'utf8');
const generator = genAI.getGenerativeModel({model, systemInstruction});

const generationConfig = {
  temperature: 0.3,
  topP: 0.95
};


async function run(text) {
  const maxRetries = 4;
  const emptyResponse = { chapter_summary: '', chapter_cards: [] };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Add delay before retries (skip first attempt)
      if (attempt > 1) {
        const delaySeconds = retryDelays[attempt - 2];
        console.log(`Waiting ${delaySeconds} seconds before attempt ${attempt}...`);
        await delay(delaySeconds * 1000);
      }

      console.log(`Sending request to model ${model} (attempt ${attempt}/${maxRetries})`);
      
      const chatSession = generator.startChat({
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
              console.log(`\nFirst line is not JSON format on attempt ${attempt}`);
              // Break the stream early - no need to continue reading
              break;
            }
          }
        }

        fullResponse += chunkText;
        characterCount += chunkText.length;
        process.stdout.write(`\rReceived characters: ${characterCount}`);
      }

      // If we broke early due to invalid first line
      if (!firstLine.trim().startsWith('```json')) {
        if (attempt === maxRetries) {
          console.log('All attempts exhausted - failed to get valid JSON response');
          return emptyResponse;
        }
        continue;
      }

      // Parse JSON from the response
      const lines = fullResponse.trim().split('\n');
      const jsonLines = lines.slice(1, -1).join('\n');
      return JSON.parse(jsonLines);

    } catch (error) {
      console.error(`Error on attempt ${attempt}:`, error);
      if (attempt === maxRetries) {
        console.log('All attempts exhausted - returning empty response');
        return emptyResponse;
      }
    }
  }

  return emptyResponse;
} 

module.exports = { run };