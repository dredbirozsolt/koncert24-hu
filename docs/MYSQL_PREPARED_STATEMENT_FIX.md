# MySQL Prepared Statement Error Fix

## Probléma

Node.js 16 + MySQL + Sequelize kombináció esetén `ER_NEED_REPREPARE` hibák léphetnek fel connection pooling miatt.

```
Error: Prepared statement needs to be re-prepared
Code: ER_NEED_REPREPARE
```

## 🎯 Globális Megoldás (Automatikus)

**Sequelize query-szintű retry wrapper** lett beállítva a `config/database.js`-ben:

- ✅ **Minden SQL műveletet automatikusan újrapróbál** (save, update, create, destroy)
- ✅ 3 újrapróbálkozás exponenciális visszalépéssel
- ✅ Működik connection pool limitációkkal (pool.max = 2)

**Connection Pool Optimalizáció:**

```javascript
pool: {
  max: 2,           // REDUCED from 5 (kevesebb prepared statement)
  min: 0,
  acquire: 30000,
  idle: 5000,       // REDUCED from 10000 (gyorsabb újrahasznosítás)
  evict: 3000       // ADDED: Idle connection ellenőrzés 3 mp-enként
}
```

**Connection Rotation Service:**

Óránként automatikusan újraindítja a connection pool-t:

- Elkerüli a prepared statement cache túlcsordulást
- Shared hosting megoldás (nem tudunk MySQL szerver változókat módosítani)
- Lásd: `services/connectionRotationService.js`
- Indul automatikusan: `server.js` startup során

```javascript
// Start connection rotation service (1 óránként)
const connectionRotation = new ConnectionRotationService(sequelize, 3600000);
connectionRotation.start();
```

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
