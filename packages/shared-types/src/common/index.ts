export interface ApiHealthStatus {
  service: string;
  ts: string;
  databaseConfigured: boolean;
  wechatConfigured: boolean;
  jwtConfigured: boolean;
}
