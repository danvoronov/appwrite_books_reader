# 🐛 Отладка ошибки GitHub Actions

## ❌ Текущая ошибка:
```
✗ Error: fetch failed
Error: Process completed with exit code 1.
```

## 🔍 Возможные причины:

### 1. **Проблемы с сетью/API**:
- GitHub Actions не может подключиться к Appwrite API
- Временные проблемы с fra.cloud.appwrite.io
- Rate limiting

### 2. **Неправильный Dev Key**:
- Dev Key недействителен
- Недостаточно прав доступа
- Ключ был создан для другого проекта

### 3. **Проблемы с функцией**:
- Функция уже существует и конфликтует
- Неправильная структура файлов
- Проблемы с package.json

## 🔧 Исправления добавлены в workflow:

### ✅ **Добавлена детальная диагностика**:
```yaml
- name: 🔑 Setup Appwrite CLI
  run: |
    echo "🔧 Setting up Appwrite CLI..."
    appwrite client --endpoint ${{ env.APPWRITE_ENDPOINT }}
    appwrite client --project-id ${{ env.APPWRITE_PROJECT_ID }}
    appwrite client --key "${{ secrets.APPWRITE_API_KEY }}"
    echo "✅ Appwrite CLI configured"
    echo "🧪 Testing connection..."
    appwrite health get || echo "⚠️ Health check failed, but continuing..."
```

### ✅ **Verbose логирование**:
```yaml
--verbose
```

### ✅ **Проверка файлов перед деплоем**:
```yaml
echo "📂 Current directory: $(pwd)"
echo "📋 Files in directory:"
ls -la
echo "📦 Package.json content:"
cat package.json
```

## 🚀 Попробуйте обновленный workflow:

1. **Commit изменения**:
```bash
git add .
git commit -m "Debug: Add verbose logging and diagnostics"
git push origin main
```

2. **Проверьте логи** в Actions tab для более детальной информации

## 🔄 Альтернативные решения:

### Вариант A: Упрощенный workflow
Если проблемы остаются, попробуйте создать только bucket и функцию без деплоя:

```yaml
- name: 🧪 Test Connection Only
  run: |
    appwrite functions list
    appwrite storage list-buckets
```

### Вариант B: Ручное развертывание
Используйте `MANUAL_DEPLOYMENT.md` для развертывания через веб-консоль.

### Вариант C: Проверка Dev Key
1. Убедитесь, что Dev Key создан для проекта `690f8b5b0012faa10454`
2. Проверьте, что все scopes выбраны
3. Пересоздайте ключ если нужно

## 🧪 Что покажет обновленный workflow:

При успехе:
```
✅ Appwrite CLI configured
✅ Testing connection...
✅ Creating function rem-backend...
📂 Current directory: /home/runner/work/rem-by-gemini-appwrite/rem-by-gemini-appwrite/functions/rem-backend
📋 Files in directory:
✅ Function deployed successfully
```

При ошибке - более детальная информация о том, что именно не работает.

---

**🔧 Попробуйте обновленный workflow с диагностикой!**