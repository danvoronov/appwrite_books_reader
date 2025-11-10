# Команды для развертывания на Appwrite

## 1. Авторизация
```bash
appwrite login
# Следуйте инструкциям в браузере для авторизации
```

## 2. Настройка проекта
```bash
# Настройка клиента
appwrite client --endpoint https://fra.cloud.appwrite.io/v1
appwrite client --project-id 690f8b5b0012faa10454
```

## 3. Создание функции (Backend API)
```bash
appwrite functions create \
  --function-id rem-backend \
  --name "REM Backend API" \
  --runtime node-18.0 \
  --execute any \
  --timeout 60 \
  --enabled true \
  --logging true
```

## 4. Развертывание кода функции
```bash
cd functions/rem-backend
appwrite functions create-deployment \
  --function-id rem-backend \
  --entrypoint "src/index.js" \
  --code "." \
  --activate true
cd ../..
```

## 5. Создание bucket для статических файлов
```bash
appwrite storage create-bucket \
  --bucket-id static-files \
  --name "Static Files" \
  --permissions 'read("any")'
```

## 6. Загрузка статических файлов
```bash
# Загрузка HTML
appwrite storage create-file \
  --bucket-id static-files \
  --file-id index-html \
  --file ./static/index.html

# Загрузка CSS
appwrite storage create-file \
  --bucket-id static-files \
  --file-id styles-css \
  --file ./static/styles.css

# Загрузка JS библиотек
appwrite storage create-file \
  --bucket-id static-files \
  --file-id marked-js \
  --file ./static/marked.min.js

# Загрузка модулей (по одному)
appwrite storage create-file \
  --bucket-id static-files \
  --file-id appwrite-client-js \
  --file ./static/modules/AppwriteClient.js

appwrite storage create-file \
  --bucket-id static-files \
  --file-id book-processor-js \
  --file ./static/modules/BookProcessor.js

appwrite storage create-file \
  --bucket-id static-files \
  --file-id book-selection-js \
  --file ./static/modules/BookSelection.js

appwrite storage create-file \
  --bucket-id static-files \
  --file-id chapter-manager-js \
  --file ./static/modules/ChapterManager.js

appwrite storage create-file \
  --bucket-id static-files \
  --file-id chapter-reader-js \
  --file ./static/modules/ChapterReader.js

appwrite storage create-file \
  --bucket-id static-files \
  --file-id processing-manager-js \
  --file ./static/modules/ProcessingManager.js

appwrite storage create-file \
  --bucket-id static-files \
  --file-id utils-js \
  --file ./static/modules/Utils.js

appwrite storage create-file \
  --bucket-id static-files \
  --file-id url-router-js \
  --file ./static/modules/UrlRouter.js
```

## 7. Проверка развертывания
```bash
# Проверяем функции
appwrite functions list

# Проверяем bucket
appwrite storage list-buckets

# Проверяем файлы
appwrite storage list-files --bucket-id static-files
```

## URL для доступа к приложению
После успешного развертывания ваше приложение будет доступно по адресу:
```
https://fra.cloud.appwrite.io/v1/storage/buckets/static-files/files/index-html/view?project=690f8b5b0012faa10454
```

## Альтернативные команды для загрузки файлов (PowerShell)
```powershell
# Если у вас Windows PowerShell, можете использовать:
Get-ChildItem static/modules/*.js | ForEach-Object { 
    $fileId = $_.BaseName + "-js"
    appwrite storage create-file --bucket-id static-files --file-id $fileId --file $_.FullName
}
```

## Отладка
Если что-то не работает:
```bash
# Посмотреть логи функции
appwrite functions list-executions --function-id rem-backend

# Посмотреть конкретное выполнение
appwrite functions get-execution --function-id rem-backend --execution-id <EXECUTION_ID>
```