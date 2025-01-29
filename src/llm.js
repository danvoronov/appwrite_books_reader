const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");


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

  try {

    const chatSession = generator.startChat({
      generationConfig,
      history: [{role: "user", parts: [{text}]}]
    });

    console.log(`запрос послали на модель ${model}`)
    
    const result = await chatSession.sendMessageStream('');
      
    let fullResponse = '';
    let characterCount = 0;
    let firstChunkReceived = false;

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      characterCount += chunkText.length;
      
      // if (!firstChunkReceived && chunkText.length > 0) {
      //   firstChunkReceived = true;
      //   if (!fullResponse.trim().startsWith('```json')) {
      //     console.log('Первая строка не содержит ```json - пробуем снова', fullResponse);
      //     break;
      //   }
      // }
      
      process.stdout.write(`\rПолучено символов: ${characterCount}`);
    }    

    if (fullResponse.trim().startsWith('```json')) {
      const lines = fullResponse.split('\n');
      const jsonLines = lines.slice(1, -1).join('\n');
      console.log('jsonLines', jsonLines);
      return JSON.parse(jsonLines);
    }

    console.log({fullResponse})
    return {summary: '', cards: []}

  } catch (error) {
    console.error('Error in run function:', error);
  }

}

// экспортируй ран
module.exports = { run };
