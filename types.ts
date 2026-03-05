export enum UserRole {
  FARMER = 'FARMER',
  RESEARCHER = 'RESEARCHER'
}

export interface Crop {
  id: string;
  name: string;
  category: string;
}

export interface City {
  id: string;
  name: string;
}

export interface WeatherData {
  city: string;
  temp: number;
  condition: 'Sunny' | 'Cloudy' | 'Rainy' | 'Stormy';
  humidity: number;
  wind: number;
}

export interface AnalysisResult {
  cropName: string;
  recommendationScore: number; // 0-100
  yieldForecast: number; // kg/da
  priceForecast?: number; // TL
  riskLevel: 'Low' | 'Medium' | 'High';
  riskMessage: string;
}

export interface SupplyDemandData {
  name: string;
  production: number;
  consumption: number;
  year: number;
}