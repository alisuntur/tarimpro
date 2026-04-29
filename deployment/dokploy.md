# TarimPro Dokploy Kurulumu

Bu rehber, Dokploy kurulu bir Ubuntu 24.04 VDS uzerinde TarimPro'yu
canliya almak icin hazirlandi.

Bu yol, manuel `systemd + nginx` kurulumundan daha rahattir:

- Dokploy Docker Compose uygulamasini yonetir.
- Domain ve SSL isini Dokploy/Traefik halleder.
- PostgreSQL, backend ve frontend tek projede kalir.
- Loglar ve redeploy islemleri panelden takip edilir.

Resmi Dokploy dokumantasyonuna gore Docker Compose, ortam degiskenleri,
domain yonetimi ve PostgreSQL destegi mevcut. Bu proje icin en uygun yol
da bu.

Hazir dosyalar:

- [docker-compose.dokploy.yml](../docker-compose.dokploy.yml)
- [backend/Dockerfile](../backend/Dockerfile)
- [frontend/Dockerfile](../frontend/Dockerfile)
- [frontend/nginx.conf](../frontend/nginx.conf)

DNS tarafinda su kayitlari kullan:

- `cafeduotr.online` icin `A` kaydi -> VDS public IP
- `www.cafeduotr.online` icin `CNAME` kaydi -> `cafeduotr.online`

## Neden uygun?

TarimPro zaten su yapida calisiyor:

- Frontend React/Vite ile build ediliyor
- Backend FastAPI ile `/api` altinda calisiyor
- Veritabani PostgreSQL

Bu nedenle Dokploy'de en temiz cozum su oluyor:

- `web` servisi: Nginx ile React build dosyalarini servis eder
- `web` servisi ayni zamanda `/api` isteklerini `api` servisine proxy eder
- `api` servisi: FastAPI
- `db` servisi: PostgreSQL

## Dokploy'de kurulum adimlari

1. Repo'yu Dokploy'e bagla.
2. Yeni bir `Compose` uygulamasi olustur.
3. Compose path olarak `docker-compose.dokploy.yml` sec.
4. Environment variables kismina asagidaki degerleri ekle:

```ini
PGDATABASE=tarimpro
PGUSER=tarimpro_user
PGPASSWORD=GucluBirSifreYaz
WEATHER_CACHE_REFRESH_HOUR=9
WEATHER_CACHE_REFRESH_MINUTE=0
WEATHER_CACHE_BATCH_SIZE=50
WEATHER_CACHE_SCHEDULER_ENABLED=true
WEATHER_CACHE_STARTUP_REFRESH_ENABLED=true
```

5. Domain tabinda ana domaini `cafeduotr.online` olarak `web` servisine bagla.
6. Istersen `www.cafeduotr.online` icin ikinci domain ekleyip ana domaine yonlendir.
7. Container port olarak `80` sec.
8. HTTPS icin Let's Encrypt aktif et.
9. Deploy et.

## GitHub ile baglama

Evet, bunu GitHub uzerinden direkt yaptirabilirsin. Dokploy GitHub
repository baglantisi ve push ile auto deploy destekliyor.

Bu proje icin mantikli akis:

1. GitHub hesabini Dokploy'e bagla.
2. Bu repoyu sec.
3. `Compose` uygulamasi olustur.
4. `docker-compose.dokploy.yml` dosyasini compose path olarak ver.
5. Branch olarak `main` sec.
6. `Auto Deploy` acik olsun.
7. Domaini `cafeduotr.online` olarak ekle.
8. Deploy et.

Boylece sen GitHub'a push yaptikca Dokploy repoyu ceker, compose dosyasini
okur ve yeniden calistirir.

## Veritabanini localden tasima

Elindeki yerel veriyi aynen canliya tasimak icin dump restore et.

Onemli:

- En temiz yol, `db` volume'u bosken dump'i restore etmek ve sonra `api`
  servisini calistirmak.
- Eger `api` ilk acilista ayaga kalktiysa, bootstrap demo user yazabilir.
  Bu durumda restore oncesi `api` servisini durdurmak ya da DB volume'u
  sifirlamak gerekir.

Eger `backups/tarimpro_full.dump` dosyasi sunucuda varsa, once database
servisi ayakta olsun, sonra bir terminalden restore uygula:

```bash
pg_restore -h <postgres-host> -U tarimpro_user -d tarimpro --no-owner backups/tarimpro_full.dump
```

Dokploy ortaminda database host adini genelde servis adi belirler. Eger
DB'yi compose icinde `db` servisi olarak calistiriyorsan host `db` olur.

Ornek:

```bash
PGPASSWORD='GucluBirSifreYaz' pg_restore -h db -U tarimpro_user -d tarimpro --no-owner backups/tarimpro_full.dump
```

## Dikkat edilmesi gerekenler

- Bu uygulamada weather cache scheduler var. Bu yuzden backend icin tek
  instance kullan. Replica sayisini 1'de tut.
- Domain degistirirsen Dokploy'de yeniden deploy etmen gerekir.
- PostgreSQL verisi icin named volume kullan; bu sayede veri kalici olur.
- `web` servisi 80 portunda olmali. Dokploy dokumaninda static build tipleri
  icin de port 80 tavsiye ediliyor.

## Ne zaman bunu secmelisin?

- Sunucuda Docker var ve Dokploy kuruluyse
- Panelden deploy, log, env ve domain yonetmek istiyorsan
- Backend + database + frontend tek project olarak dursun istiyorsan

Bu durumda Dokploy kesinlikle is gorecek.
