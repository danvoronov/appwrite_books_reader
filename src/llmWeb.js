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

let systemInstruction = fs.readFileSync("./data/systemInstruction.txt", 'utf8');
let primaryGenerator = genAI.getGenerativeModel({model, systemInstruction});
let backupGenerator = genAI.getGenerativeModel({model: secondModel, systemInstruction});

const generationConfig = {
  temperature: 0.3,
  topP: 0.95
};

// Функция для обновления системной инструкции
function reloadSystemInstruction() {
  systemInstruction = fs.readFileSync("./data/systemInstruction.txt", 'utf8');
  primaryGenerator = genAI.getGenerativeModel({model, systemInstruction});
  backupGenerator = genAI.getGenerativeModel({model: secondModel, systemInstruction});
}

async function runWithProgress(text, progressCallback) {
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
        const message = `Waiting ${delaySeconds*2} seconds before attempt ${attempt}...`;
        progressCallback({ type: 'progress', message });
        await delay(delaySeconds * 1000*2);
      }

      const message = `Sending request to model ${currentModel} (attempt ${attempt}/${maxRetries})`;
      progressCallback({ type: 'progress', message });

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
              const message = `First line is not JSON format on attempt ${attempt}`;
              progressCallback({ type: 'progress', message });
              // Break the stream early - no need to continue reading
              break;
            }
          }
        }

        fullResponse += chunkText;
        characterCount += chunkText.length;
        const message = `Received characters: ${formatCharCount(characterCount)}`;
        progressCallback({ type: 'progress', message });
      }

      // If we broke early due to invalid first line
      if (!firstLine.trim().startsWith('```json')) {
        if (attempt === maxRetries) {
          const message = 'All attempts exhausted - failed to get valid JSON response';
          progressCallback({ type: 'error', message });
          return emptyResponse;
        }
        continue;
      }

      // Parse JSON from the response
      const lines = fullResponse.trim().split('\n');
      const jsonLines = lines.slice(1, -1).join('\n');
      const result_data = JSON.parse(jsonLines);
      
      progressCallback({ type: 'success', message: 'Successfully processed chapter', data: result_data });
      return result_data;

    } catch (error) {
      const message = `Error on attempt ${attempt}: ${error.message}`;
      progressCallback({ type: 'error', message });
      
      if (attempt === maxRetries) {
        const message = 'All attempts exhausted - returning empty response';
        progressCallback({ type: 'error', message });
        return emptyResponse;
      }
    }
  }

  return emptyResponse;
} 

async function runWithInstructionFile(text, instructionPath, progressCallback) {
  const fs = require('fs');
  const instr = fs.readFileSync(instructionPath, 'utf8');
  const generator = genAI.getGenerativeModel({ model, systemInstruction: instr });

  const maxRetries = 4;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        const delaySeconds = retryDelays[attempt - 2];
        progressCallback && progressCallback({ type: 'progress', message: `Waiting ${delaySeconds*2} seconds before attempt ${attempt}...` });
        await delay(delaySeconds * 1000*2);
      }
      progressCallback && progressCallback({ type: 'progress', message: `Sending request to model ${model} (attempt ${attempt}/${maxRetries})` });
      const chatSession = generator.startChat({ generationConfig, history: [{ role: 'user', parts: [{ text }] }] });
      const result = await chatSession.sendMessageStream('');
      let fullResponse = '';
      let firstLine = '';
      let isFirstLineComplete = false;
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (!isFirstLineComplete) {
          firstLine += chunkText;
          if (firstLine.includes('\n')) {
            isFirstLineComplete = true;
          }
        }
        fullResponse += chunkText;
      }
      // Try parse as code block json first
      let jsonText = fullResponse.trim();
      if (jsonText.startsWith('```')) {
        const lines = jsonText.split('\n');
        if (lines[0].includes('json')) {
          jsonText = lines.slice(1, -1).join('\n');
        }
      }
      const parsed = JSON.parse(jsonText);
      progressCallback && progressCallback({ type: 'success', message: 'Successfully processed tags JSON' });
      return parsed;
    } catch (err) {
      progressCallback && progressCallback({ type: 'error', message: `Error on attempt ${attempt}: ${err.message}` });
      if (attempt === maxRetries) throw err;
    }
  }
}

module.exports = { runWithProgress, reloadSystemInstruction, runWithInstructionFile };