# Death By Chocolate — Ücretsiz 7/24 Demo Deploy Rehberi (Netlify + Supabase)

Bu proje bilgisayarınız kapalıyken de kuzeninizin telefonundan ve şube tabletinden erişebilmesi için **Netlify (Next.js)** + **Supabase (Ücretsiz PostgreSQL)** ile 5–10 dakikada yayına alınabilir. Kredi kartı gerekmez.

---

## Adım 1: Supabase'de Ücretsiz PostgreSQL Veritabanı Açın

1. [supabase.com](https://supabase.com) üzerinden ücretsiz hesap açıp **New Project** oluşturun (Bölge: **Frankfurt / eu-central-1** seçmeniz Türkiye için en hızlısıdır).
2. Proje açılınca üstteki **Connect** butonuna tıklayın ve **URI** sekmesinden şu 2 bağlantı adresini kopyalayın (`[YOUR-PASSWORD]` yerine belirlediğiniz DB şifresini yazın):
   - **`DATABASE_URL`** → **Transaction pooler** (port `6543`, sonuna `?pgbouncer=true` ekleyin)
   - **`DIRECT_URL`** → **Direct connection** (port `5432`, yoksa **Session pooler** port `5432`)

---

## Adım 2: Tabloları, Menüyü ve Rapor Verilerini Supabase'e Yükleyin

Bilgisayarınızdaki terminalde proje klasörü içindeyken şu tek komutu çalıştırın:

```bash
DATABASE_URL="SUPABASE_TRANSACTION_POOLER_URL?pgbouncer=true" \
DIRECT_URL="SUPABASE_DIRECT_URL" \
npm run db:deploy
```

Bu komut tüm tabloları, 3 şubeyi, 20 kategoriyi, 149 ürünü, opsiyon gruplarını, demo hesapları ve 90 günlük rapor örnek verilerini Supabase'e otomatik yükler.

---

## Adım 3: Projeyi GitHub'a Yükleyin

Proje zaten temiz bir Git deposu olarak hazırlanmıştır. GitHub'da yeni (boş) bir repo oluşturup push edin:

```bash
git remote add origin https://github.com/KULLANICI_ADINIZ/deathbychocolate.git
git push -u origin main
```

---

## Adım 4: Netlify'da Yayınlayın

1. [app.netlify.com](https://app.netlify.com) üzerinden **Add new site → Import an existing project → GitHub** ile reponuzu seçin.
2. Build ayarları `netlify.toml` dosyasından otomatik okunacaktır (`npx prisma generate && npm run build`).
3. **Environment variables (Ortam Değişkenleri)** bölümüne şu 6 değişkeni ekleyin:

| Anahtar | Değer |
| :--- | :--- |
| `DATABASE_URL` | Supabase Transaction Pooler URL (`?pgbouncer=true`) |
| `DIRECT_URL` | Supabase Direct (veya Session Pooler) URL |
| `JWT_SECRET` | Rastgele uzun bir şifre (en az 32 karakter) |
| `SMS_MODE` | `test` |
| `PAYTR_MODE` | `mock` |
| `NEXT_PUBLIC_APP_URL` | Netlify'ın verdiği adres (örn. `https://deathbychocolate-demo.netlify.app`) |

4. **Deploy site** butonuna basın. İlk kurulum bittiğinde oluşan `https://....netlify.app` linkini doğrudan kuzeninize gönderebilirsiniz.

> **Not:** İleride domain ve kendi VPS/Oracle sunucunuzu aldığınızda aynı repo ve `docker-compose.yml` ile tek satır kod değiştirmeden kendi sunucunuza taşıyabilirsiniz.
