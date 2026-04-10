# Invairo

Full-stack SaaS для учёта рабочих смен, расчёта оплаты и выставления счетов.

## Возможности

- Добавление/редактирование смен: дата, время начала/окончания, обед, комментарий, клиент
- Расчёт длительности и оплаты; поддержка смен, переходящих через полночь
- Фильтр итогов по неделе или месяцу
- Управление клиентами и продуктами
- Генерация PDF-инвойсов на стороне клиента
- Светлая тема, адаптация под мобильные устройства (PWA)

## Стек

**Frontend:** React 19 + TypeScript + Vite, IndexedDB (Dexie) как локальный кэш

**Backend:** Node.js + Express 5 + PostgreSQL (Neon.tech)

**Деплой:** Hostinger (lsnode/LiteSpeed), автодеплой через GitHub Actions

## Установка и запуск

```bash
# Зависимости
npm install  # также устанавливает зависимости сервера (postinstall)

# Разработка (два терминала)
npm run dev                        # Frontend на :5173 (проксирует /api → :3001)
cd my-saas/server && npm run dev   # Backend на :3001

# Сборка и деплой
npm run build    # tsc + vite build → dist/
npm run deploy   # build + git commit + push → GitHub Actions деплоит на Hostinger

# Тесты и линтер
npm run test     # Vitest
npm run lint     # ESLint
```

## Структура

```
src/                        # Frontend
  App.tsx                   # Главный компонент — все вьюхи, стейт, модалки
  api.ts                    # REST-клиент с ротацией JWT-токенов
  db.ts                     # Dexie/IndexedDB — локальный кэш
  types.ts                  # Доменные типы
  lib/calculations.ts       # Расчёты периодов, оплаты, группировки смен
  lib/invoice.ts            # Генерация PDF через pdf-lib

my-saas/server/src/         # Backend
  app.js                    # Express entry point
  routes/                   # auth, shifts, settings, clients, products, billing
  middleware/auth.js         # JWT-верификация
  db/migrate-*.js           # Миграции PostgreSQL (запускать вручную)
```

## Деплой (Hostinger)

- `git push` → GitHub Actions → SSH на Hostinger → `git reset --hard` + `touch tmp/restart.txt`
- Конфиг окружения: `~/domains/invairo.com.au/public_html/.builds/config/.env`
- SSH: `ssh -i ~/.ssh/hostinger_deploy -p 65002 u673267555@153.92.9.238`
- `dist/` коммитится в репозиторий — сервер не может пересобрать проект
