import { NextFunction, Request, Response, Router } from 'express';
import {
  getMotorHealthRegistry,
  MotorHealthSnapshot,
  recordMotorExecution,
  safeMotorCall,
  SafeMotorCallResult,
  safeMotorCallSync,
  UrutauMotorName
} from '../../shared/motorRuntime.ts';

export {
  getMotorHealthRegistry,
  recordMotorExecution,
  safeMotorCall,
  safeMotorCallSync
};
export type { MotorHealthSnapshot, SafeMotorCallResult, UrutauMotorName };

export function wrapMotorHandler(
  motorName: UrutauMotorName,
  handler: (req: Request, res: Response, next: NextFunction) => Promise<any> | any,
  fallbackPayload: Record<string, any> = { ok: false, degraded: true, data: null }
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
      recordMotorExecution(motorName, true);
    } catch (err: any) {
      const msg = err?.message || 'Falha isolada no motor de dominio';
      console.error(`[BACKEND MOTOR ISOLATION][${motorName}]`, msg);
      recordMotorExecution(motorName, false, msg);
      if (!res.headersSent) {
        res.status(200).json({
          ...fallbackPayload,
          motor: motorName,
          degraded: true,
          error: msg
        });
      }
    }
  };
}

export function createIsolatedMotorRouter(
  motorName: UrutauMotorName,
  configure: (router: Router) => void
): Router {
  const router = Router();
  router.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Urutau-Motor', String(motorName));
    next();
  });

  try {
    configure(router);
  } catch (err: any) {
    const msg = err?.message || 'Erro na inicializacao do roteador do motor';
    recordMotorExecution(motorName, false, msg);
  }

  router.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const msg = err?.message || 'Excecao isolada no motor';
    recordMotorExecution(motorName, false, msg);
    if (!res.headersSent) {
      res.status(200).json({
        ok: false,
        motor: motorName,
        degraded: true,
        data: null,
        error: msg
      });
    }
  });

  return router;
}
