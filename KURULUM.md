# Kurulum Rehberi

Uygulama verilerini **SQL Server** üzerinde tutar. Bu rehber SQL Server'ı
hazırlama ve uygulamayı bağlama adımlarını anlatır.

---

## 1. SQL Server tarafı

Bu adımlar SQL Server'ın kurulu olduğu makinede (VM veya sunucu) yapılır.

### 1.1 Mixed Mode kimlik doğrulamayı açın

Uygulama kullanıcı adı + şifre ile bağlanır, bu yüzden gereklidir.

1. SQL Server Management Studio (SSMS) açın, sunucuya bağlanın.
2. Sunucu adına sağ tık → **Özellikler** → **Güvenlik**.
3. **SQL Server ve Windows Kimlik Doğrulama modu** seçin.
4. Tamam deyin. *(SQL Server servisinin yeniden başlatılması gerekir.)*

Kontrol etmek için:

```sql
SELECT CASE SERVERPROPERTY('IsIntegratedSecurityOnly')
         WHEN 1 THEN 'KAPALI - Mixed Mode acilmali'
         ELSE 'ACIK - sorun yok'
       END AS MixedMode;
```

### 1.2 Bir kullanıcı oluşturun

```sql
CREATE LOGIN modelhane_app WITH PASSWORD = 'GucluBirSifre2026';
ALTER SERVER ROLE dbcreator ADD MEMBER modelhane_app;
```

Veritabanını uygulama üzerinden oluşturacaksanız `dbcreator` yetkisi gerekir.

Şifreyi sonradan değiştirmek için (`CREATE` değil `ALTER`):

```sql
ALTER LOGIN modelhane_app WITH PASSWORD = 'YeniSifre2026', CHECK_POLICY = OFF;
```

Şifrenin doğru olduğunu doğrulamak için:

```sql
SELECT PWDCOMPARE('YeniSifre2026', password_hash) AS SifreDogruMu
FROM sys.sql_logins WHERE name = 'modelhane_app';
```

`1` dönerse şifre eşleşiyor demektir.

### 1.3 TCP/IP protokolünü etkinleştirin

Varsayılan olarak **kapalıdır** — en sık karşılaşılan bağlantı sorunu budur.

1. **SQL Server Configuration Manager** açın.
   *(Bulamazsanız: Windows+R → `SQLServerManager16.msc` — sürüme göre 15/14.)*
2. **SQL Server Ağ Yapılandırması** → **MSSQLSERVER için Protokoller**
   *(`(32bit)` yazan satırı değil, alttakini seçin.)*
3. **TCP/IP** → sağ tık → **Etkinleştir**.
4. **TCP/IP** → çift tık → **IP Adresleri** → en alttaki **IPAll**:
   - `TCP Bağlantı Noktası` = `1433`
   - `TCP Dinamik Bağlantı Noktaları` alanını **boşaltın**
5. **SQL Server Hizmetleri** → **SQL Server (MSSQLSERVER)** → **Yeniden başlat**.

### 1.4 Güvenlik duvarında 1433 portunu açın

PowerShell'i **yönetici olarak** açıp:

```powershell
New-NetFirewallRule -DisplayName "SQL Server 1433" -Direction Inbound -Protocol TCP -LocalPort 1433 -Action Allow
```

### 1.5 IP adresini öğrenin

```powershell
ipconfig
```

`IPv4 Address` satırındaki değeri not edin.

> **VMware kullanıyorsanız:** Ağ bağdaştırıcısı **Bridged** veya **NAT**
> olmalıdır. NAT adresi (`192.168.x.x`) yalnızca ana makineden erişilebilir ve
> yeniden başlatmalarda değişebilir. Başka bilgisayarlardan erişim gerekiyorsa
> **Bridged** kullanın.

---

## 2. Uygulama tarafı: bağlantıyı ayarlardan girin

Bağlantı bilgileri **dosya düzenlemeden**, uygulama içinden girilir.

1. Uygulamaya **yönetici** şifresiyle girin.
2. Sağ üstteki **⚙ (dişli)** simgesine tıklayın.
3. **Veritabanı Bağlantısı** formunu doldurun:
   - Sunucu adresi (örn. `192.168.1.50`), port (`1433`)
   - Veritabanı adı (`modelhane`), kullanıcı adı ve şifre
   - Named instance varsa (örn. `SQLEXPRESS`) ilgili alana yazın
