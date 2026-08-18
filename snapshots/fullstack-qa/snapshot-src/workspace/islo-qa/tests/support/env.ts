import fs from 'fs';
import path from 'path';

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export const ISLO_BASE_URL = process.env.ISLO_BASE_URL || 'http://localhost:5173';
export const ISLO_QA_EMAIL = requireEnv('ISLO_QA_EMAIL');
export const ISLO_QA_OTP = requireEnv('ISLO_QA_OTP');

export const AUTH_DIR = path.join('/workspace/islo-qa', '.auth');
export const STORAGE_STATE = path.join(AUTH_DIR, 'user.json');

export function ensureAuthDir(): void {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}
