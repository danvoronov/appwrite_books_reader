const fs = require('fs');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

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

// Определение схемы (Strict JSON Schema)
const remnoteSchema = {
  type: SchemaType.OBJECT,
  properties: {
    chapter_summary: {
      type: SchemaType.STRING,
      description: "Markdown summary of the chapter, 5-7 sentences.",
    },
    chapter_cards: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          topic: {
            type: SchemaType.STRING,
            description: "Topic name (3-5 words)."
          },
          cards: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.STRING,
              description: "Flashcard string in 'Question >> Answer' format."
            }
          }
        },
        required: ["topic", "cards"]
      }
    }
  },
  required: ["chapter_summary", "chapter_cards"]
};

const generationConfig = {
  responseMimeType: "application/json", // Включает JSON Mode
  responseSchema: remnoteSchema,        // Жесткая фиксация полей
  temperature: 0.2
};

// Системная инструкция загружается один раз при старте модуля

async function runWithProgress(text, progressCallback) {
  const maxRetries = 4;
  const emptyResponse = { chapter_summary: '', chapter_cards: [] };

  console.log('🤖 runWithProgress вызван, длина текста:', text.length);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Choose generator based on attempt number: 1,2 -> MODEL1, 3 -> MODEL2, 4 -> MODEL1
      const useBackup = attempt === 3;
      const currentGenerator = useBackup ? backupGenerator : primaryGenerator;
      const currentModel = useBackup ? secondModel : model;

      console.log(`🔄 Попытка ${attempt}/${maxRetries}, используем модель: ${currentModel}`);

      // Add delay before retries (skip first attempt)
      if (attempt > 1) {
        const delaySeconds = retryDelays[attempt - 2];
        const message = `Waiting ${delaySeconds*2} seconds before attempt ${attempt}...`;
        console.log(`⏳ ${message}`);
        progressCallback({ type: 'progress', message });
        await delay(delaySeconds * 1000*2);
      }

      const message = `Sending request to model ${currentModel} (attempt ${attempt}/${maxRetries})`;
      console.log(`📤 ${message}`);
      progressCallback({ type: 'progress', message });

      console.log('🔧 Создаем chat session...');
      const chatSession = currentGenerator.startChat({
        generationConfig,
        history: [{ role: "user", parts: [{ text }] }]
      });
      
      console.log('📡 Отправляем запрос в LLM...');
      const result = await chatSession.sendMessageStream('');
      console.log('✅ Получен stream от LLM');
      
      let fullResponse = '';
      let characterCount = 0;
      let isFirstLineComplete = false;
      let chunkCounter = 0;

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        chunkCounter++;
        
        if (chunkCounter === 1) {
          console.log('📥 Получен первый chunk от LLM');
        }
        
        // Add chunk to response first
        fullResponse += chunkText;
        characterCount += chunkText.length;
        
        // Check if response starts with JSON object (only once, at the beginning)
        if (!isFirstLineComplete && fullResponse.length > 0) {
          const trimmedStart = fullResponse.trimStart();
          if (trimmedStart.length > 0) {
            isFirstLineComplete = true;
            console.log('📋 Начало ответа:', trimmedStart.substring(0, 50));
            if (!trimmedStart.startsWith('{')) {
              const message = `Response does not start with JSON object on attempt ${attempt}`;
              console.warn(`⚠️ ${message}`);
              progressCallback({ type: 'progress', message });
              // Break the stream early - no need to continue reading
              break;
            } else {
              console.log('✅ Ответ начинается с JSON объекта');
            }
          }
        }
        
        // Логируем каждые 50 чанков или каждые 5000 символов
        if (chunkCounter % 50 === 0 || characterCount % 5000 < chunkText.length) {
          const message = `Received characters: ${formatCharCount(characterCount)}`;
          console.log(`📥 ${message} (chunk #${chunkCounter})`);
          progressCallback({ type: 'progress', message });
        } else {
          // Все равно отправляем прогресс для отображения на фронте
          const message = `Received characters: ${formatCharCount(characterCount)}`;
          progressCallback({ type: 'progress', message });
        }
      }

      console.log(`📥 Получено всего ${chunkCounter} chunks, ${characterCount} символов`);

      // If we broke early due to invalid response format
      const trimmedResponse = fullResponse.trimStart();
      
      // Log full response for debugging
      console.log('📄 Полный ответ от модели:');
      console.log('=' .repeat(80));
      console.log(trimmedResponse.substring(0, 1000)); // Первые 1000 символов
      if (trimmedResponse.length > 1000) {
        console.log(`\n... (еще ${trimmedResponse.length - 1000} символов)`);
      }
      console.log('=' .repeat(80));
      
      if (!trimmedResponse.startsWith('{')) {
        console.warn('⚠️ Ответ не начинается с JSON объекта, пропускаем попытку');
        console.warn('⚠️ Первые 200 символов:', trimmedResponse.substring(0, 200));
        if (attempt === maxRetries) {
          const message = 'All attempts exhausted - failed to get valid JSON response';
          console.error(`❌ ${message}`);
          progressCallback({ type: 'error', message });
          return emptyResponse;
        }
        continue;
      }

      // Parse JSON from the response (no markdown wrapper removal needed)
      console.log('🔍 Парсим JSON из ответа...');
      console.log('🔍 JSON длина:', trimmedResponse.length, 'символов');
      const result_data = JSON.parse(trimmedResponse);
      console.log('✅ JSON успешно распарсен, ключи:', Object.keys(result_data));
      
      progressCallback({ type: 'success', message: 'Successfully processed chapter', data: result_data });
      return result_data;

    } catch (error) {
      const message = `Error on attempt ${attempt}: ${error.message}`;
      console.error(`❌ ${message}`);
      console.error('Stack trace:', error.stack);
      progressCallback({ type: 'error', message });
      
      if (attempt === maxRetries) {
        const message = 'All attempts exhausted - returning empty response';
        console.error(`❌ ${message}`);
        progressCallback({ type: 'error', message });
        return emptyResponse;
      }
    }
  }

  console.error('❌ Не удалось обработать после всех попыток');
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
      
      for await (const chunk of result.stream) {
        fullResponse += chunk.text();
      }
      
      // Parse JSON directly (no markdown wrapper removal needed)
      const trimmedResponse = fullResponse.trimStart();
      
      console.log('📄 Полный ответ для тегов (первые 500 символов):');
      console.log(trimmedResponse.substring(0, 500));
      
      if (!trimmedResponse.startsWith('{')) {
        throw new Error(`Response does not start with JSON object: ${trimmedResponse.substring(0, 100)}`);
      }
      
      const parsed = JSON.parse(trimmedResponse);
      progressCallback && progressCallback({ type: 'success', message: 'Successfully processed tags JSON' });
      return parsed;
    } catch (err) {
      progressCallback && progressCallback({ type: 'error', message: `Error on attempt ${attempt}: ${err.message}` });
      if (attempt === maxRetries) throw err;
    }
  }
}

module.exports = { runWithProgress, runWithInstructionFile };