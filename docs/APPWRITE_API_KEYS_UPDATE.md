# 🔑 Обновленные инструкции по API ключам Appwrite

## ✅ Правильный тип ключа для GitHub Actions

В новых версиях Appwrite есть разные типы API ключей:

### 🔧 **Dev Keys** (рекомендуется для развертывания):
- **Описание**: "Dev keys allow bypassing rate limits and CORS errors in your development environment"
- **Подходит для**: GitHub Actions, автоматическое развертывание, разработка
- **Права**: полный доступ к API

### 📊 **Regular API Keys**:
- **Описание**: Обычные API ключи с ограничениями
- **Подходит для**: продакшн использование с ограниченными правами

## 🚀 Создание Dev Key для GitHub Actions:

### 1. **Откройте Appwrite Console**:
```
https://cloud.appwrite.io/project-690f8b5b0012faa10454
```

### 2. **Создайте Dev Key**:
1. **Settings** → **API Keys**
2. **Create your first dev key** (или **Create Dev Key**)
3. **Name**: `GitHub Actions Dev Key`
4. **Scopes**: выберите все необходимые:
   ```
   ✅ functions.read
   ✅ functions.write  
   ✅ files.read
   ✅ files.write
   ✅ buckets.read
   ✅ buckets.write
   ✅ executions.read
   ✅ executions.write
   ```

### 3. **Скопируйте ключ**:
После создания сразу скопируйте ключ - он показывается только один раз!

### 4. **Обновите GitHub Secret**:
1. **Repository** → **Settings** → **Secrets and variables** → **Actions**
2. Найдите `APPWRITE_API_KEY` и нажмите **Update**
3. Вставьте новый Dev Key
4. **Update secret**

## 🔄 Обновленный workflow уже готов:

GitHub Actions workflow уже исправлен для работы с Dev Keys:
```yaml
- name: 🔑 Setup Appwrite CLI
  run: |
    appwrite client --endpoint ${{ env.APPWRITE_ENDPOINT }}
    appwrite client --project-id ${{ env.APPWRITE_PROJECT_ID }}
    appwrite client --key "${{ secrets.APPWRITE_API_KEY }}"
```

## 🚀 Запуск развертывания:

После обновления Secret:
```bash
git add .
git commit -m "Ready for deployment with Dev Key"
git push origin main
```

## ✅ Ожидаемый результат:

GitHub Actions должен успешно:
1. ✅ Авторизоваться с Dev Key
2. ✅ Создать функцию `rem-backend`  
3. ✅ Загрузить код функции
4. ✅ Создать bucket `static-files`
5. ✅ Загрузить статические файлы

## 📱 Приложение будет доступно:
```
https://fra.cloud.appwrite.io/v1/storage/buckets/static-files/files/index-html/view?project=690f8b5b0012faa10454
```

## 🔧 Финальная настройка:

После успешного развертывания через GitHub Actions, настройте переменную окружения для функции:

1. **Functions** → **rem-backend** → **Settings** → **Environment Variables**
2. **Add Variable**:
   - **Key**: `APPWRITE_API_KEY`  
   - **Value**: тот же Dev Key

Это нужно для того, чтобы функция могла обращаться к Storage bucket "books".

---

**🎉 С Dev Key GitHub Actions должен заработать без проблем!**

**Создайте Dev Key и попробуйте развертывание!**