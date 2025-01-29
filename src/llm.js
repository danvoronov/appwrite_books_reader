const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = "gemini-2.0-flash-thinking-exp-01-21" // "gemini-exp-1206"

const systemInstruction = fs.readFileSync(path.join(__dirname, '../data/systemInstruction.txt'), 'utf8');

const generator = genAI.getGenerativeModel({ 
  model,
  generationConfig: {
    temperature: 0.3,
    topP: 0.95
  }
});

async function run(text, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Попытка ${attempt}/${maxRetries} на модели ${model}`);
      
      const chat = generator.startChat( {
        contents: [
          {
            role: "user",
            parts: [{ text: systemInstruction }]
          }
        ]
      });
      const result = await chat.sendMessageStream(text);
      
      let fullResponse = '';
      let characterCount = 0;
      let firstChunkReceived = false;

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        characterCount += chunkText.length;
        
        if (!firstChunkReceived && chunkText.length > 0) {
          firstChunkReceived = true;
          if (!fullResponse.trim().startsWith('```json')) {
            console.log('Первая строка не содержит ```json - пробуем снова', fullResponse);
            break;
          }
        }
        
        process.stdout.write(`\rПолучено символов: ${characterCount}`);
      }
      
      if (fullResponse.trim().startsWith('```json')) {
        const lines = fullResponse.split('\n');
        const jsonLines = lines.slice(1, -1).join('\n');
        console.log(jsonLines);
        return JSON.parse(jsonLines);
      }
      
      if (attempt === maxRetries) {
        throw new Error('Превышено максимальное количество попыток получить JSON ответ');
      }
      
    } catch (error) {
      if (attempt === maxRetries) {
        console.error('Error in run function:', error);
        throw error;
      }
    }
  }
}

module.exports = { run };
