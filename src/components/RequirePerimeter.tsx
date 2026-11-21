import React, { useCallback, useEffect, useState } from 'react';
import {
  Crosshair,
  LocateFixed,
  MapPinOff,
  RefreshCw,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import {
  calculateDistanceInMeters,
  isValidCoordinatePair,
  normalizeAllowedRadiusMeters
} from '../shared/utils/geofencingUtils';

export interface ActivePerimeterConfig {
  empresa_id: number;
  empresa_nome: string;
  latitude: number | null;
  longitude: number | null;
  allowed_radius_meters: number;
  configured: boolean;
  setor_id?: number | null;
  setor_nome?: string | null;
}

export type PerimeterGuardStatus =
  | 'loading_config'
  | 'unconfigured'
  | 'locating'
  | 'allowed'
  | 'outside_perimeter'
  | 'gps_denied'
  | 'gps_unavailable';

export interface PerimeterGuardState {
  status: PerimeterGuardStatus;
  perimeter: ActivePerimeterConfig | null;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  errorDetail: string;
  recheckLocation: () => void;
}

function extractPerimeterFromUser(currentUser: any): ActivePerimeterConfig | null {
  const p = currentUser?.perimeter;
  if (!p || typeof p !== 'object') return null;
  const lat = isValidCoordinatePair(p.latitude, p.longitude) ? Number(p.latitude) : null;
  const lon = isValidCoordinatePair(p.latitude, p.longitude) ? Number(p.longitude) : null;
  return {
    empresa_id: Number(p.empresa_id || 1),
    empresa_nome: String(p.empresa_nome || 'Unidade'),
    latitude: lat,
    longitude: lon,
    allowed_radius_meters: normalizeAllowedRadiusMeters(p.allowed_radius_meters, 50),
    configured: Boolean(lat !== null && lon !== null),
    setor_id: p.setor_id ? Number(p.setor_id) : null,
    setor_nome: p.setor_nome ? String(p.setor_nome) : null
  };
}

export function usePerimeterGuard(params: {
  currentUser?: any;
  empresaId?: number | null;
  setorId?: number | null;
}): PerimeterGuardState {
  const { currentUser, empresaId, setorId } = params;
  const [perimeter, setPerimeter] = useState<ActivePerimeterConfig | null>(() =>
    extractPerimeterFromUser(currentUser)
  );
  const [status, setStatus] = useState<PerimeterGuardStatus>('loading_config');
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [errorDetail, setErrorDetail] = useState<string>('');

  const verifyCurrentPosition = useCallback((cfg: ActivePerimeterConfig | null) => {
    if (!cfg || !cfg.configured || !isValidCoordinatePair(cfg.latitude, cfg.longitude)) {
      setDistanceMeters(null);
      setAccuracyMeters(null);
      setErrorDetail('');
      setStatus('unconfigured');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setDistanceMeters(null);
      setErrorDetail('Seu navegador ou dispositivo nao oferece suporte a Geolocation HTML5.');
      setStatus('gps_unavailable');
      return;
    }

    setStatus('locating');
    setErrorDetail('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        const dist = calculateDistanceInMeters(
          userLat,
          userLon,
          Number(cfg.latitude),
          Number(cfg.longitude)
        );
        const radius = normalizeAllowedRadiusMeters(cfg.allowed_radius_meters, 50);
        const roundedDist = Number.isFinite(dist) ? Math.round(dist * 10) / 10 : null;
        setDistanceMeters(roundedDist);
        setAccuracyMeters(
          Number.isFinite(position.coords.accuracy)
            ? Math.round(position.coords.accuracy)
            : null
        );

        if (Number.isFinite(dist) && dist <= radius) {
          setStatus('allowed');
          setErrorDetail('');
        } else {
          setStatus('outside_perimeter');
          setErrorDetail(
            `Distancia medida: ${roundedDist !== null ? `${roundedDist}m` : 'indeterminada'} (limite autorizado: ${radius}m).`
          );
        }
      },
      (geoError) => {
        setDistanceMeters(null);
        setAccuracyMeters(null);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setErrorDetail(
            'A permissao de localizacao (GPS) foi negada. Ative o GPS do dispositivo e autorize o navegador para validar sua presenca fisica.'
          );
          setStatus('gps_denied');
        } else if (geoError.code === geoError.TIMEOUT) {
          setErrorDetail(
            'Tempo limite esgotado ao obter sinal GPS. Verifique se a localizacao esta ativa e tente novamente.'
          );
          setStatus('gps_unavailable');
        } else {
          setErrorDetail(
            'Nao foi possivel determinar sua localizacao GPS atual. Verifique o sinal de localizacao do dispositivo.'
          );
          setStatus('gps_unavailable');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 15000
      }
    );
  }, []);

  const loadPerimeterConfig = useCallback(async () => {
    setStatus('loading_config');
    try {
      const searchParams = new URLSearchParams();
      if (empresaId && Number(empresaId) > 0) {
        searchParams.set('empresa_id', String(empresaId));
      }
      if (setorId && Number(setorId) > 0) {
        searchParams.set('setor_id', String(setorId));
      }
      const queryStr = searchParams.toString();
      const res = await fetch(
        `/api/zero-trust/perfil-perimetro${queryStr ? `?${queryStr}` : ''}`
      );
      if (res.ok) {
        const json = await res.json();
        if (json?.ok && json?.perimeter) {
          const nextCfg: ActivePerimeterConfig = {
            empresa_id: Number(json.perimeter.empresa_id || empresaId || 1),
            empresa_nome: String(json.perimeter.empresa_nome || 'Unidade'),
            latitude: isValidCoordinatePair(json.perimeter.latitude, json.perimeter.longitude)
              ? Number(json.perimeter.latitude)
              : null,
            longitude: isValidCoordinatePair(json.perimeter.latitude, json.perimeter.longitude)
              ? Number(json.perimeter.longitude)
              : null,
            allowed_radius_meters: normalizeAllowedRadiusMeters(
              json.perimeter.allowed_radius_meters,
              50
            ),
            configured: Boolean(json.perimeter.configured),
            setor_id: json.perimeter.setor_id ? Number(json.perimeter.setor_id) : null,
            setor_nome: json.perimeter.setor_nome ? String(json.perimeter.setor_nome) : null
          };
          setPerimeter(nextCfg);
          verifyCurrentPosition(nextCfg);
          return;
        }
      }
    } catch {}

    const fallbackCfg = extractPerimeterFromUser(currentUser);
    setPerimeter(fallbackCfg);
    verifyCurrentPosition(fallbackCfg);
  }, [currentUser, empresaId, setorId, verifyCurrentPosition]);

  useEffect(() => {
    loadPerimeterConfig();
  }, [loadPerimeterConfig]);

  useEffect(() => {
    const handlePerimeterUpdated = () => {
      loadPerimeterConfig();
    };
    window.addEventListener('urutau:perimeter-updated', handlePerimeterUpdated);
    return () => {
      window.removeEventListener('urutau:perimeter-updated', handlePerimeterUpdated);
    };
  }, [loadPerimeterConfig]);

  const recheckLocation = useCallback(() => {
    verifyCurrentPosition(perimeter);
  }, [perimeter, verifyCurrentPosition]);

  return {
    status,
    perimeter,
    distanceMeters,
    accuracyMeters,
    errorDetail,
    recheckLocation
  };
}

