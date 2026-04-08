export interface SystemSettingRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}