4. **Kaydet ve Bağlan** → yeşil "Bağlantı başarılı" görmelisiniz.
5. **Veritabanını Oluştur** → veritabanını açar.
6. **Tabloları Oluştur** → `models` ve `app_passwords` tablolarını açar.

Ayarlar şu dosyada saklanır (elle düzenlemeye gerek yoktur):

```
%APPDATA%\ModelhanePlanlama\config.json
```

Veritabanı şifresi burada **düz metin değil**, makineye bağlı bir anahtarla
şifrelenmiş olarak tutulur. Dosya başka bir bilgisayara kopyalansa şifre
çözülemez — o makinede yeniden girilmesi gerekir.

> Uygulama başka bilgisayarlara kurulduğunda her kurulum kendi bağlantı
> ayarını tutar; kullanıcıların kod veya dosya görmesine gerek yoktur.

---

## 3. Şifre yönetimi

Giriş şifreleri `app_passwords` tablosunda **hash'lenmiş** olarak saklanır
(scrypt). Düz metin hiçbir yerde tutulmaz.

- **Şifre değiştirme:** ⚙ → Şifre Yönetimi → grubu seçin, yeni şifreyi girin.
  Yönetici şifresini değiştirmek için mevcut şifre sorulur.
- **Kurtarma PIN'i:** ⚙ → Kurtarma PIN'i bölümünden 6–12 haneli bir PIN
  belirleyin ve güvenli bir yerde saklayın.
- **Şifre unutulursa:** Giriş ekranındaki **"Şifremi unuttum"** bağlantısı →
  kurtarma PIN'i ile yönetici şifresi sıfırlanır. Grup şifrelerini yönetici
  ayarlardan değiştirir.

Kaba kuvvet denemelerine karşı hız sınırı vardır (giriş: 5 dakikada 10 deneme,
PIN: 15 dakikada 5 deneme).

**İlk kurulumda mutlaka yapın:** Varsayılan şifreleri ve kurtarma PIN'ini
değiştirin.

---

## 4. Sorun giderme

| Hata mesajı | Sebep ve çözüm |
|---|---|
| **Sunucuya bağlanılamadı** | TCP/IP etkin değil (adım 1.3) veya adres yanlış. |
| **Zaman aşımı** | Güvenlik duvarı 1433'ü kapatıyor (adım 1.4) veya sunucu kapalı. |
| **Kullanıcı adı veya şifre hatalı** | Mixed Mode kapalı (adım 1.1) veya şifre uyuşmuyor. `PWDCOMPARE` ile doğrulayın (adım 1.2). |
| **Veritabanı bulunamadı** | Ayarlardaki "Veritabanını Oluştur" adımını çalıştırın. |
| **Tablo bulunamadı** | Ayarlardaki "Tabloları Oluştur" adımını çalıştırın. |

Ağ bağlantısını hızlıca test etmek için:

```powershell
Test-NetConnection 192.168.1.50 -Port 1433
```

`TcpTestSucceeded : True` görmelisiniz. (`PingSucceeded : False` normaldir —
Windows güvenlik duvarı ICMP'yi varsayılan olarak engeller.)

---

## Güvenlik notları

Geliştirme sırasında düzeltilen konular:

- **Giriş şifreleri artık tarayıcıda görünmüyor.** Önceden tüm şifreler istemci
  paketinde düz metin yer alıyordu; kaynağı açan herkes yönetici şifresini
  görebiliyordu.
- **Veritabanı erişimi sunucuya taşındı.** Önceden tarayıcı doğrudan veritabanına
  bağlanıyordu ve erişim anahtarı istemci kodunda gömülüydü.
- **API uçları korundu.** Önceden hiçbir uç kimlik doğrulaması istemiyordu;
  adresi bilen herkes veri değiştirebiliyordu. Artık oturum zorunlu ve yönetici
  işlemleri role göre ayrılmış durumda.

**Dikkat:** Oturum çerezleri `secure: false` ile gönderilir (yerel ağda HTTP
kullanıldığı için). Uygulama internete açılacaksa HTTPS kurulmalı ve bu ayar
`true` yapılmalıdır.