interface RequirePerimeterProps {
  moduleName?: string;
  currentUser?: any;
  empresaId?: number | null;
  setorId?: number | null;
  children: React.ReactNode;
}

export const RequirePerimeter: React.FC<RequirePerimeterProps> = ({
  moduleName = 'Modulo Operacional',
  currentUser,
  empresaId,
  setorId,
  children
}) => {
  const { status, perimeter, distanceMeters, accuracyMeters, errorDetail, recheckLocation } =
    usePerimeterGuard({
      currentUser,
      empresaId,
      setorId
    });

  if (status === 'unconfigured' || status === 'allowed') {
    return (
      <div className="w-full space-y-3">
        {status === 'allowed' && perimeter?.configured && (
          <div className="px-3 py-2 rounded-lg bg-[#0E1117] border border-emerald-500/25 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
              <span className="font-medium">
                Perimetro Zero-Trust validado ({perimeter.setor_nome || perimeter.empresa_nome})
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400 tabular-nums">
              <span>
                Distancia: {distanceMeters !== null ? `${distanceMeters}m` : '0m'} /{' '}
                {perimeter.allowed_radius_meters}m
              </span>
              <button
                type="button"
                onClick={recheckLocation}
                className="text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                title="Revalidar GPS agora"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Revalidar</span>
              </button>
            </div>
          </div>
        )}
        {children}
      </div>
    );
  }

  if (status === 'loading_config' || status === 'locating') {
    return (
      <div className="w-full min-h-[340px] rounded-xl bg-[#12161F] border border-slate-800 p-6 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-[#181D28] border border-slate-700 flex items-center justify-center">
          <LocateFixed className="w-6 h-6 text-[#10B981] animate-pulse" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-sm sm:text-base font-semibold text-white">
            Verificando Perimetro de Seguranca Zero-Trust
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {status === 'loading_config'
              ? `Carregando politica geografica para ${moduleName}...`
              : `Confirmando sua localizacao GPS via HTML5 Geolocation para liberar ${moduleName}...`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[380px] rounded-xl bg-[#12161F] border border-rose-500/40 p-6 sm:p-8 flex flex-col items-center justify-center text-center gap-5">
      <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center">
        {status === 'outside_perimeter' ? (
          <MapPinOff className="w-7 h-7 text-rose-400" />
        ) : (
          <ShieldAlert className="w-7 h-7 text-rose-400" />
        )}
      </div>

      <div className="space-y-2 max-w-lg">
        <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400 font-semibold">
          Bloqueio Zero-Trust • {moduleName}
        </div>
        <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
          Acesso Restrito: Você está fora do perímetro de segurança da unidade.
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          {errorDetail ||
            'Este modulo exige presenca fisica comprovada dentro do raio autorizado da empresa.'}
        </p>
      </div>

      {perimeter && (
        <div className="w-full max-w-md rounded-lg bg-[#0E1117] border border-slate-800 p-3.5 grid grid-cols-2 gap-3 text-left text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Unidade / Setor</div>
            <div className="mt-0.5 font-semibold text-slate-200 truncate">
              {perimeter.setor_nome
                ? `${perimeter.empresa_nome} · ${perimeter.setor_nome}`
                : perimeter.empresa_nome}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Raio Permitido</div>
            <div className="mt-0.5 font-mono font-bold text-slate-200 tabular-nums">
              {perimeter.allowed_radius_meters} metros
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Distancia Atual</div>
            <div className="mt-0.5 font-mono font-bold text-rose-400 tabular-nums">
              {distanceMeters !== null ? `${distanceMeters} metros` : 'GPS bloqueado / indisponivel'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Precisao GPS</div>
            <div className="mt-0.5 font-mono text-slate-300 tabular-nums">
              {accuracyMeters !== null ? `±${accuracyMeters}m` : 'N/A'}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={recheckLocation}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#10B981] hover:bg-emerald-400 text-[#05100C] text-xs font-bold transition-colors cursor-pointer"
        >
          <Crosshair className="w-4 h-4" />
          <span>Verificar Localizacao Novamente</span>
        </button>
      </div>
    </div>
  );
};
