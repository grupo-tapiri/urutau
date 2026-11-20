export type UrutauMotorName =
  | 'escala'
  | 'reservas'
  | 'caixa'
  | 'pdv'
  | 'rh-cargos'
  | 'whatsapp-ia'
  | 'governanca'
  | string;

export interface SafeMotorCallResult<T> {
  data: T;
  degraded: boolean;
  error?: string;
  motorName?: string;
  timestampUtc?: string;
}

export interface MotorHealthSnapshot {
  motorName: string;
  status: 'healthy' | 'degraded';
  totalCalls: number;
  failedCalls: number;
  lastError: string | null;
  lastUpdatedUtc: string;
}

const motorRegistry = new Map<string, MotorHealthSnapshot>();

const KNOWN_MOTORS: UrutauMotorName[] = [
  'escala',
  'reservas',
  'caixa',
  'pdv',
  'rh-cargos',
  'whatsapp-ia',
  'governanca'
];

for (const name of KNOWN_MOTORS) {
  motorRegistry.set(name, {
    motorName: name,
    status: 'healthy',
    totalCalls: 0,
    failedCalls: 0,
    lastError: null,
    lastUpdatedUtc: new Date().toISOString()
  });
}

export function recordMotorExecution(
  motorName: UrutauMotorName,
  ok: boolean,
  errorMessage?: string
): MotorHealthSnapshot {
  const key = String(motorName || 'unknown').trim().toLowerCase();
  const prev = motorRegistry.get(key) || {
    motorName: key,
    status: 'healthy' as const,
    totalCalls: 0,
    failedCalls: 0,
    lastError: null,
    lastUpdatedUtc: new Date().toISOString()
  };

  const next: MotorHealthSnapshot = {
    motorName: key,
    status: ok ? 'healthy' : 'degraded',
    totalCalls: prev.totalCalls + 1,
    failedCalls: ok ? prev.failedCalls : prev.failedCalls + 1,
    lastError: ok ? prev.lastError : errorMessage || 'Falha isolada no motor',
    lastUpdatedUtc: new Date().toISOString()
  };
  motorRegistry.set(key, next);
  return next;
}

export function getMotorHealthRegistry(): Record<string, MotorHealthSnapshot> {
  const out: Record<string, MotorHealthSnapshot> = {};
  for (const [k, v] of motorRegistry.entries()) {
    out[k] = { ...v };
  }
  return out;
}

export async function safeMotorCall<T>(
  motorName: string,
  fn: () => Promise<T> | T,
  fallback: T
): Promise<{ data: T; degraded: boolean; error?: string }> {
  try {
    const rawResult = await fn();
    const safeData = rawResult === undefined ? fallback : rawResult;
    recordMotorExecution(motorName, true);
    return {
      data: safeData,
      degraded: false
    };
  } catch (err: any) {
    const msg = err?.message || String(err || 'Erro desconhecido no motor');
    console.error(`[FAULT ISOLATION][MOTOR:${motorName}] Falha isolada capturada:`, msg);
    recordMotorExecution(motorName, false, msg);
    return {
      data: fallback,
      degraded: true,
      error: msg
    };
  }
}

export function safeMotorCallSync<T>(
  motorName: string,
  fn: () => T,
  fallback: T
): { data: T; degraded: boolean; error?: string } {
  try {
    const rawResult = fn();
    const safeData = rawResult === undefined ? fallback : rawResult;
    recordMotorExecution(motorName, true);
    return {
      data: safeData,
      degraded: false
    };
  } catch (err: any) {
    const msg = err?.message || String(err || 'Erro desconhecido no motor');
    console.error(`[FAULT ISOLATION][MOTOR:${motorName}] Falha sincrona isolada capturada:`, msg);
    recordMotorExecution(motorName, false, msg);
    return {
      data: fallback,
      degraded: true,
      error: msg
    };
  }
}
