export type IpcChannels =
  | 'app:ping'
  | 'app:health';

export type AppHealth = {
  ok: boolean;
  version: string;
  packaged: boolean;
  uptimeSeconds: number;
  providers: {
    ok: boolean;
    count: number;
    errors: string[];
  };
  state: {
    ok: boolean;
    path: string;
    error?: string;
  };
  activeProvider: string | null;
  timestamp: string;
};