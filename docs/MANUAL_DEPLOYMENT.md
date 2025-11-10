# 📋 Ручное развертывание на Appwrite

Поскольку CLI требует авторизации, давайте развернем приложение через веб-консоль Appwrite.

## 🚀 Пошаговое развертывание

### 1. 🔑 Создайте API ключ

1. Откройте [Appwrite Console](https://cloud.appwrite.io/project-690f8b5b0012faa10454)
2. **Settings** → **API Keys** → **Create API Key**
3. **Name**: `Deployment Key`
4. **Scopes**: выберите все необходимые:
   - ✅ `functions.read` + `functions.write`
   - ✅ `files.read` + `files.write`
   - ✅ `buckets.read` + `buckets.write`
   - ✅ `executions.read` + `executions.write`

### 2. ⚙️ Создайте функцию

1. **Functions** → **Create Function**
2. **Function ID**: `rem-backend`
3. **Name**: `REM Backend API`
4. **Runtime**: `Node.js 18.0`
5. **Execute Access**: `Any`
6. **Timeout**: `60` секунд
7. **Enabled**: ✅

### 3. 📤 Загрузите код функции

1. **Functions** → **rem-backend** → **Deployments** → **Create deployment**
2. **Entrypoint**: `src/index.js`
3. **Commands**: `npm install`
4. **Upload**: Заархивируйте папку `functions/rem-backend/` в .tar.gz и загрузите
   ```bash
   cd functions && tar -czf rem-backend.tar.gz rem-backend/
   ```
5. **Activate** после загрузки

### 4. 🔧 Настройте переменные окружения

1. **Functions** → **rem-backend** → **Settings** → **Environment Variables**
2. **Add Variable**:
   - **Key**: `APPWRITE_API_KEY`
   - **Value**: API ключ из шага 1

### 5. 📁 Создайте bucket для статических файлов

1. **Storage** → **Create Bucket**
2. **Bucket ID**: `static-files`
3. **Name**: `Static Files`
4. **Permissions**: `read("any")`

### 6. 📤 Загрузите статические файлы

Загрузите все файлы из папки `static/` в bucket `static-files`:

**Основные файлы:**
- `index.html` (File ID: `index-html`)
- `styles.css` (File ID: `styles-css`)
- `marked.min.js` (File ID: `marked-js`)

**Модули (из папки `static/modules/`):**
- `AppwriteClient.js` (File ID: `module-appwrite-client-js`)
- `BookProcessor.js` (File ID: `module-book-processor-js`)
- `BookSelection.js` (File ID: `module-book-selection-js`)
- `ChapterManager.js` (File ID: `module-chapter-manager-js`)
- `ChapterReader.js` (File ID: `module-chapter-reader-js`)
- `ProcessingManager.js` (File ID: `module-processing-manager-js`)
- `ProgressTracker.js` (File ID: `module-progress-tracker-js`)
- `ReadingCalendar.js` (File ID: `module-reading-calendar-js`)
- `UrlRouter.js` (File ID: `module-url-router-js`)
- `Utils.js` (File ID: `module-utils-js`)
- `WebSocketClient.js` (File ID: `module-websocket-client-js`)

### 7. ✅ Проверка развертывания

#### Проверка функции:
1. **Functions** → **rem-backend** → **Executions**
2. Попробуйте тестовый запрос через консоль

#### Проверка статических файлов:
1. **Storage** → **static-files** 
2. Убедитесь, что все файлы загружены
3. Проверьте права доступа bucket

## 📱 URL приложения

После успешного развертывания ваше приложение будет доступно:
```
https://fra.cloud.appwrite.io/v1/storage/buckets/static-files/files/index-html/view?project=690f8b5b0012faa10454
```

## 🧪 Тестирование

1. **Откройте основное приложение** по ссылке выше
2. **Откройте TEST_STORAGE_INTEGRATION.html** для детального тестирования
3. **Проверьте логи функции** в Appwrite Console

## ⚡ Быстрое развертывание через Node.js

Если у вас есть Node.js и npm:
```bash
# Установите зависимости
npm install node-appwrite

# Установите API ключ
export APPWRITE_API_KEY="your_api_key_here"

# Запустите скрипт развертывания
node tmp_rovodev_deploy_script.js
```

## 🔧 Альтернативное развертывание

### Вариант 1: Через cURL API
```bash
# Создание функции
curl -X POST https://fra.cloud.appwrite.io/v1/functions \
  -H "X-Appwrite-Project: 690f8b5b0012faa10454" \
  -H "X-Appwrite-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"functionId":"rem-backend","name":"REM Backend API","runtime":"node-18.0","execute":["any"]}'
```

### Вариант 2: Через GitHub Actions
Следуйте инструкциям в `GITHUB_SETUP.md` для автоматического развертывания.

---

**🎉 После выполнения всех шагов ваше приложение будет полностью функциональным на Appwrite!**