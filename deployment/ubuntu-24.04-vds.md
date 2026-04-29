# TarimPro Ubuntu 24.04 VDS Canli Kurulum

Bu rehber, localde calisan TarimPro'yu domain uzerinden canliya almak ve
local veritabanini birebir tasimak icin hazirlandi.

Eger VDS'de Dokploy kuruluysa bu rehber yerine
[deployment/dokploy.md](dokploy.md) kullanman daha kolay olur.

Hedef mimari:

- `https://cafeduotr.online/` -> Nginx -> `frontend/dist`
- `https://cafeduotr.online/api/` -> Nginx reverse proxy -> FastAPI/Uvicorn
- PostgreSQL -> sunucu icinde yerel servis

Bu yapida frontend ayni origin uzerinden `/api` cagirdigi icin, localdeki
akisin aynisi korunur.

## 1) Sunucu hazirligi

Sunucuda bir `sudo` kullanicisi oldugunu varsayiyorum.

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-client postgresql-contrib git curl python3 python3-venv python3-pip
```

Vite 7, Node.js `20.19+` veya `22.12+` ister. Ubuntu 24.04'un varsayilan
paketi yeterli olmayabilir; bu yuzden Node 22 kurmak guvenli secimdir:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 2) Domain DNS

Domain panelinde `A` kaydini VDS IP adresine yonlendir:

- `cafeduotr.online` -> sunucu IP
- `www.cafeduotr.online` -> sunucu IP

DNS yayilimi tamamlanana kadar SSL adiminda gecici hata gorulebilir.

## 3) Repo'yu sunucuya alin

Ornek kurulum dizini:

```bash
sudo mkdir -p /opt/tarimpro
sudo chown -R $USER:$USER /opt/tarimpro
cd /opt/tarimpro
git clone <repo-url> .
```

Eger repo zaten farkli bir klasore alinacaksa komutlari o yola gore uyarlayin.

## 4) PostgreSQL kullanicisi ve veritabani

Canli ortam icin ayri bir DB kullanicisi kullanman daha temiz olur:

```bash
sudo -u postgres psql
```

```sql
CREATE ROLE tarimpro_user LOGIN PASSWORD 'GucluBirSifreYaz';
CREATE DATABASE tarimpro OWNER tarimpro_user;
\q
```

Yerel snapshot'i aynen tasimak icin dump'i restore et:

Onemli:

- En temiz yol, backend ilk calismadan once bos veritabanina restore
  uygulamak.
- Eger backend ilk acilista calistiysa, bootstrap demo user yazabilir.
  Bu durumda restore oncesi backend'i durdurmak ya da DB volume'unu
  sifirlamak gerekir.

```bash
PGPASSWORD='GucluBirSifreYaz' pg_restore -h 127.0.0.1 -U tarimpro_user -d tarimpro --no-owner /opt/tarimpro/backups/tarimpro_full.dump
```

Notlar:

- Dump'i restore etmeden once veritabani bos olmali.
- Eger localdeki veride degisiklik olduysa, deploy oncesi yeni dump al ve
  sunucuya tekrar kopyala.
- Localden yeni dump almak icin genelde su komut kullanilir:

```bash
pg_dump -Fc -f backups/tarimpro_full.dump tarimpro
```

## 5) Python sanal ortam ve backend bagimliliklari

```bash
cd /opt/tarimpro
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

## 6) Backend ortam degiskenleri

`/etc/tarimpro/backend.env` dosyasini olustur:

```bash
sudo mkdir -p /etc/tarimpro
sudo nano /etc/tarimpro/backend.env
```

Icerik ornegi:

```ini
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=tarimpro
PGUSER=tarimpro_user
PGPASSWORD=GucluBirSifreYaz

WEATHER_CACHE_REFRESH_HOUR=9
WEATHER_CACHE_REFRESH_MINUTE=0
WEATHER_CACHE_BATCH_SIZE=50
WEATHER_CACHE_SCHEDULER_ENABLED=true
WEATHER_CACHE_STARTUP_REFRESH_ENABLED=true
```

Bu projede frontend ve backend ayni origin arkasinda calisacagi icin
`VITE_API_BASE` vermene gerek yok.

## 7) systemd backend servisi

Asagidaki dosyayi `/etc/systemd/system/tarimpro-backend.service` olarak kaydet:

```ini
[Unit]
Description=TarimPro FastAPI backend
After=network.target postgresql.service

[Service]
Type=simple
User=tarimpro
Group=tarimpro
WorkingDirectory=/opt/tarimpro/backend
EnvironmentFile=/etc/tarimpro/backend.env
ExecStart=/opt/tarimpro/.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=20
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

Sonra servis kullanicisini olustur:

```bash
sudo adduser --system --group --home /opt/tarimpro tarimpro
sudo chown -R tarimpro:tarimpro /opt/tarimpro
```

Servisi etkinlestir:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tarimpro-backend
sudo systemctl status tarimpro-backend
```

Backend loglari:

```bash
journalctl -u tarimpro-backend -f
```

## 8) Frontend build

Frontend build'i sunucuda al:

```bash
cd /opt/tarimpro/frontend
npm install
npm run build
```

Sonuc `frontend/dist` altina yazilir. Nginx bu klasoru servis edecek.

## 9) Nginx ayari

Asagidaki dosyayi `/etc/nginx/sites-available/tarimpro` olarak kaydet:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name cafeduotr.online www.cafeduotr.online;

    root /opt/tarimpro/frontend/dist;
    index index.html;

    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Aktiflestir:

```bash
sudo ln -s /etc/nginx/sites-available/tarimpro /etc/nginx/sites-enabled/tarimpro
sudo nginx -t
sudo systemctl reload nginx
```

## 10) SSL

HTTP calisinca site acildiginda ardindan Let's Encrypt sertifikasi al:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d cafeduotr.online -d www.cafeduotr.online
```

## 11) Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 12) Kontrol listesi

- `http://127.0.0.1:8000/docs` backend icin aciliyor mu
- `https://cafeduotr.online/` frontend aciliyor mu
- `https://cafeduotr.online/api/auth/me` yetkisiz istekte 401 donuyor mu
- demo giris calisiyor mu: `05551234567` / `demo123`

## 13) Ince ayar notlari

- Bu proje backend icinde weather cache scheduler calistiriyor. Tek bir
  backend prosesi kullanman yeterli.
- Birden fazla Uvicorn worker acarsan scheduler da her worker'da calisir.
  Bu nedenle bu kurulumda tek worker ile gitmek en temiz secimdir.
- Ayri API domaini kullanmak istersen frontend build asamasinda
  `VITE_API_BASE=https://api.cafeduotr.online` verebilirsin. Bu rehberde ayni
  origin mimarisi tercih edildi.
