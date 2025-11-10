# 📖 REM by Gemini - Appwrite Edition

Веб-приложение для чтения и обработки книг с помощью ИИ, развернутое на платформе Appwrite.

## 🚀 Развертывание через GitHub Actions

### 1. Настройка репозитория

1. **Создайте GitHub репозиторий** и загрузите этот код
2. **Добавьте Secrets в GitHub**:
   - `Settings` → `Secrets and variables` → `Actions` → `New repository secret`
   - **Name**: `APPWRITE_API_KEY`
   - **Value**: ваш API ключ Appwrite с правами на Functions и Storage

### 2. Создание API ключа в Appwrite

1. Откройте [Appwrite Console](https://cloud.appwrite.io/project-690f8b5b0012faa10454)
2. `Settings` → `API Keys` → `Create API Key`
3. **Name**: `GitHub Deploy Key`
4. **Scopes**: выберите все необходимые права:
   - ✅ `functions.read` + `functions.write`
   - ✅ `files.read` + `files.write` 
   - ✅ `buckets.read` + `buckets.write`

### 3. Автоматическое развертывание

После push в main/master ветку GitHub Actions автоматически:
- 🔧 Создаст/обновит Appwrite Function `rem-backend`
- 📤 Загрузит статические файлы в Storage
- 🔑 Настроит переменные окружения
- ✅ Проверит статус развертывания

## 🔗 После развертывания

### 📱 URL приложения:
```
https://fra.cloud.appwrite.io/v1/storage/buckets/static-files/files/index-html/view?project=690f8b5b0012faa10454
```

### 🧪 Тестирование:
1. Откройте `TEST_STORAGE_INTEGRATION.html` в браузере
2. Проверьте доступ к bucket "books"
3. Протестируйте API функции

### 📊 Мониторинг:
- **Function логи**: Console → Functions → rem-backend → Executions
- **Storage файлы**: Console → Storage → books / static-files
- **GitHub Actions**: Repository → Actions tab

## 🏗 Архитектура

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GitHub Repo   │───▶│  GitHub Actions  │───▶│   Appwrite      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────────────────────┼─────────────────────────────────┐
                       │                                 │                                 │
                       ▼                                 ▼                                 ▼
              ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
              │  Static Hosting │              │    Functions    │              │     Storage     │
              │   (Frontend)    │              │   (Backend)     │              │    (Books)      │
              └─────────────────┘              └─────────────────┘              └─────────────────┘
```

## 🔧 Локальная разработка

```bash
# Запуск локального сервера (для разработки)
npm run web

# Тестирование изменений
npm test

# Деплой в Appwrite (при наличии CLI сессии)
npm run deploy
```

## 📁 Структура проекта

```
📦 rem-by-gemini-appwrite
├── 🌐 static/                    # Frontend для Appwrite Storage
│   ├── index.html               # Главная страница
│   ├── styles.css              # Стили
│   ├── marked.min.js           # Markdown парсер
│   └── modules/                # JS модули
│       ├── AppwriteClient.js   # Интеграция с Appwrite
│       └── ...                # Остальные модули
├── ⚙️ functions/                # Appwrite Functions
│   └── rem-backend/
│       ├── src/index.js        # API обработчик
│       └── package.json        # Зависимости
├── 🔄 .github/workflows/        # GitHub Actions
│   └── deploy-appwrite.yml     # Автоматическое развертывание
└── 📋 docs/                    # Документация
```

## 🎯 Особенности

- ✅ **Интеграция с Storage "books"** - работа с вашими epub файлами
- ✅ **Автоматическое развертывание** через GitHub Actions
- ✅ **Fallback логика** при ошибках доступа к API
- ✅ **Responsive design** для мобильных устройств
- ✅ **Real-time обработка** (планируется)

## 🛠 Поддержка

При возникновении проблем:
1. Проверьте логи в GitHub Actions
2. Убедитесь в правильности API ключа
3. Проверьте права доступа к bucket "books"
4. Откройте issue в репозитории

---

**🎉 Приложение готово к работе с вашими книгами из Appwrite Storage!**