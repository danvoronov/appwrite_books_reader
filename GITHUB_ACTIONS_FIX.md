# 🔧 Исправление GitHub Actions для Appwrite

## ❌ Проблема:
```
error: unknown option '--method=key'
```

## ✅ Решение:

Appwrite CLI не поддерживает `--method=key`. Нужно использовать другой метод авторизации.

### 1. **Обновите workflow файл** (уже исправлено):

Изменено в `.github/workflows/deploy-appwrite.yml`:
```yaml
- name: 🔑 Setup Appwrite CLI
  run: |
    appwrite client --endpoint ${{ env.APPWRITE_ENDPOINT }}
    appwrite client --project-id ${{ env.APPWRITE_PROJECT_ID }}
    appwrite client --key "${{ secrets.APPWRITE_API_KEY }}"
```

### 2. **Проверьте API ключ в GitHub Secrets**:

1. **Repository** → **Settings** → **Secrets and variables** → **Actions**
2. Убедитесь, что `APPWRITE_API_KEY` существует
3. **Важно**: API ключ должен быть **Server API Key**, не Project API Key

### 3. **Создайте Dev Key в Appwrite**:

1. [Appwrite Console](https://cloud.appwrite.io/project-690f8b5b0012faa10454)
2. **Settings** → **API Keys** → **Create your first dev key**
3. **Type**: **Dev Key** (обходит rate limits и CORS)
4. **Name**: `GitHub Actions Dev Key`
5. **Scopes**: выберите все необходимые:
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

### 4. **Альтернативный workflow** (если проблемы остаются):

Создан упрощенный workflow - используйте только основные команды:

```yaml
- name: 🔑 Setup Appwrite
  run: |
    appwrite client --endpoint https://fra.cloud.appwrite.io/v1
    appwrite client --project-id 690f8b5b0012faa10454
    echo "Using API Key from secrets"
  env:
    APPWRITE_API_KEY: ${{ secrets.APPWRITE_API_KEY }}
```

### 5. **Проверка после исправления**:

1. **Commit и push** обновленный workflow
2. **Перейдите в Actions tab** и проверьте новый запуск
3. **Логи должны показывать**:
   ```
   ✅ Setup Node.js
   ✅ Install Appwrite CLI  
   ✅ Setup Appwrite CLI
   ✅ Create or Update Function
   ```

### 6. **Если всё еще есть проблемы**:

#### Вариант A: Ручная настройка переменных
После создания функции через GitHub Actions, переменные окружения нужно настроить вручную в веб-консоли.

#### Вариант B: Минимальный workflow
Используйте только создание функции и bucket, остальное настройте через веб-консоль.

#### Вариант C: Полностью ручное развертывание
Следуйте `MANUAL_DEPLOYMENT.md` для развертывания через веб-интерфейс.

## 🚀 Попробуйте сейчас:

1. **Убедитесь, что API ключ правильный** (Server API Key)
2. **Commit изменения**:
   ```bash
   git add .
   git commit -m "Fix: Update Appwrite CLI authentication"
   git push origin main
   ```
3. **Проверьте Actions tab** в репозитории

## 📱 Результат после успешного запуска:

Ваше приложение будет доступно:
```
https://fra.cloud.appwrite.io/v1/storage/buckets/static-files/files/index-html/view?project=690f8b5b0012faa10454
```

---

**🔧 Попробуйте обновленный workflow - он должен заработать!**