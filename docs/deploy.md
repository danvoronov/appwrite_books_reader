# Развертывание REM by Gemini на Appwrite

## Подготовка

1. **Установите Appwrite CLI:**
```bash
npm install -g appwrite-cli
```

2. **Авторизуйтесь в Appwrite:**
```bash
appwrite login
```

3. **Инициализируйте проект:**
```bash
appwrite init project
```

## Развертывание Function (Backend API)

1. **Создайте функцию:**
```bash
appwrite functions create \
  --functionId=rem-backend \
  --name="REM Backend API" \
  --runtime="node-18.0" \
  --execute="any" \
  --timeout=60 \
  --enabled=true \
  --logging=true \
  --entrypoint="src/index.js" \
  --commands="npm install"
```

2. **Развертывание кода функции:**
```bash
cd functions/rem-backend
appwrite functions createDeployment \
  --functionId=rem-backend \
  --entrypoint="src/index.js" \
  --code="."
```

## Развертывание Static Hosting (Frontend)

1. **Загрузите статические файлы:**
```bash
cd static
appwrite storage createBucket \
  --bucketId=static-files \
  --name="Static Files" \
  --permissions='["read("any")"]'

# Загрузите все файлы
find . -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" \) -exec \
appwrite storage createFile \
  --bucketId=static-files \
  --fileId=$(echo {} | sed 's|./||' | tr '/' '_') \
  --filePath={} \;
```

2. **Или используйте Appwrite Web IDE для загрузки файлов из папки `static/`**

## Настройка доменов и CORS

1. **В веб-консоли Appwrite добавьте домены:**
   - Перейдите в Settings → Domains
   - Добавьте ваши домены (например, your-app.appwrite.global)

2. **Настройте CORS для функций:**
   - В настройках функции добавьте allowed origins
   - Или используйте "*" для разработки

## Структура развертывания

```
Appwrite Project (690f8b5b0012faa10454)
├── Functions/
│   └── rem-backend/          # API бэкенд
│       ├── src/index.js      # Основная логика
│       └── package.json      # Зависимости
├── Storage/
│   └── static-files/         # Фронтенд файлы
│       ├── index.html
│       ├── styles.css
│       └── modules/
│           ├── BookProcessor.js
│           ├── AppwriteClient.js
│           └── ...
└── Databases/ (будущее расширение)
    └── chapters-db/          # Хранение данных о главах
```

## URL-адреса после развертывания

- **Frontend**: `https://fra.cloud.appwrite.io/v1/storage/buckets/static-files/files/index_html/view?project=690f8b5b0012faa10454`
- **API Function**: `https://fra.cloud.appwrite.io/v1/functions/rem-backend/executions`

## Следующие шаги

1. **Интеграция с базой данных** - для хранения книг и глав
2. **Файловое хранилище** - для epub файлов и обработанных глав
3. **Аутентификация** - если нужно разграничение доступа
4. **Кастомный домен** - для удобного URL

## Команды для быстрого развертывания

```bash
# 1. Создание и развертывание функции
appwrite functions create --functionId=rem-backend --name="REM Backend API" --runtime="node-18.0" --execute="any"
cd functions/rem-backend && appwrite functions createDeployment --functionId=rem-backend --entrypoint="src/index.js" --code="."

# 2. Создание bucket для статических файлов
appwrite storage createBucket --bucketId=static-files --name="Static Files" --permissions='["read("any")"]'

# 3. Загрузка фронтенда (выполнить из папки static/)
for file in $(find . -name "*.html" -o -name "*.css" -o -name "*.js"); do
  appwrite storage createFile --bucketId=static-files --fileId=$(echo $file | sed 's|./||' | tr '/' '_' | tr '.' '_') --filePath="$file"
done
```

Ваше приложение будет доступно через Appwrite!