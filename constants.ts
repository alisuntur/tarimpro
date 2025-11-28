import { City, Crop, SupplyDemandData, WeatherData } from './types';

export const CITIES: City[] = [
  { id: '01', name: 'Adana' },
  { id: '06', name: 'Ankara' },
  { id: '07', name: 'Antalya' },
  { id: '16', name: 'Bursa' },
  { id: '34', name: 'İstanbul' },
  { id: '35', name: 'İzmir' },
  { id: '42', name: 'Konya' },
  { id: '63', name: 'Şanlıurfa' },
];

export const CROPS: Crop[] = [
  { id: '1', name: 'Buğday', category: 'Tahıl' },
  { id: '2', name: 'Mısır', category: 'Tahıl' },
  { id: '3', name: 'Pamuk', category: 'Endüstri' },
  { id: '4', name: 'Ayçiçeği', category: 'Yağlı Tohum' },
  { id: '5', name: 'Domates', category: 'Sebze' },
  { id: '6', name: 'Şeker Pancarı', category: 'Endüstri' },
  { id: '7', name: 'Arpa', category: 'Tahıl' },
];

export const MOCK_WEATHER: WeatherData = {
  city: 'Konya',
  temp: 24,
  condition: 'Sunny',
  humidity: 45,
  wind: 12
};

export const MOCK_SUPPLY_DEMAND: SupplyDemandData[] = [
  { year: 2019, production: 19000, consumption: 18500, name: '2019' },
  { year: 2020, production: 20500, consumption: 19000, name: '2020' },
  { year: 2021, production: 18000, consumption: 19500, name: '2021' },
  { year: 2022, production: 19800, consumption: 20000, name: '2022' },
  { year: 2023, production: 21000, consumption: 20500, name: '2023' },
  { year: 2024, production: 22500, consumption: 21000, name: '2024' },
];

export const RECENT_UPDATES = [
  { id: 1, title: 'İklim Verileri Güncellendi', time: '2 saat önce', type: 'climate' },
  { id: 2, title: 'Konya Bölgesi Hasat Raporu', time: '5 saat önce', type: 'report' },
  { id: 3, title: 'Buğday Piyasa Fiyatları', time: '1 gün önce', type: 'market' },
];