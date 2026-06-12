// Common types
export type Currency = 'CNY' | 'USD' | 'EUR';

export type RoastLevel = 'LIGHT' | 'MEDIUM_LIGHT' | 'MEDIUM' | 'MEDIUM_DARK' | 'DARK';

export type ProcessMethod = 'WASHED' | 'NATURAL' | 'HONEY' | 'ANAEROBIC' | 'OTHER';

export interface ApiHealthStatus {
  service: string;
  ts: string;
  databaseConfigured: boolean;
  wechatConfigured: boolean;
  jwtConfigured: boolean;
}
