# MySQL Prepared Statement Error Fix

## Probléma

Node.js 16 + MySQL + Sequelize kombináció esetén `ER_NEED_REPREPARE` hibák léphetnek fel connection pooling miatt.

```
Error: Prepared statement needs to be re-prepared
Code: ER_NEED_REPREPARE
```

## 🎯 Globális Megoldás (Automatikus)

**Sequelize-szintű retry logic** lett beállítva a `config/database.js`-ben:

```javascript
const sequelize = new Sequelize(database.database, database.user, database.password, {
  // ... other config
  retry: {
    max: 3,
    match: [
      /ER_NEED_REPREPARE/,
      /Prepared statement needs to be re-prepared/
    ]
  }
});
```

✅ **Ez automatikusan kezeli az ÖSSZES `save()` és `update()` műveletet!**
✅ Nincs szükség kód módosításra
✅ Központi konfiguráció

## Manuális Megoldás (Opcionális)

Használd a központi `withRetry` helper függvényt minden kritikus `save()` és `update()` művelethez.

## Használat

### Import

```javascript
const { User, withRetry } = require('../models');
```

### Model.save() helyett

**Előtte:**
```javascript
await user.save();
```

**Utána:**
```javascript
await withRetry(() => user.save());
```

### Model.update() helyett

**Előtte:**
```javascript
await user.update({ name: 'John', email: 'john@example.com' });
```

**Utána:**
```javascript
await withRetry(() => user.update({ 
  name: 'John', 
  email: 'john@example.com' 
}));
```

### Több művelet egyszerre

```javascript
await withRetry(async () => {
  user.name = 'John';
  user.email = 'john@example.com';
  await user.save();
});
```

### Custom retry szám

```javascript
// Maximum 5 próbálkozás (alapértelmezett: 3)
await withRetry(() => user.save(), 5);
```

## Már Javított Helyek

✅ **models/User.js**
- `incrementLoginAttempts()`
- `resetLoginAttempts()`
- `updateLastLogin()` - retry logic

✅ **routes/auth/profile.js**
- Email verification token save
- Profile update

✅ **services/authService.js**
- `changePassword()` - raw SQL query használat (alternatív megoldás)

## Még Javítandó Helyek (prioritás szerint)

### Magas prioritás (gyakran használt):
- [ ] `routes/admin-users.js` - user save/update műveletek
- [ ] `routes/auth/email.js` - email változtatás műveletek
- [ ] `models/ChatSession.js` - chat session save műveletek

### Közepes prioritás:
- [ ] `services/chatService.js` - session save
- [ ] `services/availabilityService.js` - availability save
- [ ] `routes/admin-cron.js` - cron job save

### Alacsony prioritás (ritkán használt):
- [ ] Admin partner/category műveletek
- [ ] Blog műveletek
- [ ] FAQ műveletek
- [ ] Script-ek (egyszeri futás)

## Alternatív Megoldás: Raw SQL

Kritikus műveleteknél (pl. jelszóváltoztatás) használj raw SQL query-t:

```javascript
const { sequelize } = require('../models');

await sequelize.query(
  'UPDATE users SET password = ?, updatedAt = NOW() WHERE id = ?',
  {
    replacements: [hashedPassword, userId],
    type: sequelize.QueryTypes.UPDATE
  }
);
```

## Teszt

```bash
# Ellenőrizd a logokat
grep "ER_NEED_REPREPARE" ~/logs/passenger.log

# Ha nincs találat, a fix működik! ✅
```

## Kapcsolódó Commit-ok

- `bb2c871` - Add centralized withRetry helper
- `ba296f9` - Use raw SQL query for password update
- `c22d98f` - Preserve model changes during retry attempts
- `a673d00` - Add retry logic for MySQL prepared statement errors
