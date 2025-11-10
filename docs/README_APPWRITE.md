# REM by Gemini - Appwrite Deployment

## 🚀 Быстрый старт развертывания на Appwrite

Этот проект адаптирован для развертывания на платформе [Appwrite](https://appwrite.io/).

### 📁 Структура для Appwrite

```
📦 Проект
├── 🌐 static/                    # Фронтенд для Static Hosting
│   ├── index.html               # Основной HTML
│   ├── styles.css              # Стили
│   ├── marked.min.js           # Markdown парсер
│   └── modules/                # JS модули
│       ├── AppwriteClient.js   # Клиент для Appwrite API
│       ├── BookProcessor.js    # Основная логика
│       └── ...                # Остальные модули
├── ⚙️ functions/                # Бэкенд Functions
│   └── rem-backend/
│       ├── src/index.js        # API обработчик
│       └── package.json        # Зависимости
├── 📋 appwrite.json            # Конфигурация проекта
├── 🔧 .appwriterc              # Настройки CLI
└── 📖 deploy.md                # Подробные инструкции
```

### ⚡ Что изменилось

1. **API вызовы** перенесены с `fetch()` на Appwrite Functions
2. **Добавлен AppwriteClient.js** для работы с Appwrite SDK
3. **Статические файлы** подготовлены для Storage
4. **Конфигурация** адаптирована для Appwrite

### 🛠 Быстрое развертывание

```bash
# 1. Установите Appwrite CLI
npm install -g appwrite-cli

# 2. Авторизуйтесь
appwrite login

# 3. Разверните функцию
appwrite functions create --functionId=rem-backend --name="REM Backend API" --runtime="node-18.0" --execute="any"

# 4. Загрузите код функции
cd functions/rem-backend
appwrite functions createDeployment --functionId=rem-backend --entrypoint="src/index.js" --code="."

# 5. Создайте bucket для статических файлов
appwrite storage createBucket --bucketId=static-files --name="Static Files" --permissions='["read("any")"]'
```

### 🔗 После развертывания

Ваше приложение будет доступно по адресу:
`https://fra.cloud.appwrite.io/v1/storage/buckets/static-files/files/index_html/view?project=690f8b5b0012faa10454`

### 📚 Дополнительная информация

- Подробные инструкции: [`deploy.md`](deploy.md)
- Конфигурация проекта: [`appwrite.json`](appwrite.json)
- Оригинальная документация: [`docs/README_web.md`](docs/README_web.md)

### 🔧 Локальная разработка

Для локального тестирования используйте оригинальный сервер:
```bash
npm run web  # Запуск на localhost:3456
```

Для Appwrite development:
```bash
appwrite functions createDeployment --functionId=rem-backend --activate=false  # Тестовый деплой
```