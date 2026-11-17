import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import {
  Percent,
  Calendar,
  CheckSquare,
  Utensils,
  Globe,
  MessageSquare,
  Wallet,
  Package,
  ShoppingCart,
  PieChart,
  Users,
  UserPlus,
  ShieldCheck,
  Building2,
  Layers,
  ClipboardCheck,
  Bell,
  Settings,
  AlertTriangle,
  Copy,
  Check,
  X,
  Save,
  Archive,
  Network,
  Sparkles,
  FileSearch,
  Briefcase,
  Truck,
  CreditCard,
  BarChart3,
  Award,
  Clock,
  Store,
  Receipt,
  Landmark,
  Headphones,
  Wrench,
  FolderKanban,
  Boxes,
  Coins,
  BadgeCheck,
  TrendingUp,
  MapPin,
  FileText,
  KeyRound,
  Server,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List as ListIcon,
  Columns,
  Plus,
  Filter,
  Search,
  Volume2,
  VolumeX,
  Play,
  Upload,
  Mic,
  Square,
  RotateCcw,
  Trash2,
  Sun,
  Moon
} from 'lucide-react';
import {
  BrandIdentityConfig,
  CustomSoundItem,
  SlotCustomizationItem,
  SlotDisplayChoice,
  SoundSystemConfig,
  SystemImageSlotId,
  SystemImageSourceId,
  SystemSoundSlotId,
  SystemSoundSourceId,
  TabId
} from '../types/erp';
import { URUTAU_OFFICIAL_FOUR_DATA_URLS } from '../assets/urutauOfficialFourSprites';

const urutauPadraoOlhosAbertosImg = '/assets/aistudio/1794865504552_4f886805.jpg';
const urutauOlhosFechadosImg = '/assets/aistudio/1794865500712_b86f119a.jpg';
const urutauBocaAbertaImg = '/assets/aistudio/1794865495132_e5903896.jpg';
const urutauBocaAbertaCantoImg = '/assets/aistudio/1794865490648_8336632f.jpg';

const urutauCamuflagemMadeiraImg = urutauOlhosFechadosImg;
const urutauCamuflagemEsmeraldaImg = urutauOlhosFechadosImg;
const urutauSentinelaMadeiraImg = urutauPadraoOlhosAbertosImg;
const urutauSentinelaEsmeraldaImg = urutauPadraoOlhosAbertosImg;
const urutauCantoMadeiraImg = urutauBocaAbertaCantoImg;
const urutauCantoEsmeraldaImg = urutauBocaAbertaCantoImg;
const urutauVoandoMadeiraImg = urutauPadraoOlhosAbertosImg;
const urutauVoandoEsmeraldaImg = urutauPadraoOlhosAbertosImg;
const urutauAlertaMadeiraImg = urutauBocaAbertaImg;
const urutauAlertaEsmeraldaImg = urutauBocaAbertaImg;
const urutauRepousoMadeiraImg = urutauOlhosFechadosImg;
const urutauRepousoEsmeraldaImg = urutauOlhosFechadosImg;

export const ICONES_SVG = {
  urutauOrnamental: `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="uGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FEF08A"/>
        <stop offset="50%" stop-color="#F59E0B"/>
        <stop offset="100%" stop-color="#B45309"/>
      </linearGradient>
    </defs>
    <circle cx="120" cy="120" r="108" fill="#071811" stroke="#10B981" stroke-width="4"/>
    <polygon points="84,22 120,68 156,22" fill="#0B3B2B" stroke="#20E3B2" stroke-width="3"/>
    <polygon points="98,22 120,50 142,22" fill="#10B981"/>
    <polygon points="108,22 120,36 132,22" fill="#F5B041"/>
    <path d="M24,84 Q66,46 112,92 M216,84 Q174,46 128,92" fill="none" stroke="#C69C6D" stroke-width="10" stroke-linecap="round"/>
    <circle cx="66" cy="108" r="28" fill="#071811" stroke="#10B981" stroke-width="5"/>
    <circle cx="66" cy="108" r="20" fill="url(#uGold)"/>
    <circle cx="69" cy="109" r="10" fill="#071811"/>
    <circle cx="58" cy="100" r="5" fill="#FFFFFF"/>
    <circle cx="174" cy="108" r="28" fill="#071811" stroke="#10B981" stroke-width="5"/>
    <circle cx="174" cy="108" r="20" fill="url(#uGold)"/>
    <circle cx="171" cy="109" r="10" fill="#071811"/>
    <circle cx="166" cy="100" r="5" fill="#FFFFFF"/>
    <path d="M18,154 C54,142 94,116 120,116 C146,116 186,142 222,154 C186,162 140,144 120,166 C100,144 54,162 18,154 Z" fill="#C69C6D" stroke="#071811" stroke-width="4"/>
    <path d="M26,158 C66,150 100,152 120,172 C140,152 174,150 214,158 C184,182 148,192 120,196 C92,192 56,182 26,158 Z" fill="#9C7349" stroke="#071811" stroke-width="3.5"/>
    <polygon points="94,198 120,226 146,198" fill="#FF6B57"/>
    <polygon points="106,208 120,226 134,208" fill="#F5B041"/>
  </svg>`
};

export type UrutauPosturaState =
  | 'vazado'
  | 'camuflagem'
  | 'olhos_fechados'
  | 'sentinela'
  | 'canto'
  | 'comunicacao'
  | 'totem'
  | 'octogono'
  | 'favicon'
  | 'voando';

export type UrutauPose =
  | 'camouflage'
  | 'sentinel'
  | 'blinking'
  | 'singing'
  | 'flying'
  | 'outline';

export const OFFICIAL_URUTAU_PHOTO_URL = '/assets/branding/poses/prancha_oficial_urutau.jpg?v=ouro1';

export function mapPosturaToPose(postura?: UrutauPosturaState | UrutauPose): UrutauPose {
  switch (postura) {
    case 'camouflage':
    case 'camuflagem':
      return 'camouflage';
    case 'blinking':
    case 'olhos_fechados':
      return 'blinking';
    case 'flying':
    case 'voando':
      return 'flying';
    case 'singing':
    case 'canto':
    case 'comunicacao':
      return 'singing';
    case 'outline':
    case 'vazado':
    case 'sentinel':
    case 'sentinela':
    case 'favicon':
    case 'totem':
    case 'octogono':
    default:
      return 'sentinel';
  }
}

export interface PerchRegistration {
  id: string;
  pose: UrutauPose;
  priority: number;
  size: number;
  getRect: () => DOMRect | null;
}

interface UrutauContextValue {
  activePose: UrutauPose;
  setManualPoseOverride: (pose: UrutauPose | null) => void;
  registerPerch: (perch: PerchRegistration) => void;
  unregisterPerch: (id: string) => void;
  triggerSyncFlap: () => void;
  anomalyCount: number;
  scrollToNextAnomaly: () => void;
  hasCustomCompanyLogo: boolean;
  setHasCustomCompanyLogo: (val: boolean) => void;
  spriteSheetUrl: string;
  activePerchId: string | null;
}

const UrutauContext = createContext<UrutauContextValue | null>(null);

export const useUrutau = (): UrutauContextValue => {
  const ctx = useContext(UrutauContext);
  if (!ctx) {
    return {
      activePose: 'sentinel',
      setManualPoseOverride: () => {},
      registerPerch: () => {},
      unregisterPerch: () => {},
      triggerSyncFlap: () => {},
      anomalyCount: 0,
      scrollToNextAnomaly: () => {},
      hasCustomCompanyLogo: false,
      setHasCustomCompanyLogo: () => {},
      spriteSheetUrl: OFFICIAL_URUTAU_PHOTO_URL,
      activePerchId: null
    };
  }
  return ctx;
};

export const URUTAU_DAY_BROWN_HEX = '#F59E0B';
export const URUTAU_NIGHT_GREEN_HEX = '#10B981';

let manualNightFactorOverride: number | null = null;

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const light = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (hue < 60) {
    rPrime = c;
    gPrime = x;
  } else if (hue < 120) {
    rPrime = x;
    gPrime = c;
  } else if (hue < 180) {
    gPrime = c;
    bPrime = x;
  } else if (hue < 240) {
    gPrime = x;
    bPrime = c;
  } else if (hue < 300) {
    rPrime = x;
    bPrime = c;
  } else {
    rPrime = c;
    bPrime = x;
  }

  return {
    r: Math.round((rPrime + m) * 255),
    g: Math.round((gPrime + m) * 255),
    b: Math.round((bPrime + m) * 255)
  };
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      h = 60 * (((gNorm - bNorm) / delta) % 6);
    } else if (max === gNorm) {
      h = 60 * ((bNorm - rNorm) / delta + 2);
    } else {
      h = 60 * ((rNorm - gNorm) / delta + 4);
    }
  }
  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h,
    s: s * 100,
    l: l * 100
  };
}

export function computeNaturalNightFactor(date: Date = new Date()): number {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  if (hours >= 7 && hours < 16) {
    return 0;
  }
  if (hours >= 16 && hours < 19.5) {
    const t = (hours - 16) / 3.5;
    return Number((t * t * (3 - 2 * t)).toFixed(3));
  }
  if (hours >= 19.5 || hours < 5) {
    return 1;
  }
  const t = 1 - (hours - 5) / 2;
  return Number((t * t * (3 - 2 * t)).toFixed(3));
}

export function getUrutauNightFactor(): number {
  if (manualNightFactorOverride !== null) {
    return manualNightFactorOverride;
  }
  return computeNaturalNightFactor();
}

export function getUrutauManualNightFactor(): number | null {
  return manualNightFactorOverride;
}

export function setUrutauManualNightFactor(factor: number | null): void {
  manualNightFactorOverride =
    factor === null ? null : Math.max(0, Math.min(1, Number(factor.toFixed(3))));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('urutau-circadian-change', {
        detail: {
          nightFactor: getUrutauNightFactor(),
          isManual: manualNightFactorOverride !== null
        }
      })
    );
  }
}

export function getCircadianUrutauRgb(nightFactor: number = getUrutauNightFactor()): {
  r: number;
  g: number;
  b: number;
} {
  const t = Math.max(0, Math.min(1, nightFactor));
  const stops = [
    { pos: 0.0, h: 38, s: 94, l: 52 },
    { pos: 0.3, h: 52, s: 95, l: 49 },
    { pos: 0.65, h: 138, s: 86, l: 46 },
    { pos: 1.0, h: 160, s: 86, l: 41 }
  ];

  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].pos && t <= stops[i + 1].pos) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }

  const span = Math.max(0.0001, upper.pos - lower.pos);
  const localT = (t - lower.pos) / span;
  const h = lower.h + (upper.h - lower.h) * localT;
  const s = lower.s + (upper.s - lower.s) * localT;
  const l = lower.l + (upper.l - lower.l) * localT;

  return hslToRgb(h, s, l);
}

export function getCircadianUrutauHex(nightFactor: number = getUrutauNightFactor()): string {
  const { r, g, b } = getCircadianUrutauRgb(nightFactor);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

export function useUrutauNightFactor(): {
  nightFactor: number;
  isManual: boolean;
  circadianHex: string;
  setManualFactor: (val: number | null) => void;
} {
  const [nightFactor, setNightFactor] = useState<number>(() => getUrutauNightFactor());
  const [isManual, setIsManual] = useState<boolean>(() => manualNightFactorOverride !== null);

  useEffect(() => {
    const handleCustom = () => {
      setNightFactor(getUrutauNightFactor());
      setIsManual(manualNightFactorOverride !== null);
    };
    window.addEventListener('urutau-circadian-change', handleCustom);
    const interval = window.setInterval(() => {
      if (manualNightFactorOverride === null) {
        setNightFactor(computeNaturalNightFactor());
      }
    }, 30000);
    return () => {
      window.removeEventListener('urutau-circadian-change', handleCustom);
      window.clearInterval(interval);
    };
  }, []);

  return {
    nightFactor,
    isManual,
    circadianHex: getCircadianUrutauHex(nightFactor),
    setManualFactor: setUrutauManualNightFactor
  };
}

export function getPosturaCircadianPair(posturaKey: string): {
  brownSrc: string;
  greenSrc: string;
  base: string;
  mode: 'gradual' | 'fixed_brown' | 'fixed_green';
} {
  const raw = String(posturaKey || 'sentinela');

  const base = raw.startsWith('canto')
    ? 'canto'
    : raw.startsWith('comunicacao') || raw.startsWith('boca_aberta')
    ? 'comunicacao'
    : raw.startsWith('olhos_fechados') || raw.startsWith('camuflagem') || raw === 'totem'
    ? 'olhos_fechados'
    : 'sentinela';

  const pairs: Record<string, { brownSrc: string; greenSrc: string }> = {
    sentinela: {
      brownSrc: urutauPadraoOlhosAbertosImg,
      greenSrc: urutauPadraoOlhosAbertosImg
    },
    olhos_fechados: {
      brownSrc: urutauOlhosFechadosImg,
      greenSrc: urutauOlhosFechadosImg
    },
    comunicacao: {
      brownSrc: urutauBocaAbertaImg,
      greenSrc: urutauBocaAbertaImg
    },
    canto: {
      brownSrc: urutauBocaAbertaCantoImg,
      greenSrc: urutauBocaAbertaCantoImg
    }
  };

  const pair = pairs[base] || pairs.sentinela;
  return {
    brownSrc: pair.brownSrc,
    greenSrc: pair.greenSrc,
    base,
    mode: 'fixed_green'
  };
}

const transparentBirdCache = new Map<string, string>();
const transparentBirdPending = new Map<string, Promise<string>>();

function isInsideCoreBirdBodyEnvelope(nx: number, ny: number): boolean {
  if (ny < 0.045 || ny > 0.978) return false;
  const dx = Math.abs(nx - 0.5);
  if (ny < 0.145) {
    const maxHalf = 0.135 + ((ny - 0.045) / 0.10) * 0.135;
    return dx <= maxHalf;
  }
  if (ny < 0.295) {
    return dx <= 0.27;
  }
  if (ny < 0.56) {
    return dx <= 0.282;
  }
  if (ny < 0.75) {
    const t = (ny - 0.56) / 0.19;
    return dx <= 0.282 - t * 0.076;
  }
  const t = (ny - 0.75) / 0.228;
  return dx <= 0.192 - t * 0.052;
}

function isInsideBirdSilhouetteEnvelope(
  nx: number,
  ny: number,
  basePose: string,
  r: number,
  g: number,
  b: number
): boolean {
  if (isInsideCoreBirdBodyEnvelope(nx, ny)) {
    return true;
  }
  if (basePose === 'canto') {
    const dx = Math.abs(nx - 0.5);
    if (ny >= 0.092 && ny <= 0.388 && dx > 0.265 && dx <= 0.492) {
      const isBrightTurquoiseWave = g >= 105 && b >= 75 && g > r;
      const isBrightGoldWave = r >= 145 && g >= 115 && b < 115;
      const isBrightUrucumWave = r >= 135 && r - g >= 40;
      return isBrightTurquoiseWave || isBrightGoldWave || isBrightUrucumWave;
    }
  }
  return false;
}

function isDarkForestBackgroundPixel(r: number, g: number, b: number): boolean {
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (maxC <= 32) return true;
  if (lum <= 36 && r < 36 && g >= r) return true;
  if (lum <= 46 && g <= 64 && b <= 48 && r <= 34 && maxC - minC <= 36) return true;
  return false;
}

function extractTransparentBirdFromJpg(src: string, basePose: string): Promise<string> {
  const cacheKey = `v2::${basePose}::${src}`;
  const cached = transparentBirdCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  const pending = transparentBirdPending.get(cacheKey);
  if (pending) return pending;

  if (typeof document === 'undefined' || !src || src.startsWith('data:image/svg')) {
    return Promise.resolve(src);
  }

  const job = new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const maxDim = 360;
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 382, img.naturalHeight || 512));
        const w = Math.max(64, Math.round((img.naturalWidth || 382) * scale));
        const h = Math.max(64, Math.round((img.naturalHeight || 512) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const total = w * h;
        const bgMask = new Uint8Array(total);
        const queue = new Int32Array(total);
        let qHead = 0;
        let qTail = 0;

        for (let y = 0; y < h; y++) {
          const ny = y / h;
          const rowOffset = y * w;
          for (let x = 0; x < w; x++) {
            const nx = x / w;
            const idx = rowOffset + x;
            const p = idx * 4;
            if (!isInsideBirdSilhouetteEnvelope(nx, ny, basePose, data[p], data[p + 1], data[p + 2])) {
              bgMask[idx] = 1;
              queue[qTail++] = idx;
            }
          }
        }

        const neighbors = [-1, 1, -w, w, -w - 1, -w + 1, w - 1, w + 1];
        while (qHead < qTail) {
          const curr = queue[qHead++];
          const cx = curr % w;
          const cy = (curr - cx) / w;
          for (let i = 0; i < neighbors.length; i++) {
            const next = curr + neighbors[i];
            if (next < 0 || next >= total || bgMask[next] !== 0) continue;
            const nx = next % w;
            const ny = (next - nx) / w;
            if (Math.abs(nx - cx) > 1 || Math.abs(ny - cy) > 1) continue;
            const p = next * 4;
            if (isDarkForestBackgroundPixel(data[p], data[p + 1], data[p + 2])) {
              bgMask[next] = 1;
              queue[qTail++] = next;
            }
          }
        }

        for (let y = 0; y < h; y++) {
          const rowOffset = y * w;
          for (let x = 0; x < w; x++) {
            const idx = rowOffset + x;
            const p = idx * 4;
            if (bgMask[idx] === 1) {
              data[p + 3] = 0;
              continue;
            }
            let bgNeighbors = 0;
            if (x > 0 && bgMask[idx - 1] === 1) bgNeighbors++;
            if (x + 1 < w && bgMask[idx + 1] === 1) bgNeighbors++;
            if (y > 0 && bgMask[idx - w] === 1) bgNeighbors++;
            if (y + 1 < h && bgMask[idx + w] === 1) bgNeighbors++;
            if (bgNeighbors >= 3) {
              data[p + 3] = 85;
            } else if (bgNeighbors === 2) {
              data[p + 3] = 160;
            } else if (bgNeighbors === 1) {
              data[p + 3] = 220;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        const sy = Math.round(h * 0.035);
        const sh = Math.round(h * 0.955);
        const outCanvas = document.createElement('canvas');
        outCanvas.width = w;
        outCanvas.height = sh;
        const outCtx = outCanvas.getContext('2d');
        if (outCtx) {
          outCtx.drawImage(canvas, 0, sy, w, sh, 0, 0, w, sh);
          const croppedUrl = outCanvas.toDataURL('image/png');
          transparentBirdCache.set(cacheKey, croppedUrl);
          transparentBirdPending.delete(cacheKey);
          resolve(croppedUrl);
          return;
        }

        const outUrl = canvas.toDataURL('image/png');
        transparentBirdCache.set(cacheKey, outUrl);
        transparentBirdPending.delete(cacheKey);
        resolve(outUrl);
      } catch {
        transparentBirdPending.delete(cacheKey);
        resolve(src);
      }
    };
    let triedFallback = false;
    img.onerror = () => {
      const fallbackDataUrl = URUTAU_OFFICIAL_FOUR_DATA_URLS[src];
      if (!triedFallback && fallbackDataUrl && img.src !== fallbackDataUrl) {
        triedFallback = true;
        img.src = fallbackDataUrl;
        return;
      }
      transparentBirdPending.delete(cacheKey);
      resolve(fallbackDataUrl || src);
    };
    img.src = src;
  });

  transparentBirdPending.set(cacheKey, job);
  return job;
}

export function useTransparentCircadianPair(posturaKey: string) {
  const pair = getPosturaCircadianPair(posturaKey);
  const [greenUrl, setGreenUrl] = useState<string>(() => {
    return transparentBirdCache.get(`v2::${pair.base}::${pair.greenSrc}`) || pair.greenSrc;
  });

  useEffect(() => {
    let cancelled = false;
    extractTransparentBirdFromJpg(pair.greenSrc, pair.base).then((res) => {
      if (!cancelled) setGreenUrl(res);
    });
    return () => {
      cancelled = true;
    };
  }, [pair.greenSrc, pair.base]);

  return {
    brownSrc: greenUrl,
    greenSrc: greenUrl,
    mode: 'fixed_green' as const
  };
}

let globalNetworkInFlight = 0;
let globalBusyUntilTs = 0;
let globalFetchIntercepted = false;
const globalBusySubscribers = new Set<() => void>();

function notifyGlobalBusySubscribers() {
  globalBusySubscribers.forEach((cb) => cb());
}

function pulseGlobalBusyActivity(durationMs = 750) {
  const nextUntil = Date.now() + durationMs;
  if (nextUntil > globalBusyUntilTs) {
    globalBusyUntilTs = nextUntil;
  }
  notifyGlobalBusySubscribers();
}

function ensureGlobalFetchInterceptor() {
  if (globalFetchIntercepted || typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return;
  }
  globalFetchIntercepted = true;
  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    globalNetworkInFlight += 1;
    pulseGlobalBusyActivity(650);
    try {
      const response = await origFetch(...args);
      pulseGlobalBusyActivity(520);
      return response;
    } finally {
      globalNetworkInFlight = Math.max(0, globalNetworkInFlight - 1);
      notifyGlobalBusySubscribers();
    }
  };
  window.addEventListener('urutau:data-refresh', () => pulseGlobalBusyActivity(780));
  window.addEventListener('urutau:offline-sync', () => pulseGlobalBusyActivity(780));
  window.addEventListener('urutau:recalculating', () => pulseGlobalBusyActivity(780));
}

export function useUrutauBusyBlink(externalBusy = false): {
  isBusy: boolean;
  isBlinkClosed: boolean;
} {
  const [isBusy, setIsBusy] = useState<boolean>(externalBusy);
  const [isBlinkClosed, setIsBlinkClosed] = useState<boolean>(false);

  useEffect(() => {
    ensureGlobalFetchInterceptor();
    const checkBusy = () => {
      const active = externalBusy || globalNetworkInFlight > 0 || Date.now() < globalBusyUntilTs;
      setIsBusy(active);
    };
    checkBusy();
    globalBusySubscribers.add(checkBusy);
    const poll = window.setInterval(checkBusy, 160);
    return () => {
      globalBusySubscribers.delete(checkBusy);
      window.clearInterval(poll);
    };
  }, [externalBusy]);

  useEffect(() => {
    if (!isBusy) {
      setIsBlinkClosed(false);
      return;
    }
    setIsBlinkClosed(true);
    const interval = window.setInterval(() => {
      setIsBlinkClosed((prev) => !prev);
    }, 220);
    return () => {
      window.clearInterval(interval);
      setIsBlinkClosed(false);
    };
  }, [isBusy]);

  return { isBusy, isBlinkClosed };
}

export function useUrutauAlertSongAlternation(active: boolean): boolean {
  const [isSingingWave, setIsSingingWave] = useState<boolean>(false);

  useEffect(() => {
    if (!active) {
      setIsSingingWave(false);
      return;
    }
    const interval = window.setInterval(() => {
      setIsSingingWave((prev) => !prev);
    }, 360);
    return () => {
      window.clearInterval(interval);
      setIsSingingWave(false);
    };
  }, [active]);

  return isSingingWave;
}

function applyFaviconDataUrlToHead(href: string, mimeType = 'image/svg+xml') {
  if (typeof document === 'undefined') return;
  const links = Array.from(
    document.querySelectorAll("link[rel*='icon']")
  ) as HTMLLinkElement[];

  if (links.length === 0) {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = mimeType;
    link.href = href;
    document.head.appendChild(link);
    return;
  }

  links.forEach((link) => {
    link.type = mimeType;
    link.href = href;
  });
}

export function buildSymbolicUrutauFaviconSvgDataUrl(
  poseKey = 'sentinela',
  nightFactor = 1,
  customPrimaryHex?: string
): string {
  const isNight = nightFactor >= 0.45;
  const crestPrimary =
    customPrimaryHex && /^#[0-9A-Fa-f]{6}$/.test(customPrimaryHex)
      ? customPrimaryHex
      : isNight
      ? '#10B981'
      : '#D97706';
  const crestLight = isNight ? '#34D399' : '#FBBF24';
  const isEyesClosed =
    poseKey.includes('olhos_fechados') || poseKey.includes('camuflagem');
  const isSinging = poseKey.includes('canto') || poseKey.includes('comunicacao');

  const eyesMarkup = isEyesClosed
    ? `
      <path d="M13.5 29.5 L29.5 26.5" stroke="#F59E0B" stroke-width="3.2" stroke-linecap="round" />
      <path d="M50.5 29.5 L34.5 26.5" stroke="#F59E0B" stroke-width="3.2" stroke-linecap="round" />
      <path d="M15.5 29.2 L27.5 27" stroke="#34D399" stroke-width="1.4" stroke-linecap="round" />
      <path d="M48.5 29.2 L36.5 27" stroke="#34D399" stroke-width="1.4" stroke-linecap="round" />
    `
    : `
      <circle cx="21.5" cy="28.5" r="8.2" fill="url(#urutauGold)" stroke="#04120C" stroke-width="1.8" />
      <circle cx="42.5" cy="28.5" r="8.2" fill="url(#urutauGold)" stroke="#04120C" stroke-width="1.8" />
      <circle cx="21.5" cy="28.5" r="5.6" fill="#FDE68A" />
      <circle cx="42.5" cy="28.5" r="5.6" fill="#FDE68A" />
      <polygon points="21.5,23.2 24.5,28.5 21.5,33.8 18.5,28.5" fill="#04120C" />
      <polygon points="42.5,23.2 45.5,28.5 42.5,33.8 39.5,28.5" fill="#04120C" />
      <circle cx="19.8" cy="26.5" r="1.4" fill="#FFFFFF" />
      <circle cx="40.8" cy="26.5" r="1.4" fill="#FFFFFF" />
    `;

  const acousticArcsMarkup = isSinging
    ? `
      <path d="M6 19 Q3 28 6 37" stroke="#34D399" stroke-width="2.2" stroke-linecap="round" fill="none" />
      <path d="M58 19 Q61 28 58 37" stroke="#34D399" stroke-width="2.2" stroke-linecap="round" fill="none" />
    `
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
    <defs>
      <linearGradient id="urutauEmerald" x1="12" y1="6" x2="52" y2="58" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="${crestLight}" />
        <stop offset="55%" stop-color="${crestPrimary}" />
        <stop offset="100%" stop-color="#059669" />
      </linearGradient>
      <linearGradient id="urutauGold" x1="16" y1="10" x2="48" y2="54" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#FDE68A" />
        <stop offset="50%" stop-color="#F59E0B" />
        <stop offset="100%" stop-color="#D97706" />
      </linearGradient>
    </defs>
    ${acousticArcsMarkup}
    <path d="M32 4 L25 14 L14 8 L10 24 L16 38 L32 52 L48 38 L54 24 L50 8 L39 14 Z" fill="#061A14" fill-opacity="0.72" stroke="url(#urutauEmerald)" stroke-width="2.6" stroke-linejoin="round" />
    <path d="M14 8 L24 22 L32 17 L40 22 L50 8" stroke="url(#urutauGold)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M12 27 L20 42 L32 58 L44 42 L52 27" stroke="url(#urutauEmerald)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M22 46 L32 55 L42 46" stroke="#D9381E" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />
    <polygon points="32,54 28,60 32,62 36,60" fill="url(#urutauGold)" />
    ${eyesMarkup}
    <polygon points="32,29 27.5,36.5 32,42.5 36.5,36.5" fill="url(#urutauGold)" stroke="#04120C" stroke-width="1.5" stroke-linejoin="round" />
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function useSyncSystemFavicon(
  brandConfig: BrandIdentityConfig | undefined,
  nightFactor: number
) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let cancelled = false;

    const slotCustom = brandConfig?.slotCustomizations?.favicon_guia;
    const hasLogo = Boolean(brandConfig?.logoDataUrl);

    let singleCustomUrl: string | null = null;
    if (slotCustom?.choice === 'imagem_especifica' && slotCustom.customDataUrl) {
      singleCustomUrl = slotCustom.customDataUrl;
    } else if (slotCustom?.choice === 'logo_principal' && hasLogo && brandConfig?.logoDataUrl) {
      singleCustomUrl = brandConfig.logoDataUrl;
    } else {
      const placement = brandConfig?.imagePlacements?.favicon_guia;
      const customGalleryItem = (brandConfig?.customGallery || []).find(
        (g) => g.id === placement
      );
      if (!slotCustom && customGalleryItem?.dataUrl) {
        singleCustomUrl = customGalleryItem.dataUrl;
      }
    }

    const loadImg = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    const renderFavicon = async () => {
      if (singleCustomUrl) {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, size, size);
        try {
          const img = await loadImg(singleCustomUrl);
          if (cancelled) return;
          ctx.drawImage(img, 0, 0, size, size);
          applyFaviconDataUrlToHead(canvas.toDataURL('image/png'), 'image/png');
        } catch {
          if (!cancelled) {
            applyFaviconDataUrlToHead(singleCustomUrl, 'image/png');
          }
        }
        return;
      }

      const activeKey =
        brandConfig?.imagePlacements?.favicon_guia &&
        brandConfig.imagePlacements.favicon_guia !== 'olhos_fechados'
          ? String(brandConfig.imagePlacements.favicon_guia)
          : 'sentinela';

      const symbolicSvgUrl = buildSymbolicUrutauFaviconSvgDataUrl(
        activeKey,
        nightFactor,
        brandConfig?.effectivePrimaryHex
      );
      if (!cancelled) {
        applyFaviconDataUrlToHead(symbolicSvgUrl, 'image/svg+xml');
      }
    };

    renderFavicon();

    return () => {
      cancelled = true;
    };
  }, [brandConfig, nightFactor]);
}

function useDynamicUrutauFavicon(
  pose: UrutauPose,
  isOffline: boolean,
  anomalyCount: number
) {
  const { nightFactor } = useUrutauNightFactor();

  useEffect(() => {
    const baseKey =
      isOffline || pose === 'camouflage'
        ? 'camuflagem'
        : anomalyCount > 0 || pose === 'singing'
        ? 'canto'
        : pose === 'blinking'
        ? 'olhos_fechados'
        : pose === 'flying'
        ? 'voando'
        : 'sentinela';

    const symbolicSvgUrl = buildSymbolicUrutauFaviconSvgDataUrl(baseKey, nightFactor);
    applyFaviconDataUrlToHead(symbolicSvgUrl, 'image/svg+xml');
  }, [pose, isOffline, anomalyCount, nightFactor]);
}

export const UrutauProvider: React.FC<{
  children: React.ReactNode;
  spriteSheetUrl?: string;
  inactivitySecondsRemaining?: number;
  isSessionLocked?: boolean;
  hasCustomCompanyLogo?: boolean;
}> = ({
  children,
  spriteSheetUrl = OFFICIAL_URUTAU_PHOTO_URL,
  inactivitySecondsRemaining = 300,
  isSessionLocked = false,
  hasCustomCompanyLogo: initialHasLogo = false
}) => {
  const perchesRef = useRef<Map<string, PerchRegistration>>(new Map());
  const [activePerch, setActivePerch] = useState<PerchRegistration | null>(null);
  const [isUpdatingBlink, setIsUpdatingBlink] = useState(false);
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [manualPoseOverride, setManualPoseOverride] = useState<UrutauPose | null>(null);
  const [anomalyCount, setAnomalyCount] = useState(0);
  const [hasCustomCompanyLogo, setHasCustomCompanyLogo] = useState(initialHasLogo);
  const blinkTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setHasCustomCompanyLogo(initialHasLogo);
  }, [initialHasLogo]);

  const triggerUpdateBlink = useCallback(() => {
    setIsUpdatingBlink(true);
    if (blinkTimerRef.current) window.clearTimeout(blinkTimerRef.current);
    blinkTimerRef.current = window.setTimeout(() => {
      setIsUpdatingBlink(false);
    }, 650);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      triggerUpdateBlink();
    };
    const handleOffline = () => setIsOffline(true);
    const handleOfflineState = (ev: Event) => {
      const customEv = ev as CustomEvent<{ isOffline?: boolean }>;
      if (typeof customEv.detail?.isOffline === 'boolean') {
        setIsOffline(customEv.detail.isOffline);
      }
    };
    const handleSyncOrRefresh = () => {
      triggerUpdateBlink();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('urutau:offline-state', handleOfflineState);
    window.addEventListener('urutau:offline-sync', handleSyncOrRefresh);
    window.addEventListener('urutau:data-refresh', handleSyncOrRefresh);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('urutau:offline-state', handleOfflineState);
      window.removeEventListener('urutau:offline-sync', handleSyncOrRefresh);
      window.removeEventListener('urutau:data-refresh', handleSyncOrRefresh);
    };
  }, [triggerUpdateBlink]);

  useEffect(() => {
    const scanAnomalies = () => {
      const nodes = document.querySelectorAll('[data-urutau-anomaly="true"]');
      setAnomalyCount(nodes.length);
    };

    scanAnomalies();
    const observer = new MutationObserver(scanAnomalies);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-urutau-anomaly']
    });
    return () => observer.disconnect();
  }, []);

  const evaluateTopPerch = useCallback(() => {
    let best: PerchRegistration | null = null;
    perchesRef.current.forEach((p) => {
      if (!best || p.priority >= best.priority) {
        best = p;
      }
    });
    setActivePerch(best);
  }, []);

  const registerPerch = useCallback(
    (perch: PerchRegistration) => {
      perchesRef.current.set(perch.id, perch);
      evaluateTopPerch();
    },
    [evaluateTopPerch]
  );

  const unregisterPerch = useCallback(
    (id: string) => {
      perchesRef.current.delete(id);
      evaluateTopPerch();
    },
    [evaluateTopPerch]
  );

  const scrollToNextAnomaly = useCallback(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-urutau-anomaly="true"]')
    );
    if (nodes.length === 0) return;
    const target = nodes[0];
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('ring-2', 'ring-amber-400');
    window.setTimeout(() => {
      target.classList.remove('ring-2', 'ring-amber-400');
    }, 2200);
  }, []);

  const { isBlinkClosed: isNetworkBlinkClosed } = useUrutauBusyBlink(isUpdatingBlink);

  const resolvedPose: UrutauPose = (() => {
    if (manualPoseOverride) return manualPoseOverride;
    if (anomalyCount > 0) return 'singing';
    if (isUpdatingBlink || isNetworkBlinkClosed) return 'blinking';
    if (isOffline || isSessionLocked || inactivitySecondsRemaining <= 60) {
      return 'camouflage';
    }
    return activePerch?.pose || 'sentinel';
  })();

  useDynamicUrutauFavicon(resolvedPose, isOffline, anomalyCount);

  return (
    <UrutauContext.Provider
      value={{
        activePose: resolvedPose,
        setManualPoseOverride,
        registerPerch,
        unregisterPerch,
        triggerSyncFlap: triggerUpdateBlink,
        anomalyCount,
        scrollToNextAnomaly,
        hasCustomCompanyLogo,
        setHasCustomCompanyLogo,
        spriteSheetUrl,
        activePerchId: activePerch?.id || null
      }}
    >
      {children}
    </UrutauContext.Provider>
  );
};

export const UrutauPerch: React.FC<{
  id: string;
  pose?: UrutauPose;
  priority?: number;
  size?: number;
  className?: string;
}> = ({ id, pose = 'sentinel', priority = 10, size = 36, className = '' }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const {
    activePose,
    registerPerch,
    unregisterPerch,
    anomalyCount,
    scrollToNextAnomaly,
    hasCustomCompanyLogo
  } = useUrutau();

  useLayoutEffect(() => {
    registerPerch({
      id,
      pose,
      priority,
      size,
      getRect: () => ref.current?.getBoundingClientRect() || null
    });
    return () => unregisterPerch(id);
  }, [id, pose, priority, size, registerPerch, unregisterPerch]);

  if (id.startsWith('perch-btn-')) {
    return null;
  }

  const effectiveSize =
    hasCustomCompanyLogo && priority <= 20 ? Math.min(size, 26) : size;

  const displayPose: UrutauPose =
    pose === 'singing' && activePose === 'sentinel' ? 'singing' : activePose;

  return (
    <div
      ref={ref}
      data-urutau-perch={id}
      onClick={anomalyCount > 0 ? scrollToNextAnomaly : undefined}
      style={{ width: effectiveSize, height: effectiveSize }}
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${
        anomalyCount > 0 ? 'cursor-pointer' : ''
      } ${className}`}
      title={
        anomalyCount > 0
          ? `${anomalyCount} alerta(s) — clique para localizar`
          : 'Urutau'
      }
    >
      <UrutauEmblemSVG pose={displayPose} size={effectiveSize} />
      {anomalyCount > 0 && priority <= 20 && (
        <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-amber-400 text-[#081712] font-mono font-bold text-[9px] leading-3.5 flex items-center justify-center">
          {anomalyCount}
        </span>
      )}
    </div>
  );
};

export const UrutauEmblemSVG: React.FC<{
  pose?: UrutauPose;
  postura?: UrutauPosturaState;
  size?: number | string;
  className?: string;
  pupilOffset?: { x: number; y: number };
  isBlinking?: boolean;
  spriteUrl?: string;
  ssePulse?: boolean;
  disableAutoBlink?: boolean;
}> = ({
  pose,
  postura,
  size,
  className = 'w-8 h-8',
  isBlinking = false,
  ssePulse = false,
  disableAutoBlink = false
}) => {
  const { nightFactor } = useUrutauNightFactor();
  const { isBlinkClosed } = useUrutauBusyBlink(ssePulse || isBlinking);
  const isExplicitAlert =
    postura === 'canto' ||
    postura === 'comunicacao' ||
    String(postura || '').startsWith('canto') ||
    String(postura || '').startsWith('comunicacao') ||
    pose === 'singing';
  const isSingingWave = useUrutauAlertSongAlternation(!disableAutoBlink && isExplicitAlert);

  const resolvedKey: string = (() => {
    if (isExplicitAlert) {
      if (disableAutoBlink) {
        return postura || 'canto';
      }
      return isSingingWave ? 'canto' : 'comunicacao';
    }
    if (!disableAutoBlink && (isBlinking || pose === 'blinking' || isBlinkClosed)) {
      return 'olhos_fechados';
    }
    if (postura === 'olhos_fechados' || postura === 'camuflagem') return 'olhos_fechados';
    if (pose === 'camouflage') return 'olhos_fechados';
    return 'sentinela';
  })();

  const pair = useTransparentCircadianPair(resolvedKey);
  const greenOpacity = 1;
  const midBoost = 1;

  if (postura === 'favicon') {
    const symbolicSrc = buildSymbolicUrutauFaviconSvgDataUrl('sentinela', nightFactor);
    return (
      <div
        style={size !== undefined ? { width: size, height: size } : undefined}
        className={`relative inline-flex items-center justify-center select-none ${
          size !== undefined ? '' : className
        }`}
      >
        <img
          src={symbolicSrc}
          alt="Urutau Favicon Simbólico"
          className="w-full h-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
        />
      </div>
    );
  }

  const fallbackSvgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(ICONES_SVG.urutauOrnamental)}`;

  return (
    <div
      style={size !== undefined ? { width: size, height: size } : undefined}
      className={`relative inline-flex items-center justify-center select-none ${
        size !== undefined ? '' : className
      }`}
    >
      <img
        src={pair.greenSrc}
        alt={`Urutau (${resolvedKey})`}
        onError={(e) => {
          if (e.currentTarget.src !== fallbackSvgDataUrl) {
            e.currentTarget.src = fallbackSvgDataUrl;
          }
        }}
        className="w-full h-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)]"
      />
    </div>
  );
};

export function UrutauWatermarkSVG({
  variant = 'vazado',
  className = 'w-24 h-24 opacity-10'
}: {
  variant?: 'vazado' | 'totem' | 'octogono' | 'favicon' | 'voando';
  className?: string;
}) {
  return (
    <div className={`pointer-events-none select-none inline-flex items-center justify-center ${className}`} aria-hidden="true">
      <UrutauEmblemSVG postura={variant} className="w-full h-full" />
    </div>
  );
}

export function MarajoaraDividerSVG({ className = 'w-full h-3' }: { className?: string }) {
  return (
    <div className={`w-full overflow-hidden flex items-center select-none ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 400 12"
        preserveAspectRatio="none"
        className="w-full h-full opacity-75"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1="0" y1="2" x2="400" y2="2" stroke="#556333" strokeWidth="1" strokeOpacity="0.6" />
        <line x1="0" y1="10" x2="400" y2="10" stroke="#556333" strokeWidth="1" strokeOpacity="0.6" />
        <path
          d="M0,6 L10,2 L20,10 L30,2 L40,10 L50,2 L60,10 L70,2 L80,10 L90,2 L100,10 L110,2 L120,10 L130,2 L140,10 L150,2 L160,10 L170,2 L180,10 L190,2 L200,6 L210,2 L220,10 L230,2 L240,10 L250,2 L260,10 L270,2 L280,10 L290,2 L300,10 L310,2 L320,10 L330,2 L340,10 L350,2 L360,10 L370,2 L380,10 L390,2 L400,6"
          fill="none"
          stroke="#10B981"
          strokeWidth="1.2"
          strokeOpacity="0.45"
        />
        <polygon points="196,6 200,2 204,6 200,10" fill="#D9381E" fillOpacity="0.85" />
        <polygon points="186,6 190,3 194,6 190,9" fill="#F5B041" fillOpacity="0.85" />
        <polygon points="206,6 210,3 214,6 210,9" fill="#F5B041" fillOpacity="0.85" />
      </svg>
    </div>
  );
}

export function CestariaGrafismoSVG({
  expanded = false,
  className = 'w-3.5 h-3.5'
}: {
  expanded?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} cestaria-grafismo ${
        expanded ? 'cestaria-grafismo-open text-[#10B981]' : 'text-[#94A3B8]'
      }`}
      aria-hidden="true"
    >
      <path
        d="M9 6L15 12L9 18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const AVAILABLE_MENU_ICONS: { name: string; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { name: 'Percent', label: 'Porcentagem / Rateio', Icon: Percent },
  { name: 'Calendar', label: 'Calendário / Escalas', Icon: Calendar },
  { name: 'CheckSquare', label: 'Tarefas / Agenda', Icon: CheckSquare },
  { name: 'Utensils', label: 'Restaurante / Salão', Icon: Utensils },
  { name: 'Globe', label: 'Portais / Web', Icon: Globe },
  { name: 'MessageSquare', label: 'Chat / WhatsApp', Icon: MessageSquare },
  { name: 'Wallet', label: 'Carteira / Caixa', Icon: Wallet },
  { name: 'Package', label: 'Pacote / Estoque', Icon: Package },
  { name: 'ShoppingCart', label: 'Carrinho / Compras', Icon: ShoppingCart },
  { name: 'PieChart', label: 'Gráfico / CMV', Icon: PieChart },
  { name: 'Users', label: 'Equipe / Pessoas', Icon: Users },
  { name: 'UserPlus', label: 'Recrutamento / Seleção', Icon: UserPlus },
  { name: 'ShieldCheck', label: 'Segurança / RH', Icon: ShieldCheck },
  { name: 'Building2', label: 'Prédio / Unidades', Icon: Building2 },
  { name: 'Layers', label: 'Camadas / Setores', Icon: Layers },
  { name: 'ClipboardCheck', label: 'Checklist / Auditoria', Icon: ClipboardCheck },
  { name: 'Bell', label: 'Sino / Alertas', Icon: Bell },
  { name: 'FileSearch', label: 'Busca / Logs', Icon: FileSearch },
  { name: 'Settings', label: 'Engrenagem / Config', Icon: Settings },
  { name: 'Network', label: 'Rede / Multi-Empresa', Icon: Network },
  { name: 'Sparkles', label: 'Estrelas / Talentos', Icon: Sparkles },
  { name: 'Briefcase', label: 'Maleta / Negócios', Icon: Briefcase },
  { name: 'Truck', label: 'Caminhão / Entregas', Icon: Truck },
  { name: 'CreditCard', label: 'Cartão / Pagamentos', Icon: CreditCard },
  { name: 'BarChart3', label: 'Indicadores / Metas', Icon: BarChart3 },
  { name: 'Award', label: 'Premiação / Qualidade', Icon: Award },
  { name: 'Clock', label: 'Relógio / Ponto', Icon: Clock },
  { name: 'Store', label: 'Loja / Filial', Icon: Store },
  { name: 'Receipt', label: 'Cupom / Fiscal', Icon: Receipt },
  { name: 'Landmark', label: 'Banco / Tesouraria', Icon: Landmark },
  { name: 'Headphones', label: 'Atendimento / Suporte', Icon: Headphones },
  { name: 'Wrench', label: 'Manutenção / Ajustes', Icon: Wrench },
  { name: 'FolderKanban', label: 'Projetos / Quadro', Icon: FolderKanban },
  { name: 'Boxes', label: 'Lotes / Almoxarifado', Icon: Boxes },
  { name: 'Coins', label: 'Moedas / Comissões', Icon: Coins },
  { name: 'BadgeCheck', label: 'Aprovação / Qualidade', Icon: BadgeCheck },
  { name: 'TrendingUp', label: 'Crescimento / Vendas', Icon: TrendingUp },
  { name: 'MapPin', label: 'Localização / Região', Icon: MapPin },
  { name: 'FileText', label: 'Documentos / Contratos', Icon: FileText },
  { name: 'KeyRound', label: 'Chave / Acessos', Icon: KeyRound },
  { name: 'Server', label: 'Servidor / VPS', Icon: Server }
];

export function TabIconSVG({
  tab,
  iconName,
  iconColor,
  className = 'w-4 h-4'
}: {
  tab: TabId;
  iconName?: string;
  iconColor?: string;
  className?: string;
}) {
  const colorStyle = iconColor ? { color: iconColor } : undefined;

  if (iconName) {
    const found = AVAILABLE_MENU_ICONS.find((i) => i.name === iconName);
    if (found) {
      const CustomIcon = found.Icon;
      return (
        <span style={colorStyle} className="inline-flex items-center justify-center shrink-0">
          <CustomIcon className={className} />
        </span>
      );
    }
  }

  const renderBaseIcon = () => {
    switch (tab) {
      case 'empresas':
        return <Network className={className} />;
      case 'freelancers':
        return <Sparkles className={className} />;
      case 'rateio':
        return <Percent className={className} />;
      case 'escalas':
        return <Calendar className={className} />;
      case 'agenda':
        return <CheckSquare className={className} />;
      case 'pdv':
        return <Receipt className={className} />;
      case 'reservas':
        return <Utensils className={className} />;
      case 'portais':
        return <Globe className={className} />;
      case 'chat':
        return <MessageSquare className={className} />;
      case 'caixa':
        return <Wallet className={className} />;
      case 'estoque':
        return <Package className={className} />;
      case 'compras':
        return <ShoppingCart className={className} />;
      case 'cmv':
        return <PieChart className={className} />;
      case 'cadastros':
        return <Users className={className} />;
      case 'equipe':
        return <Users className={className} />;
      case 'selecao':
        return <UserPlus className={className} />;
      case 'rh':
        return <ShieldCheck className={className} />;
      case 'unidades':
        return <Building2 className={className} />;
      case 'setores':
        return <Layers className={className} />;
      case 'checklists':
        return <ClipboardCheck className={className} />;
      case 'modulos':
        return <Boxes className={className} />;
      case 'notificacoes':
        return <Bell className={className} />;
      case 'auditoria':
        return <FileSearch className={className} />;
      case 'permissoes':
        return <KeyRound className={className} />;
      case 'servidor_ia':
        return <Server className={className} />;
      case 'config':
        return <Settings className={className} />;
      default:
        return <Settings className={className} />;
    }
  };

  if (colorStyle) {
    return (
      <span style={colorStyle} className="inline-flex items-center justify-center shrink-0">
        {renderBaseIcon()}
      </span>
    );
  }

  return renderBaseIcon();
}

export function CategorySymbolSVG({
  categoryId,
  colorHex,
  className = 'w-4 h-4'
}: {
  categoryId: string;
  colorHex?: string;
  className?: string;
}) {
  const stroke = colorHex || '#26A69A';
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0`}
      style={{ color: stroke }}
      aria-hidden="true"
    >
      {categoryId === 'salao_atendimento' || categoryId === 'atendimento' ? (
        <>
          <circle cx="8.5" cy="9.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="15.5" cy="9.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 15.5L12 19.5L19 15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : categoryId === 'operacao_escalas' || categoryId === 'operacao' ? (
        <>
          <polygon points="12,3 21,12 12,21 3,12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <polygon points="10,10 14,10 12,14.5" fill="currentColor" />
        </>
      ) : categoryId === 'financeiro_caixa' || categoryId === 'financeiro' ? (
        <>
          <polygon points="8,3 16,3 21,8 21,16 16,21 8,21 3,16 3,8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8 10.5L12 14L16 10.5M9.5 14.5L12 17L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : categoryId === 'estoque_suprimentos' ? (
        <>
          <polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M4.5 8L12 12.5L19.5 8M12 12.5V20.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : categoryId === 'pessoas_equipe' || categoryId === 'pessoas' ? (
        <>
          <circle cx="12" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M4 13L12 17.5L20 13M6.5 17.5L12 20.5L17.5 17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : categoryId === 'rh_selecao' ? (
        <>
          <polygon points="12,3 19,7 17,18 12,21 7,18 5,7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="9.5" cy="10.5" r="1.2" fill="currentColor" />
          <circle cx="14.5" cy="10.5" r="1.2" fill="currentColor" />
          <path d="M8.5 14.5L12 17L15.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : categoryId === 'governanca_sistema' || categoryId === 'governanca' || categoryId === 'admin' ? (
        <>
          <polygon points="12,3 20,8 18,18 12,21 6,18 4,8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M5 8.5L12 12.5L19 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="12" cy="15.5" r="2" stroke="currentColor" strokeWidth="1.6" />
        </>
      ) : (
        <>
          <polygon points="12,3 21,19 3,19" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M7.5 13.5L12 16.5L16.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

export function VisualAvatar({
  name,
  role,
  size = 'md',
  highlight = false
}: {
  name: string;
  role?: string;
  size?: 'sm' | 'md' | 'lg';
  highlight?: boolean;
}) {
  const initials = String(name || 'UR')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');

  const rLower = String(role || '').toLowerCase();
  const isAdmin = rLower.includes('admin') || rLower.includes('diretor') || rLower.includes('gerente');
  const isChef = rLower.includes('chef') || rLower.includes('cozinha');
  const isBar = rLower.includes('bar') || rLower.includes('sommelier');

  const dims =
    size === 'sm'
      ? 'w-7 h-7 text-[10px]'
      : size === 'lg'
      ? 'w-11 h-11 text-sm'
      : 'w-9 h-9 text-xs';

  return (
    <div
      className={`relative rounded-xl flex items-center justify-center font-mono font-bold shrink-0 select-none border transition-transform ${dims} ${
        highlight || isAdmin
          ? 'bg-gradient-to-br from-[#10B981]/30 via-[#0A1F17] to-[#F59E0B]/30 border-[#F59E0B]/60 text-[#F8FAFC] shadow-sm'
          : isChef
          ? 'bg-gradient-to-br from-[#F43F5E]/25 to-[#0A1F17] border-[#F43F5E]/50 text-[#F8FAFC]'
          : isBar
          ? 'bg-gradient-to-br from-[#8B5CF6]/25 to-[#0A1F17] border-[#8B5CF6]/50 text-[#F8FAFC]'
          : 'bg-gradient-to-br from-[#10B981]/20 to-[#0A1F17] border-[#10B981]/40 text-[#F8FAFC]'
      }`}
      title={`${name}${role ? ` • ${role}` : ''}`}
    >
      <span>{initials}</span>
      <span
        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] border border-[#05100C] ${
          isAdmin
            ? 'bg-[#F59E0B] text-[#05100C]'
            : isChef
            ? 'bg-[#F43F5E] text-white'
            : isBar
            ? 'bg-[#8B5CF6] text-white'
            : 'bg-[#10B981] text-[#05100C]'
        }`}
      >
        {isAdmin ? '' : isChef ? '' : isBar ? '' : '●'}
      </span>
    </div>
  );
}

export function TableVisualSVG({
  mesa,
  adultosPag = 0,
  adultosFreq = 0,
  kidsPag = 0,
  kidsFreq = 0,
  totalPax: totalPaxProp,
  status = 'Confirmada'
}: {
  mesa: string;
  adultosPag?: number;
  adultosFreq?: number;
  kidsPag?: number;
  kidsFreq?: number;
  totalPax?: number;
  status?: string;
}) {
  const totalPag = Number(adultosPag) + Number(kidsPag);
  const totalFreq = Number(adultosFreq) + Number(kidsFreq);
  const totalPax = totalPaxProp !== undefined ? Number(totalPaxProp) : totalPag + totalFreq;
  const effectivePag = totalPag > 0 ? totalPag : totalPax;
  const maxSeats = Math.max(4, Math.min(8, totalPax || 4));
  const seats = Array.from({ length: maxSeats }, (_, idx) => {
    if (idx < effectivePag) return 'pagante';
    if (idx < effectivePag + totalFreq) return 'cortesia';
    return 'vazio';
  });

  const isConfirmed = String(status).toLowerCase().includes('confirm');

  return (
    <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0 select-none">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        
        {seats.map((seatType, i) => {
          const angle = (i * 2 * Math.PI) / seats.length - Math.PI / 2;
          const cx = 50 + 38 * Math.cos(angle);
          const cy = 50 + 38 * Math.sin(angle);
          const fill =
            seatType === 'pagante'
              ? '#10B981'
              : seatType === 'cortesia'
              ? '#F59E0B'
              : '#113025';
          const stroke =
            seatType === 'pagante'
              ? '#34D399'
              : seatType === 'cortesia'
              ? '#FBBF24'
              : '#1E3A2F';
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="7.5"
              fill={fill}
              stroke={stroke}
              strokeWidth="1.8"
            />
          );
        })}
        
        <circle
          cx="50"
          cy="50"
          r="25"
          fill="#071712"
          stroke={isConfirmed ? '#10B981' : '#F59E0B'}
          strokeWidth="2.5"
        />
        <circle
          cx="50"
          cy="50"
          r="20"
          fill="none"
          stroke="rgba(245, 158, 11, 0.25)"
          strokeWidth="1"
          strokeDasharray="3 2"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="font-mono text-[10px] font-black text-white leading-none">{mesa}</span>
        <span className="font-mono text-[9px] text-[#10B981] font-bold mt-0.5">{totalPax}p</span>
      </div>
    </div>
  );
}

export function ProductVisualThumbSVG({
  category = '',
  categoria = '',
  nome = '',
  critical = false
}: {
  category?: string;
  categoria?: string;
  nome?: string;
  critical?: boolean;
}) {
  const catLower = `${category} ${categoria} ${nome}`.toLowerCase();
  const isProtein = catLower.includes('prote') || catLower.includes('pesc') || catLower.includes('carn') || catLower.includes('pirarucu') || catLower.includes('filhote');
  const isDrink = catLower.includes('bebid') || catLower.includes('bar') || catLower.includes('destil') || catLower.includes('vinho') || catLower.includes('gin');
  const isAmaz = catLower.includes('amaz') || catLower.includes('tucupi') || catLower.includes('hort') || catLower.includes('jambu') || catLower.includes('acai');

  return (
    <div
      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border relative overflow-hidden ${
        critical
          ? 'bg-gradient-to-br from-[#F43F5E]/25 to-[#071712] border-[#F43F5E]/50'
          : isProtein
          ? 'bg-gradient-to-br from-[#F59E0B]/20 to-[#071712] border-[#F59E0B]/40'
          : isDrink
          ? 'bg-gradient-to-br from-[#8B5CF6]/20 to-[#071712] border-[#8B5CF6]/40'
          : 'bg-gradient-to-br from-[#10B981]/20 to-[#071712] border-[#10B981]/40'
      }`}
    >
      <svg viewBox="0 0 36 36" className="w-6 h-6" fill="none">
        {isProtein ? (
          <>
            <path
              d="M6 18C10 11 20 11 26 18C20 25 10 25 6 18Z"
              fill="#F59E0B"
              fillOpacity="0.3"
              stroke="#F59E0B"
              strokeWidth="2"
            />
            <polygon points="26,18 32,13 31,23" fill="#F59E0B" />
            <circle cx="12" cy="17" r="1.5" fill="#FEF08A" />
          </>
        ) : isDrink ? (
          <>
            <path
              d="M11 8H25L20 18V27H24V29H12V27H16V18L11 8Z"
              fill="#8B5CF6"
              fillOpacity="0.3"
              stroke="#C4B5FD"
              strokeWidth="1.8"
            />
            <circle cx="18" cy="13" r="2" fill="#F59E0B" />
          </>
        ) : isAmaz ? (
          <>
            <path
              d="M18 6C24 10 27 18 18 30C9 18 12 10 18 6Z"
              fill="#10B981"
              fillOpacity="0.3"
              stroke="#10B981"
              strokeWidth="2"
            />
            <line x1="18" y1="10" x2="18" y2="27" stroke="#F59E0B" strokeWidth="1.5" />
          </>
        ) : (
          <>
            <rect
              x="8"
              y="9"
              width="20"
              height="18"
              rx="3"
              fill="#10B981"
              fillOpacity="0.25"
              stroke="#10B981"
              strokeWidth="2"
            />
            <line x1="8" y1="15" x2="28" y2="15" stroke="#F59E0B" strokeWidth="1.5" />
          </>
        )}
      </svg>
      {critical && (
        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[#F43F5E]" />
      )}
    </div>
  );
}

export function CircularGaugeSVG({
  value,
  percent,
  max = 100,
  label,
  color,
  colorHex,
  size = 52
}: {
  value?: number;
  percent?: number;
  max?: number;
  label?: string;
  color?: string;
  colorHex?: string;
  size?: number;
}) {
  const rawVal = percent !== undefined ? percent : value ?? 0;
  const strokeColor = colorHex || color || '#10B981';
  const pct = Math.max(0, Math.min(100, max > 0 ? (rawVal / max) * 100 : 0));
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div
      style={{ width: size, height: size }}
      className="relative flex items-center justify-center shrink-0 select-none"
    >
      <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="4"
        />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <span className="absolute font-mono text-[10px] font-bold text-white tabular-nums">
        {label ?? `${Math.round(pct)}%`}
      </span>
    </div>
  );
}

export interface ResolvedWhatsappInfo {
  numeroCompleto: string;
  formatado: string;
  dddInferido: string;
  paisInferido: string;
  encontradoNoBanco: boolean;
  nomeEncontrado?: string;
  explicacao: string;
}

export function resolverWhatsappInteligente(
  inputRaw: string,
  data?: any,
  usuarioLogado?: any
): ResolvedWhatsappInfo {
  const digits = String(inputRaw || '').replace(/\D/g, '');
  if (!digits) {
    return {
      numeroCompleto: '',
      formatado: '',
      dddInferido: '91',
      paisInferido: '55',
      encontradoNoBanco: false,
      explicacao: ''
    };
  }

  const registrosBanco: { nome: string; tel: string }[] = [];
  const pushTel = (nome: string, rawTel: any) => {
    const clean = String(rawTel || '').replace(/\D/g, '');
    if (clean.length >= 10) {
      registrosBanco.push({ nome: nome || 'Registro', tel: clean.startsWith('55') ? clean : `55${clean}` });
    }
  };

  (data?.usuarios || []).forEach((u: any) => pushTel(u.nome, u.telefone));
  (data?.cadastrosPessoas || []).forEach((p: any) => pushTel(p.nome, p.whatsapp));
  (data?.empresas || []).forEach((e: any) => pushTel(e.nome, e.waha_numero));
  (data?.reservas || []).forEach((r: any) => pushTel(r.cliente, r.whatsapp));
  (data?.freelancers || []).forEach((f: any) => pushTel(f.nome, f.whatsapp));

  const paisPadrao = '55';

  const extrairDdd = (numLimpo: string): string | null => {
    const d = numLimpo.replace(/\D/g, '');
    if (d.startsWith('55') && d.length >= 12) return d.slice(2, 4);
    if (d.length === 10 || d.length === 11) return d.slice(0, 2);
    return null;
  };

  const dddColaborador = usuarioLogado?.telefone ? extrairDdd(String(usuarioLogado.telefone)) : null;
  const empresaAtiva = (data?.empresas || []).find(
    (e: any) => Number(e.id) === Number(data?.empresaAtivaId || usuarioLogado?.empresas_ids?.[0] || 1)
  );
  const dddEmpresa = empresaAtiva?.waha_numero ? extrairDdd(String(empresaAtiva.waha_numero)) : null;

  const contagemDdds: Record<string, number> = {};
  registrosBanco.forEach((r) => {
    const d = extrairDdd(r.tel);
    if (d) contagemDdds[d] = (contagemDdds[d] || 0) + 1;
  });
  const dddsNoBanco = Object.keys(contagemDdds);
  const dddPredominante =
    dddsNoBanco.sort((a, b) => (contagemDdds[b] || 0) - (contagemDdds[a] || 0))[0] || '91';

  const dddPreferencial = dddColaborador || dddEmpresa || dddPredominante || '91';

  if (digits.length === 8 || digits.length === 9) {
    const sufixo8 = digits.slice(-8);
    const candidatos = registrosBanco.filter((r) => r.tel.endsWith(sufixo8));

    if (candidatos.length > 0) {
      const matchIdeal =
        candidatos.find((c) => extrairDdd(c.tel) === dddPreferencial) || candidatos[0];
      const dddAchado = extrairDdd(matchIdeal.tel) || dddPreferencial;
      const numLocal = matchIdeal.tel.slice(4);
      return {
        numeroCompleto: matchIdeal.tel,
        formatado: `+55 (${dddAchado}) ${numLocal.slice(0, -4)}-${numLocal.slice(-4)}`,
        dddInferido: dddAchado,
        paisInferido: paisPadrao,
        encontradoNoBanco: true,
        nomeEncontrado: matchIdeal.nome,
        explicacao: `Localizado no banco (${matchIdeal.nome}) • +55 e DDD (${dddAchado}) aplicados automaticamente`
      };
    }

    const numCom9 = digits.length === 8 ? `9${digits}` : digits;
    const completo = `${paisPadrao}${dddPreferencial}${numCom9}`;
    return {
      numeroCompleto: completo,
      formatado: `+55 (${dddPreferencial}) ${numCom9.slice(0, -4)}-${numCom9.slice(-4)}`,
      dddInferido: dddPreferencial,
      paisInferido: paisPadrao,
      encontradoNoBanco: false,
      explicacao: `+55 (único país no banco) + DDD (${dddPreferencial}) inferido do colaborador/unidade`
    };
  }

  if (digits.length === 10 || digits.length === 11) {
    const dddDigitado = digits.slice(0, 2);
    const numLocal = digits.slice(2);
    const completo = `${paisPadrao}${digits}`;
    const matchBanco = registrosBanco.find((r) => r.tel.endsWith(digits.slice(-8)) && extrairDdd(r.tel) === dddDigitado);
    return {
      numeroCompleto: completo,
      formatado: `+55 (${dddDigitado}) ${numLocal.slice(0, -4)}-${numLocal.slice(-4)}`,
      dddInferido: dddDigitado,
      paisInferido: paisPadrao,
      encontradoNoBanco: Boolean(matchBanco),
      nomeEncontrado: matchBanco?.nome,
      explicacao: matchBanco
        ? `Localizado no banco (${matchBanco.nome}) • +55 automático`
        : `+55 aplicado automaticamente (único código de país no banco)`
    };
  }

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const dddDigitado = digits.slice(2, 4);
    const numLocal = digits.slice(4);
    const matchBanco = registrosBanco.find((r) => r.tel === digits || r.tel.endsWith(digits.slice(-8)));
    return {
      numeroCompleto: digits,
      formatado: `+55 (${dddDigitado}) ${numLocal.slice(0, -4)}-${numLocal.slice(-4)}`,
      dddInferido: dddDigitado,
      paisInferido: '55',
      encontradoNoBanco: Boolean(matchBanco),
      nomeEncontrado: matchBanco?.nome,
      explicacao: matchBanco ? `Localizado no banco (${matchBanco.nome})` : 'Formato completo +55'
    };
  }

  return {
    numeroCompleto: digits.startsWith('55') ? digits : `55${digits}`,
    formatado: `+55 ${digits}`,
    dddInferido: dddPreferencial,
    paisInferido: '55',
    encontradoNoBanco: false,
    explicacao: `Digite apenas os 8/9 dígitos ou DDD + número (+55 e DDD ${dddPreferencial} automáticos)`
  };
}

export function isSuperAdminUser(user: any): boolean {
  if (!user) return false;
  const id = Number(user.id || 0);
  const nome = String(user.nome || '').toLowerCase().trim();
  const tipo = String(user.tipo || '').toLowerCase().trim();
  if (id === 1 && nome === 'admin master') return true;
  return id === 1 && tipo === 'super admin';
}

export function isGestorEmpresaUser(user: any): boolean {
  if (!user) return false;
  if (isSuperAdminUser(user)) return true;
  const tipo = String(user.tipo || '').toLowerCase().trim();
  const cargo = String(user.cargo || '').toLowerCase().trim();
  const termosGestao = [
    'gerente',
    'gestor',
    'empresário',
    'empresario',
    'administrador',
    'admin',
    'diretor',
    'supervisor',
    'coordenador',
    'líder',
    'lider',
    'autônomo',
    'autonomo',
    'independente'
  ];
  if (termosGestao.some((t) => tipo.includes(t))) return true;
  if (
    termosGestao.some((t) => cargo.includes(t)) ||
    cargo.includes('sóci') ||
    cargo.includes('soci') ||
    cargo.includes('propriet') ||
    cargo.includes('maître') ||
    cargo.includes('maitre')
  ) {
    return true;
  }
  if (
    user.permissoes_json?.total ||
    user.permissoes_json?.gerenciar_subordinados ||
    user.permissoes_json?.mudar_aparencia ||
    user.permissoes_json?.modulos?.equipe?.editar ||
    user.permissoes_json?.modulos?.config?.editar
  ) {
    return true;
  }
  return false;
}

export function podeMudarAparenciaSistema(user: any): boolean {
  if (!user) return false;
  if (isGestorEmpresaUser(user)) return true;
  return Boolean(
    user.permissoes_json?.mudar_aparencia ||
    user.permissoes_json?.modulos?.config?.editar ||
    user.permissoes_json?.config
  );
}

export function getNivelHierarquicoUsuario(user: any): number {
  if (!user) return 0;
  if (isSuperAdminUser(user)) return 100;
  const tipo = String(user.tipo || '').toLowerCase();
  const cargo = String(user.cargo || '').toLowerCase();
  if (
    tipo.includes('empres') ||
    tipo.includes('autônomo') ||
    tipo.includes('autonomo') ||
    tipo.includes('independente') ||
    cargo.includes('sóci') ||
    cargo.includes('soci') ||
    cargo.includes('diretor') ||
    cargo.includes('propriet')
  ) {
    return 80;
  }
  if (
    tipo.includes('gerente') ||
    tipo.includes('gestor') ||
    tipo.includes('admin') ||
    cargo.includes('gerente') ||
    cargo.includes('gestor')
  ) {
    return 60;
  }
  if (
    tipo.includes('supervisor') ||
    tipo.includes('coordenador') ||
    tipo.includes('líder') ||
    cargo.includes('supervisor') ||
    cargo.includes('coordenador') ||
    cargo.includes('chefe') ||
    cargo.includes('sênior')
  ) {
    return 40;
  }
  if (user.permissoes_json?.gerenciar_subordinados) {
    return 50;
  }
  return 10; 
}

export function isSubordinadoDoGestor(
  gestor: any,
  alvo: any,
  empresaAtivaId?: number | null
): boolean {
  if (!gestor || !alvo) return false;
  if (Number(gestor.id) === Number(alvo.id)) return false;
  if (isSuperAdminUser(alvo)) return false;
  if (isSuperAdminUser(gestor)) return true;
  if (!isGestorEmpresaUser(gestor)) return false;

  if (alvo.gestor_id && Number(alvo.gestor_id) === Number(gestor.id)) {
    return true;
  }

  const tipoAlvo = String(alvo.tipo || '').toLowerCase();
  const cargoAlvo = String(alvo.cargo || '').toLowerCase();
  const ehAutonomoSemGestor =
    !alvo.gestor_id &&
    (tipoAlvo.includes('autônomo') ||
      tipoAlvo.includes('autonomo') ||
      tipoAlvo.includes('independente') ||
      tipoAlvo.includes('empres') ||
      cargoAlvo.includes('autônomo') ||
      cargoAlvo.includes('autonomo') ||
      cargoAlvo.includes('propriet'));
  if (ehAutonomoSemGestor) return false;

  const empresasAlvoRaw = Array.isArray(alvo.empresas_ids)
    ? alvo.empresas_ids.map(Number).filter((n: number) => n > 0)
    : alvo.empresa_id && Number(alvo.empresa_id) > 0
    ? [Number(alvo.empresa_id)]
    : [];
  if (empresasAlvoRaw.length === 0 && !alvo.gestor_id) {
    return false;
  }

  const empresasGestor: number[] =
    Array.isArray(gestor.empresas_ids) && gestor.empresas_ids.length > 0
      ? gestor.empresas_ids.map(Number)
      : empresaAtivaId
      ? [Number(empresaAtivaId)]
      : [1];
  const empresasAlvo: number[] = empresasAlvoRaw.length > 0 ? empresasAlvoRaw : [1];

  const mesmaEmpresa = empresasAlvo.some((empId) => empresasGestor.includes(empId));
  if (!mesmaEmpresa) return false;

  const nivelGestor = getNivelHierarquicoUsuario(gestor);
  const nivelAlvo = getNivelHierarquicoUsuario(alvo);
  return nivelGestor > nivelAlvo || tipoAlvo === 'colaborador';
}

export function getUnidadesPermitidasUsuario(data: any, currentUser?: any): any[] {
  const todasUnidades: any[] = Array.isArray(data?.unidades) ? data.unidades : [];
  if (todasUnidades.length === 0) return [];
  if (!currentUser) return todasUnidades.slice(0, 1);
  if (isSuperAdminUser(currentUser)) return todasUnidades;

  const rels: any[] = data?.relacionamentos?.rel_usuario_unidade || [];
  const idsRel = rels
    .filter((r: any) => Number(r.usuario_id) === Number(currentUser.id))
    .map((r: any) => Number(r.unidade_id));

  const idsUser = Array.isArray(currentUser.unidades_ids)
    ? currentUser.unidades_ids.map((id: any) => Number(id))
    : Array.isArray(currentUser.empresas_ids)
    ? currentUser.empresas_ids.map((id: any) => Number(id))
    : [];

  const combinedIds = Array.from(new Set([...idsRel, ...idsUser])).filter((id) => id > 0);
  const permitidas = todasUnidades.filter((u: any) => combinedIds.includes(Number(u.id)));

  if (permitidas.length > 0) return permitidas;
  return todasUnidades.slice(0, 1);
}

export function UnidadesMultiSelectControl({
  unidadesPermitidas,
  selectedUnidadesIds,
  onChangeSelectedIds,
  label = 'Unidades',
  compact = false
}: {
  unidadesPermitidas: any[];
  selectedUnidadesIds: number[];
  onChangeSelectedIds: (ids: number[]) => void;
  label?: string;
  compact?: boolean;
}) {
  if (!Array.isArray(unidadesPermitidas) || unidadesPermitidas.length <= 1) {
    return null;
  }

  const allIds = unidadesPermitidas.map((u) => Number(u.id));
  const effectiveSelected =
    selectedUnidadesIds.length === 0
      ? allIds
      : selectedUnidadesIds.filter((id) => allIds.includes(Number(id)));
  const allChecked = effectiveSelected.length === allIds.length;

  const toggleUnit = (unitId: number) => {
    const exists = effectiveSelected.includes(unitId);
    if (exists) {
      const next = effectiveSelected.filter((id) => id !== unitId);
      onChangeSelectedIds(next.length > 0 ? next : [unitId]);
    } else {
      onChangeSelectedIds([...effectiveSelected, unitId]);
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${
        compact
          ? 'px-2.5 py-1.5 rounded-lg bg-[#0B131B] border border-[#10B981]/30'
          : 'px-3 py-2 rounded-xl bg-[#0B131B] border border-[#10B981]/30'
      }`}
    >
      <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 font-bold flex items-center gap-1">
        <Building2 className="w-3.5 h-3.5 text-[#10B981]" />
        <span>{label}:</span>
      </span>

      <label className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#131B24] hover:bg-[#192430] border border-white/10 text-[11px] text-slate-200 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={() => {
            if (allChecked) {
              onChangeSelectedIds([allIds[0]]);
            } else {
              onChangeSelectedIds(allIds);
            }
          }}
          className="w-3.5 h-3.5 accent-[#10B981] rounded cursor-pointer"
        />
        <span className="font-semibold">Todas ({allIds.length})</span>
      </label>

      {unidadesPermitidas.map((u: any) => {
        const uid = Number(u.id);
        const checked = effectiveSelected.includes(uid);
        return (
          <label
            key={uid}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] cursor-pointer select-none transition-colors ${
              checked
                ? 'bg-[#10B981]/20 border-[#10B981]/50 text-emerald-200 font-semibold'
                : 'bg-[#131B24]/70 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggleUnit(uid)}
              className="w-3.5 h-3.5 accent-[#10B981] rounded cursor-pointer"
            />
            <span>{u.nome}</span>
          </label>
        );
      })}
    </div>
  );
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = String(hex || '#10B981').replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return { r: 16, g: 185, b: 129 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

export function blendCompanyWithUrutau(
  companyHex: string,
  urutauHex = '#10B981',
  ratio = 0.72,
  nightFactorOverride?: number
): {
  effectiveHex: string;
  rgb: { r: number; g: number; b: number };
  sidebarBgTop: string;
  sidebarBgBottom: string;
} {
  const nf = nightFactorOverride !== undefined ? nightFactorOverride : getUrutauNightFactor();
  const circadianHex = getCircadianUrutauHex(nf);
  const upperComp = String(companyHex || '#10B981').toUpperCase();
  const isNaturalUrutauColor =
    upperComp === '#10B981' || upperComp === '#C28448' || upperComp === '#F59E0B';

  const resolvedCompanyHex = isNaturalUrutauColor ? circadianHex : companyHex;
  const resolvedUrutauHex =
    String(urutauHex || '#10B981').toUpperCase() === '#10B981' ||
    String(urutauHex || '').toUpperCase() === '#C28448' ||
    String(urutauHex || '').toUpperCase() === '#F59E0B'
      ? circadianHex
      : urutauHex;

  const compRgb = hexToRgb(resolvedCompanyHex);
  const uruRgb = hexToRgb(resolvedUrutauHex);
  const compHsl = rgbToHsl(compRgb.r, compRgb.g, compRgb.b);
  const uruHsl = rgbToHsl(uruRgb.r, uruRgb.g, uruRgb.b);

  const wComp = Math.max(0, Math.min(1, ratio));
  const wUru = 1 - wComp;

  let hueDiff = uruHsl.h - compHsl.h;
  if (hueDiff > 180) hueDiff -= 360;
  if (hueDiff < -180) hueDiff += 360;

  const huePull = isNaturalUrutauColor
    ? wUru
    : wComp >= 0.35
      ? 0
      : ((0.35 - wComp) / 0.35) * 0.65;
  const blendedHue = (compHsl.h + hueDiff * huePull + 360) % 360;

  const targetSat = isNaturalUrutauColor
    ? compHsl.s * wComp + uruHsl.s * wUru
    : Math.max(compHsl.s, Math.min(94, compHsl.s * (0.85 + wComp * 0.22)));
  const blendedSat = Math.max(68, Math.min(96, targetSat));

  const baseLight = isNaturalUrutauColor
    ? compHsl.l * wComp + uruHsl.l * wUru
    : compHsl.l * (0.78 + wComp * 0.22) + 50 * (1 - (0.78 + wComp * 0.22));
  const blendedLight = Math.max(44, Math.min(60, baseLight));

  const { r, g, b } = hslToRgb(blendedHue, blendedSat, blendedLight);
  const effectiveHex = rgbToHex(r, g, b);

  const sideTopR = Math.round(r * 0.1 + 5);
  const sideTopG = Math.round(g * 0.13 + 14);
  const sideTopB = Math.round(b * 0.11 + 11);

  const sideBotR = Math.round(r * 0.07 + 4);
  const sideBotG = Math.round(g * 0.09 + 10);
  const sideBotB = Math.round(b * 0.07 + 8);

  return {
    effectiveHex,
    rgb: { r, g, b },
    sidebarBgTop: rgbToHex(sideTopR, sideTopG, sideTopB),
    sidebarBgBottom: rgbToHex(sideBotR, sideBotG, sideBotB)
  };
}

export function extractColorsFromLogoImage(
  dataUrl: string
): Promise<{
  dominantHex: string;
  secondaryHex: string;
  tertiaryHex: string;
  highlights: string[];
}> {
  return new Promise((resolve) => {
    const fallback = {
      dominantHex: '#10B981',
      secondaryHex: '#F59E0B',
      tertiaryHex: '#06B6D4',
      highlights: ['#10B981', '#F59E0B', '#06B6D4']
    };
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(fallback);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        const colorDist = (
          c1: { r: number; g: number; b: number },
          c2: { r: number; g: number; b: number }
        ) => Math.hypot(c1.r - c2.r, c1.g - c2.g, c1.b - c2.b);

        const hueDistance = (h1: number, h2: number) => {
          const d = Math.abs(h1 - h2) % 360;
          return d > 180 ? 360 - d : d;
        };

        const normalizeHighlightHex = (r: number, g: number, b: number) => {
          const hsl = rgbToHsl(r, g, b);
          const boostedSat = Math.max(hsl.s, Math.min(95, hsl.s * 1.15 + 8));
          const normalizedLight = Math.max(45, Math.min(62, hsl.l));
          const rgb = hslToRgb(hsl.h, boostedSat, normalizedLight);
          return {
            r: rgb.r,
            g: rgb.g,
            b: rgb.b,
            h: hsl.h,
            s: boostedSat,
            l: normalizedLight,
            hex: rgbToHex(rgb.r, rgb.g, rgb.b)
          };
        };

        const borderBuckets = new Map<
          string,
          { count: number; rSum: number; gSum: number; bSum: number }
        >();
        const globalFillBuckets = new Map<
          string,
          { count: number; rSum: number; gSum: number; bSum: number; edgeSum: number }
        >();

        let totalOpaquePixels = 0;
        const borderMargin = 7;

        const getPixelOffset = (x: number, y: number) => (y * size + x) * 4;

        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const idx = getPixelOffset(x, y);
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            if (a < 110) continue;

            totalOpaquePixels++;

            let edgeDiff = 0;
            let neighbors = 0;
            if (x > 0) {
              const nIdx = getPixelOffset(x - 1, y);
              if (data[nIdx + 3] >= 110) {
                edgeDiff += Math.hypot(r - data[nIdx], g - data[nIdx + 1], b - data[nIdx + 2]);
                neighbors++;
              }
            }
            if (x < size - 1) {
              const nIdx = getPixelOffset(x + 1, y);
              if (data[nIdx + 3] >= 110) {
                edgeDiff += Math.hypot(r - data[nIdx], g - data[nIdx + 1], b - data[nIdx + 2]);
                neighbors++;
              }
            }
            if (y > 0) {
              const nIdx = getPixelOffset(x, y - 1);
              if (data[nIdx + 3] >= 110) {
                edgeDiff += Math.hypot(r - data[nIdx], g - data[nIdx + 1], b - data[nIdx + 2]);
                neighbors++;
              }
            }
            if (y < size - 1) {
              const nIdx = getPixelOffset(x, y + 1);
              if (data[nIdx + 3] >= 110) {
                edgeDiff += Math.hypot(r - data[nIdx], g - data[nIdx + 1], b - data[nIdx + 2]);
                neighbors++;
              }
            }
            const avgEdge = neighbors > 0 ? edgeDiff / neighbors / 441.67 : 0;

            const coarseKey = `${Math.floor(r / 20)}-${Math.floor(g / 20)}-${Math.floor(b / 20)}`;
            const gPrev = globalFillBuckets.get(coarseKey) || {
              count: 0,
              rSum: 0,
              gSum: 0,
              bSum: 0,
              edgeSum: 0
            };
            gPrev.count += 1;
            gPrev.rSum += r;
            gPrev.gSum += g;
            gPrev.bSum += b;
            gPrev.edgeSum += avgEdge;
            globalFillBuckets.set(coarseKey, gPrev);

            const isBorder =
              x < borderMargin ||
              x >= size - borderMargin ||
              y < borderMargin ||
              y >= size - borderMargin;
            if (isBorder) {
              const bPrev = borderBuckets.get(coarseKey) || {
                count: 0,
                rSum: 0,
                gSum: 0,
                bSum: 0
              };
              bPrev.count += 1;
              bPrev.rSum += r;
              bPrev.gSum += g;
              bPrev.bSum += b;
              borderBuckets.set(coarseKey, bPrev);
            }
          }
        }

        if (totalOpaquePixels === 0) {
          resolve(fallback);
          return;
        }

        const backgroundColors: Array<{ r: number; g: number; b: number; share: number }> = [];
        const totalBorderPixels = Array.from(borderBuckets.values()).reduce(
          (acc, item) => acc + item.count,
          0
        );

        if (totalBorderPixels > 0) {
          Array.from(borderBuckets.values())
            .sort((a, b) => b.count - a.count)
            .forEach((b) => {
              const borderShare = b.count / totalBorderPixels;
              if (borderShare >= 0.18) {
                backgroundColors.push({
                  r: b.rSum / b.count,
                  g: b.gSum / b.count,
                  b: b.bSum / b.count,
                  share: borderShare
                });
              }
            });
        }

        Array.from(globalFillBuckets.values())
          .sort((a, b) => b.count - a.count)
          .forEach((g) => {
            const areaShare = g.count / totalOpaquePixels;
            const meanEdge = g.edgeSum / Math.max(1, g.count);
            if (areaShare >= 0.3 && meanEdge < 0.14) {
              backgroundColors.push({
                r: g.rSum / g.count,
                g: g.gSum / g.count,
                b: g.bSum / g.count,
                share: areaShare
              });
            }
          });

        interface HighlightCluster {
          pixelCount: number;
          rPeakSum: number;
          gPeakSum: number;
          bPeakSum: number;
          peakWeightSum: number;
          maxSat: number;
          maxChroma: number;
          edgeSum: number;
          centerWeightSum: number;
          hueRef: number;
        }

        const clusters = new Map<string, HighlightCluster>();

        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const idx = getPixelOffset(x, y);
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            if (a < 120) continue;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const chroma = max - min;
            const lum = (max + min) / 2;

            if (lum > 244 || lum < 16) continue;
            if (chroma < 18) continue;

            const hsl = rgbToHsl(r, g, b);
            const sat = hsl.s / 100;
            if (sat < 0.12) continue;

            let edgeDiff = 0;
            let neighbors = 0;
            if (x > 0) {
              const nIdx = getPixelOffset(x - 1, y);
              if (data[nIdx + 3] >= 110) {
                edgeDiff += Math.hypot(r - data[nIdx], g - data[nIdx + 1], b - data[nIdx + 2]);
                neighbors++;
              }
            }
            if (x < size - 1) {
              const nIdx = getPixelOffset(x + 1, y);
              if (data[nIdx + 3] >= 110) {
                edgeDiff += Math.hypot(r - data[nIdx], g - data[nIdx + 1], b - data[nIdx + 2]);
                neighbors++;
              }
            }
            if (y > 0) {
              const nIdx = getPixelOffset(x, y - 1);
              if (data[nIdx + 3] >= 110) {
                edgeDiff += Math.hypot(r - data[nIdx], g - data[nIdx + 1], b - data[nIdx + 2]);
                neighbors++;
              }
            }
            if (y < size - 1) {
              const nIdx = getPixelOffset(x, y + 1);
              if (data[nIdx + 3] >= 110) {
                edgeDiff += Math.hypot(r - data[nIdx], g - data[nIdx + 1], b - data[nIdx + 2]);
                neighbors++;
              }
            }
            const localEdge = neighbors > 0 ? edgeDiff / neighbors / 441.67 : 0;

            const dx = (x - size / 2) / (size / 2);
            const dy = (y - size / 2) / (size / 2);
            const distFromCenter = Math.hypot(dx, dy);
            const centerWeight = Math.max(0.55, 1.25 - distFromCenter * 0.45);

            const hueBucket = Math.floor(((hsl.h + 7.5) % 360) / 15);
            const lightBucket = Math.floor(hsl.l / 22);
            const clusterKey = `H${hueBucket}-L${lightBucket}`;

            const prev = clusters.get(clusterKey) || {
              pixelCount: 0,
              rPeakSum: 0,
              gPeakSum: 0,
              bPeakSum: 0,
              peakWeightSum: 0,
              maxSat: 0,
              maxChroma: 0,
              edgeSum: 0,
              centerWeightSum: 0,
              hueRef: hsl.h
            };

            const vividWeight = Math.pow(sat, 2.2) * Math.pow(chroma / 255, 1.4) * (1 + localEdge * 1.5);
            prev.pixelCount += 1;
            prev.rPeakSum += r * vividWeight;
            prev.gPeakSum += g * vividWeight;
            prev.bPeakSum += b * vividWeight;
            prev.peakWeightSum += vividWeight;
            prev.maxSat = Math.max(prev.maxSat, sat);
            prev.maxChroma = Math.max(prev.maxChroma, chroma / 255);
            prev.edgeSum += localEdge;
            prev.centerWeightSum += centerWeight;
            clusters.set(clusterKey, prev);
          }
        }

        const scoredCandidates = Array.from(clusters.values())
          .filter((c) => c.pixelCount >= 3 && c.peakWeightSum > 0)
          .map((c) => {
            const rawR = c.rPeakSum / c.peakWeightSum;
            const rawG = c.gPeakSum / c.peakWeightSum;
            const rawB = c.bPeakSum / c.peakWeightSum;
            const rawHsl = rgbToHsl(rawR, rawG, rawB);
            const areaShare = c.pixelCount / totalOpaquePixels;
            const avgEdge = c.edgeSum / c.pixelCount;
            const avgCenter = c.centerWeightSum / c.pixelCount;

            const matchesBackground = backgroundColors.some(
              (bg) => colorDist({ r: rawR, g: rawG, b: rawB }, bg) < 46
            );

            let areaEmphasis = 1.0;
            if (areaShare >= 0.0025 && areaShare <= 0.16) {
              areaEmphasis = 1.65;
            } else if (areaShare > 0.16 && areaShare <= 0.28) {
              areaEmphasis = 1.15;
            } else if (areaShare > 0.28 && areaShare <= 0.42) {
              areaEmphasis = 0.42;
            } else if (areaShare > 0.42) {
              areaEmphasis = 0.12;
            } else {
              areaEmphasis = 0.85;
            }

            const bgMultiplier = matchesBackground ? 0.08 : 1.0;
            const detailFactor = 1 + Math.min(0.95, avgEdge * 2.4);
            const satScore = Math.pow(c.maxSat, 1.75) * (0.6 + c.maxChroma * 0.9);
            const lightBalance =
              rawHsl.l >= 32 && rawHsl.l <= 74
                ? 1.25
                : rawHsl.l >= 22 && rawHsl.l <= 84
                  ? 0.9
                  : 0.55;

            const highlightScore =
              satScore * areaEmphasis * bgMultiplier * detailFactor * avgCenter * lightBalance;

            const norm = normalizeHighlightHex(rawR, rawG, rawB);

            return {
              rawR,
              rawG,
              rawB,
              r: norm.r,
              g: norm.g,
              b: norm.b,
              h: norm.h,
              s: norm.s,
              l: norm.l,
              hex: norm.hex,
              areaShare,
              matchesBackground,
              highlightScore
            };
          })
          .sort((a, b) => b.highlightScore - a.highlightScore);

        if (scoredCandidates.length === 0) {
          resolve(fallback);
          return;
        }

        const distinctHighlights: typeof scoredCandidates = [];
        for (const cand of scoredCandidates) {
          const isDuplicate = distinctHighlights.some(
            (existing) =>
              colorDist(cand, existing) < 44 ||
              (hueDistance(cand.h, existing.h) < 18 && Math.abs(cand.l - existing.l) < 16)
          );
          if (!isDuplicate) {
            distinctHighlights.push(cand);
          }
          if (distinctHighlights.length >= 6) break;
        }

        const primary = distinctHighlights[0] || scoredCandidates[0];
        const domHex = primary.hex;

        const secondary =
          distinctHighlights.find(
            (c, idx) =>
              idx > 0 &&
              !c.matchesBackground &&
              (hueDistance(c.h, primary.h) >= 26 || colorDist(c, primary) >= 64)
          ) ||
          distinctHighlights.find(
            (c, idx) =>
              idx > 0 && (hueDistance(c.h, primary.h) >= 20 || colorDist(c, primary) >= 48)
          ) ||
          distinctHighlights[1];

        const secHex = secondary ? secondary.hex : '#F59E0B';
        const secRef = secondary || {
          r: 245,
          g: 158,
          b: 11,
          h: 38,
          s: 92,
          l: 50,
          hex: '#F59E0B'
        };

        const tertiary =
          distinctHighlights.find(
            (c, idx) =>
              idx > 0 &&
              c.hex !== domHex &&
              c.hex !== secHex &&
              !c.matchesBackground &&
              (hueDistance(c.h, primary.h) >= 22 || colorDist(c, primary) >= 52) &&
              (hueDistance(c.h, secRef.h) >= 22 || colorDist(c, secRef) >= 52)
          ) ||
          distinctHighlights.find((c) => c.hex !== domHex && c.hex !== secHex);

        const tertHex = tertiary ? tertiary.hex : '#06B6D4';

        const highlightHexList = Array.from(
          new Set([
            domHex,
            secHex,
            tertHex,
            ...distinctHighlights.map((c) => c.hex)
          ])
        ).slice(0, 6);

        resolve({
          dominantHex: domHex,
          secondaryHex: secHex,
          tertiaryHex: tertHex,
          highlights: highlightHexList
        });
      } catch {
        resolve(fallback);
      }
    };
    img.onerror = () => resolve(fallback);
    img.src = dataUrl;
  });
}

export interface SystemDialogState {
  open: boolean;
  type: 'info' | 'error' | 'confirm';
  title: string;
  message: string;
  technicalDetails?: string;
  onConfirm?: () => void;
}

export interface UrutauClientErrorLogEntry {
  id: string;
  origem: string;
  titulo: string;
  mensagem: string;
  detalhesTecnicos?: string;
  criadoEm: string;
  title?: string;
  message?: string;
  details?: string;
  source?: string;
  timestamp?: string;
}

export function registerClientErrorLog(entry: {
  title?: string;
  message?: string;
  details?: string;
  source?: string;
  titulo?: string;
  mensagem?: string;
  detalhesTecnicos?: string;
  origem?: string;
}) {
  try {
    const raw = localStorage.getItem('urutau_error_logs_v1');
    const list = raw ? JSON.parse(raw) : [];
    const safeList = Array.isArray(list) ? list : [];
    const finalTitle = entry.titulo || entry.title || 'Erro de Execução';
    const finalMsg = entry.mensagem || entry.message || '';
    const finalDetails = entry.detalhesTecnicos || entry.details || '';
    const finalSource =
      entry.origem ||
      entry.source ||
      (typeof window !== 'undefined' ? window.location.pathname : '') ||
      'Sistema';
    const nowIso = new Date().toISOString();
    const newItem: UrutauClientErrorLogEntry = {
      id: `cli-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      origem: finalSource,
      titulo: finalTitle,
      mensagem: finalMsg,
      detalhesTecnicos: finalDetails,
      criadoEm: nowIso,
      title: finalTitle,
      message: finalMsg,
      details: finalDetails,
      source: finalSource,
      timestamp: nowIso
    };
    const updated = [newItem, ...safeList].slice(0, 120);
    localStorage.setItem('urutau_error_logs_v1', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('urutau:error-logged', { detail: newItem }));
  } catch {}
}

export function UrutauSystemDialog({
  dialog,
  onClose,
  brandConfig
}: {
  dialog: SystemDialogState;
  onClose: () => void;
  brandConfig?: BrandIdentityConfig;
}) {
  const [copied, setCopied] = useState(false);
  const isErrorLike =
    dialog.type === 'error' ||
    /erro|falha|inválid|bloqueio|proibid|negad/i.test(`${dialog.title} ${dialog.message}`);

  useEffect(() => {
    if (dialog.open) {
      if (isErrorLike) {
        registerClientErrorLog({
          title: dialog.title,
          message: dialog.message,
          details: dialog.technicalDetails
        });
      }
      window.dispatchEvent(
        new CustomEvent('urutau-focus-presence', {
          detail: {
            active: true,
            kind: isErrorLike ? 'error' : dialog.type === 'confirm' ? 'confirm' : 'warning',
            title: dialog.title
          }
        })
      );
      return () => {
        window.dispatchEvent(
          new CustomEvent('urutau-focus-presence', {
            detail: { active: false, kind: 'dialog', title: dialog.title }
          })
        );
      };
    }
  }, [dialog.open, dialog.type, dialog.title, dialog.message, dialog.technicalDetails, isErrorLike]);

  if (!dialog.open) return null;

  const handleCopyError = () => {
    const fullText = `[URUTAU — SUPORTE]\nTítulo: ${dialog.title}\nMensagem: ${dialog.message}\nDetalhes: ${dialog.technicalDetails || 'N/A'}\nTimestamp: ${new Date().toISOString()}`;
    navigator.clipboard?.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div
      className="fixed top-0 left-0 w-screen h-[100dvh] z-[120] flex items-center justify-center penumbra-da-mata-backdrop p-4 overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg urutau-gold-turquoise-outer p-4 sm:p-5 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] rounded transition-colors cursor-pointer"
          aria-label="Fechar modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="urutau-gold-turquoise-inner p-5 space-y-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 flex items-center justify-center shrink-0 relative">
              <SystemSlotImage
                slot="dialogos_seguranca"
                brandConfig={brandConfig}
                overrideSource="comunicacao"
                className="w-14 h-14"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#20E3B2]">
                <AlertTriangle className="w-3.5 h-3.5 text-[#F5B041] shrink-0" />
                <span>
                  {isErrorLike
                    ? 'Alerta de Erro • Comunicação Urutau'
                    : dialog.type === 'confirm'
                    ? 'Confirmação de Ação • Urutau Presente'
                    : 'Aviso do Sistema • Comunicação Interna'}
                </span>
              </div>
              <h3 className="text-base font-bold text-[#F8FAFC] tracking-tight truncate">
                {dialog.title}
              </h3>
            </div>
          </div>

          <p className="text-sm text-[#F8FAFC] leading-relaxed">{dialog.message}</p>

          {(isErrorLike || dialog.technicalDetails) && (
            <div className="p-3 bg-[#11151C] border border-rose-500/35 rounded-lg font-mono text-xs text-[#F5B041] break-words">
              {dialog.technicalDetails || dialog.message}
            </div>
          )}

          <div
            className={`pt-3 border-t border-white/10 grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 ${
              isErrorLike || dialog.technicalDetails ? 'sm:justify-between' : 'sm:justify-end'
            }`}
          >
            {(isErrorLike || dialog.technicalDetails) && (
              <div className="col-span-2 sm:col-span-1 grid grid-cols-2 sm:flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyError}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-semibold text-[#F5B041] bg-[#F5B041]/10 hover:bg-[#F5B041]/20 border border-[#F5B041]/40 rounded-lg transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                  <span>{copied ? 'Copiado!' : 'Copiar Erro'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('urutau:open-error-logs'));
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-semibold text-rose-200 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 rounded-lg transition-colors cursor-pointer"
                >
                  <FileSearch className="w-3.5 h-3.5 shrink-0" />
                  <span>Ver Logs de Erros</span>
                </button>
              </div>
            )}

            <div className="col-span-2 sm:col-span-1 flex items-center justify-end gap-2">
              {dialog.type === 'confirm' && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-initial px-4 py-2 min-h-[40px] text-xs font-medium text-[#F8FAFC] pill-status-dark rounded-lg hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (dialog.onConfirm) dialog.onConfirm();
                  onClose();
                }}
                className="flex-1 sm:flex-initial px-5 py-2 min-h-[40px] text-xs rounded-lg btn-turquoise-pill cursor-pointer"
              >
                {dialog.type === 'confirm' ? 'Confirmar' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function FocusFormModal({
  open,
  title,
  onClose,
  onSave,
  onArchive,
  saving = false,
  maxWidthClass = 'max-w-3xl',
  zIndexClass = 'z-[110]',
  children
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSave?: () => void;
  onArchive?: () => void;
  saving?: boolean;
  maxWidthClass?: string;
  zIndexClass?: string;
  children: React.ReactNode;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [focusMascotPostura, setFocusMascotPostura] = useState<UrutauPosturaState>('voando');
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const checkScrollIndicators = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 12);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 12);
  };

  useEffect(() => {
    setConfirmingArchive(false);
    if (open) {
      setTimeout(checkScrollIndicators, 60);
    }
  }, [open, children]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setFocusMascotPostura('voando');
    window.dispatchEvent(
      new CustomEvent('urutau-focus-presence', {
        detail: { active: true, kind: 'focus', title }
      })
    );
    const tLand = setTimeout(() => {
      setFocusMascotPostura('favicon');
    }, 380);
    const blinkInterval = setInterval(() => {
      setFocusMascotPostura('olhos_fechados');
      setTimeout(() => {
        setFocusMascotPostura('favicon');
      }, 260);
    }, 4200);
    return () => {
      document.body.style.overflow = prevOverflow;
      clearTimeout(tLand);
      clearInterval(blinkInterval);
      window.dispatchEvent(
        new CustomEvent('urutau-focus-presence', {
          detail: { active: false, kind: 'focus', title }
        })
      );
    };
  }, [open, title]);

  if (!open) return null;

  const scrollByStep = (delta: number) => {
    scrollContainerRef.current?.scrollBy({ top: delta, behavior: 'smooth' });
  };

  return createPortal(
    <div
      className={`fixed top-0 left-0 w-screen h-[100dvh] ${zIndexClass} flex items-center justify-center penumbra-da-mata-backdrop p-2 sm:p-6 overflow-hidden`}
      role="dialog"
      aria-modal="true"
    >
      
      <div className={`w-full ${maxWidthClass} max-h-[92vh] urutau-gold-turquoise-outer p-2 sm:p-3.5 flex flex-col relative overflow-hidden`}>
        <div className="w-full flex-1 overflow-hidden urutau-gold-turquoise-inner flex flex-col">
          
          <div className="shrink-0 z-30 penumbra-sticky-bar px-3 sm:px-5 py-2.5 sm:py-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 w-full max-w-full">
            <div className="min-w-0 flex-1 flex items-center gap-2.5">
              <div
                className="w-9 h-9 flex items-center justify-center shrink-0 transition-transform duration-300"
                title="Urutau pousado na tela em foco (retorna ao poleiro anterior ao fechar)"
              >
                <UrutauPerch
                  id={`focus-modal-perch-${title}`}
                  pose={saving ? 'blinking' : 'sentinel'}
                  priority={50}
                  size={34}
                />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-[#F8FAFC] truncate">{title}</h2>
            </div>

            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-1.5 sm:gap-2 w-full sm:w-auto min-w-0">
              <div
                className="flex items-center bg-[#061A1C] border border-[#10B981]/35 rounded-full px-2 py-1 gap-1 shrink-0"
                title="Orientação vertical do formulário"
              >
                <button
                  type="button"
                  onClick={() => scrollByStep(-220)}
                  disabled={!canScrollUp}
                  className={`px-1.5 py-0.5 text-xs font-mono rounded-full transition-colors ${
                    canScrollUp
                      ? 'text-[#10B981] bg-[#10B981]/15 hover:bg-[#10B981]/25 cursor-pointer'
                      : 'text-[#94A3B8]/40 cursor-default'
                  }`}
                  aria-label="Rolar para campos superiores"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => scrollByStep(220)}
                  disabled={!canScrollDown}
                  className={`px-1.5 py-0.5 text-xs font-mono rounded-full transition-colors ${
                    canScrollDown
                      ? 'text-[#10B981] bg-[#10B981]/15 hover:bg-[#10B981]/25 cursor-pointer'
                      : 'text-[#94A3B8]/40 cursor-default'
                  }`}
                  aria-label="Rolar para campos inferiores"
                >
                  ▼
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium pill-status-dark hover:text-white rounded-full transition-colors min-w-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Cancelar</span>
              </button>

              {onSave && (
                <div className="relative flex-1 sm:flex-initial inline-flex items-center">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={onSave}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs rounded-full btn-turquoise-pill disabled:opacity-50 min-w-0 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{saving ? 'Salvando...' : 'Salvar'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          
          <div
            ref={scrollContainerRef}
            onScroll={checkScrollIndicators}
            className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto overflow-x-hidden"
          >
            {children}

            {onArchive && (
              <div className="mt-6 pt-4 border-t border-rose-500/25">
                {!confirmingArchive ? (
                  <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-rose-300">
                        Zona de Arquivamento Seguro (Proteção Contra Clique Acidental)
                      </div>
                      <p className="text-[11px] text-slate-400">
                        O registro não é apagado: ele vai para a lista de Arquivados e pode ser restaurado a qualquer momento.
                      </p>
                    </div>
                    <button
                      type="button"
                      data-no-confirm="true"
                      onClick={() => setConfirmingArchive(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 shrink-0 cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Arquivar Este Registro...</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-rose-950/40 border-2 border-rose-500/70 space-y-3">
                    <div className="text-xs font-bold text-rose-200">
                      Confirmação de Segurança: Tem certeza que deseja arquivar "{title}"?
                    </div>
                    <p className="text-[11px] text-rose-200/80">
                      Se você clicou por engano, basta tocar em "Não, Manter Ativo". Caso arquive, você poderá restaurá-lo facilmente no botão "Arquivados / Restaurar".
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        data-no-confirm="true"
                        onClick={() => setConfirmingArchive(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                      >
                        Não, Manter Ativo
                      </button>
                      <button
                        type="button"
                        data-no-confirm="true"
                        onClick={() => {
                          setConfirmingArchive(false);
                          onArchive();
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>Sim, Confirmar Arquivamento</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          
          <div className="shrink-0 z-30 bg-[#061A1C]/95 backdrop-blur-md border-t border-[#10B981]/30 p-3 sm:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-medium pill-status-dark rounded-full flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              <X className="w-4 h-4" />
              <span>Cancelar</span>
            </button>
            {onSave && (
              <button
                type="button"
                disabled={saving}
                onClick={onSave}
                className="flex-1 py-2.5 text-xs rounded-full btn-turquoise-pill disabled:opacity-50 flex items-center justify-center gap-1.5 min-h-[44px]"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Salvando...' : 'Salvar'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function evaluateMathExpression(expr: string): { valid: boolean; value: number } {
  if (!expr || !String(expr).trim()) return { valid: false, value: 0 };
  try {
    let normalized = String(expr)
      .replace(/,/g, '.')
      .replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)');

    if (!/^[0-9+\-*/().\s]+$/.test(normalized)) {
      return { valid: false, value: 0 };
    }
    const result = Function(`"use strict"; return (${normalized});`)();
    if (typeof result === 'number' && Number.isFinite(result)) {
      return { valid: true, value: Number(result.toFixed(2)) };
    }
    return { valid: false, value: 0 };
  } catch {
    return { valid: false, value: 0 };
  }
}

export function TriangularRGBPicker({
  currentHex,
  onSelectColor
}: {
  currentHex: string;
  onSelectColor: (hex: string, rgb: { r: number; g: number; b: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 110, y: 95 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const v1 = { x: width / 2, y: 14 }; 
    const v2 = { x: 18, y: height - 16 }; 
    const v3 = { x: width - 18, y: height - 16 }; 

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const denom = (v2.y - v3.y) * (v1.x - v3.x) + (v3.x - v2.x) * (v1.y - v3.y);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const w1 = ((v2.y - v3.y) * (x - v3.x) + (v3.x - v2.x) * (y - v3.y)) / denom;
        const w2 = ((v3.y - v1.y) * (x - v3.x) + (v1.x - v3.x) * (y - v3.y)) / denom;
        const w3 = 1 - w1 - w2;

        if (w1 >= 0 && w2 >= 0 && w3 >= 0) {
          const idx = (y * width + x) * 4;
          const r = Math.min(255, Math.round(w1 * 245 + w2 * 32 + w3 * 255));
          const g = Math.min(255, Math.round(w1 * 176 + w2 * 227 + w3 * 107));
          const b = Math.min(255, Math.round(w1 * 65 + w2 * 178 + w3 * 87));
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    ctx.beginPath();
    ctx.moveTo(v1.x, v1.y);
    ctx.lineTo(v2.x, v2.y);
    ctx.lineTo(v3.x, v3.y);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(32, 227, 178, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cursorPos.x, cursorPos.y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [cursorPos]);

  const pickAtEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * canvas.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    if (pixel[3] < 128) return;

    setCursorPos({ x, y });
    const r = pixel[0];
    const g = pixel[1];
    const b = pixel[2];
    const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    onSelectColor(hex, { r, g, b });
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <canvas
        ref={canvasRef}
        width={220}
        height={190}
        onClick={pickAtEvent}
        onMouseMove={(e) => {
          if (e.buttons === 1) pickAtEvent(e);
        }}
        className="cursor-crosshair bg-[#11151C] border border-[#20E3B2]/35 rounded-xl p-1"
      />
      
      <div className="space-y-3 text-xs w-full sm:w-auto">
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { label: 'Turquesa', hex: '#10B981', rgb: { r: 16, g: 185, b: 129 }, className: 'bg-[#10B981] border-[#10B981]' },
            { label: 'Ouro Sol', hex: '#F59E0B', rgb: { r: 245, g: 158, b: 11 }, className: 'btn-metallic-gold' },
            { label: 'Urucum', hex: '#F43F5E', rgb: { r: 244, g: 63, b: 94 }, className: 'bg-[#F43F5E] border-[#F43F5E]' },
            { label: 'Açaí', hex: '#8B5CF6', rgb: { r: 139, g: 92, b: 246 }, className: 'bg-[#8B5CF6] border-[#8B5CF6]' }
          ].map((sw) => (
            <button
              key={sw.hex}
              type="button"
              onClick={() => onSelectColor(sw.hex, sw.rgb)}
              className={`h-24 w-14 rounded-xl border transition-transform hover:scale-105 cursor-pointer flex items-end justify-center pb-2 shadow-lg ${sw.className}`}
              title={`${sw.label} (${sw.hex})`}
            >
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/55 text-white">
                {sw.label}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[#94A3B8] font-mono text-xs">
          <span>Cor Ativa:</span>
          <span className="text-[#F8FAFC] font-bold">{currentHex}</span>
        </div>
      </div>
    </div>
  );
}

export const SYSTEM_IMAGE_SLOTS_META: {
  id: SystemImageSlotId;
  label: string;
  descricao: string;
  defaultSource: SystemImageSourceId;
}[] = [
  {
    id: 'topo_painel',
    label: 'Topo do Painel',
    descricao: '',
    defaultSource: 'sentinela'
  },
  {
    id: 'pulso_tempo_real',
    label: 'Tempo Real',
    descricao: '',
    defaultSource: 'sentinela'
  },
  {
    id: 'tela_login',
    label: 'Tela de Login',
    descricao: '',
    defaultSource: 'sentinela'
  },
  {
    id: 'menu_lateral',
    label: 'Menu Lateral',
    descricao: '',
    defaultSource: 'sentinela'
  },
  {
    id: 'dialogos_seguranca',
    label: 'Diálogos e Segurança',
    descricao: '',
    defaultSource: 'comunicacao'
  },
  {
    id: 'favicon_guia',
    label: 'Ícone do Sistema',
    descricao: '',
    defaultSource: 'sentinela'
  }
];

export interface UrutauGaleriaPadraoItem {
  id: string;
  posturaBase: 'sentinela' | 'olhos_fechados' | 'comunicacao' | 'canto';
  familia: 'esmeralda_circular';
  familiaLabel: string;
  nome: string;
  nomeCurto: string;
  resumo: string;
  src: string;
  defaultSlot: SystemImageSlotId;
}

export const URUTAU_GALERIA_PADRAO_ITEMS: UrutauGaleriaPadraoItem[] = [
  {
    id: 'sentinela',
    posturaBase: 'sentinela',
    familia: 'esmeralda_circular',
    familiaLabel: 'Padrão do Sistema',
    nome: 'Padrão (Olhos Abertos)',
    nomeCurto: 'Olhos Abertos',
    resumo: 'Padrão do sistema de olhos abertos e bico fechado.',
    src: urutauPadraoOlhosAbertosImg,
    defaultSlot: 'topo_painel'
  },
  {
    id: 'olhos_fechados',
    posturaBase: 'olhos_fechados',
    familia: 'esmeralda_circular',
    familiaLabel: 'Piscando (Upload / Download)',
    nome: 'Olhos Fechados (Piscando)',
    nomeCurto: 'Olhos Fechados',
    resumo: 'Alterna com olhos abertos durante download, upload e processamento.',
    src: urutauOlhosFechadosImg,
    defaultSlot: 'pulso_tempo_real'
  },
  {
    id: 'comunicacao',
    posturaBase: 'comunicacao',
    familia: 'esmeralda_circular',
    familiaLabel: 'Mensagens e Alertas',
    nome: 'Boca Aberta (Mensagem)',
    nomeCurto: 'Boca Aberta',
    resumo: 'Alterna com o canto em mensagens, alertas e notificações.',
    src: urutauBocaAbertaImg,
    defaultSlot: 'dialogos_seguranca'
  },
  {
    id: 'canto',
    posturaBase: 'canto',
    familia: 'esmeralda_circular',
    familiaLabel: 'Mensagens e Alertas',
    nome: 'Boca Aberta com Canto',
    nomeCurto: 'Boca Aberta Canto',
    resumo: 'Emissão de ondas acústicas alternando com boca aberta nas notificações.',
    src: urutauBocaAbertaCantoImg,
    defaultSlot: 'dialogos_seguranca'
  }
];

export const BUILTIN_BRAND_IMAGES_META: {
  id: UrutauPosturaState;
  label: string;
  resumo: string;
}[] = [
  {
    id: 'sentinela',
    label: 'Olhos Abertos (Padrão)',
    resumo: 'Padrão do sistema com olhos abertos e bico fechado.'
  },
  {
    id: 'olhos_fechados',
    label: 'Olhos Fechados (Piscando)',
    resumo: 'Usado para piscar durante upload, download e processamento.'
  },
  {
    id: 'comunicacao',
    label: 'Boca Aberta',
    resumo: 'Alterna com o canto em mensagens, alertas e notificações.'
  },
  {
    id: 'canto',
    label: 'Boca Aberta com Canto',
    resumo: 'Ondas sonoras alternando em mensagens, alertas e notificações.'
  }
];

export const URUTAU_BOTANICA_POSTURAS: Record<string, string> = {
  camuflagem: urutauOlhosFechadosImg,
  sentinela: urutauPadraoOlhosAbertosImg,
  canto: urutauBocaAbertaCantoImg,
  voando: urutauPadraoOlhosAbertosImg,
  comunicacao: urutauBocaAbertaImg,
  olhos_fechados: urutauOlhosFechadosImg,
  camuflagem_esmeralda_circular: urutauOlhosFechadosImg,
  sentinela_esmeralda_circular: urutauPadraoOlhosAbertosImg,
  canto_esmeralda_circular: urutauBocaAbertaCantoImg,
  voando_esmeralda_circular: urutauPadraoOlhosAbertosImg,
  comunicacao_esmeralda_circular: urutauBocaAbertaImg,
  olhos_fechados_esmeralda_circular: urutauOlhosFechadosImg,
  camuflagem_madeira_circular: urutauOlhosFechadosImg,
  sentinela_madeira_circular: urutauPadraoOlhosAbertosImg,
  canto_madeira_circular: urutauBocaAbertaCantoImg,
  voando_madeira_circular: urutauPadraoOlhosAbertosImg,
  comunicacao_madeira_circular: urutauBocaAbertaImg,
  olhos_fechados_madeira_circular: urutauOlhosFechadosImg,
  favicon: '/favicon.svg',
  vazado: urutauPadraoOlhosAbertosImg,
  totem: urutauOlhosFechadosImg,
  octogono: urutauPadraoOlhosAbertosImg
};

export const SLOT_BOTANICAL_IMAGE_MAP: Record<SystemImageSlotId, string> = {
  topo_painel: urutauPadraoOlhosAbertosImg,
  pulso_tempo_real: urutauPadraoOlhosAbertosImg,
  tela_login: urutauPadraoOlhosAbertosImg,
  menu_lateral: urutauPadraoOlhosAbertosImg,
  dialogos_seguranca: urutauBocaAbertaImg,
  favicon_guia: '/favicon.svg'
};

export function SystemSlotImage({
  slot,
  brandConfig,
  className = 'w-10 h-10',
  ssePulse = false,
  overrideSource,
  perchId,
  perchPriority = 10
}: {
  slot: SystemImageSlotId;
  brandConfig?: BrandIdentityConfig;
  className?: string;
  ssePulse?: boolean;
  overrideSource?: SystemImageSourceId;
  flownAway?: boolean;
  perchId?: string;
  perchPriority?: number;
}) {
  const { nightFactor } = useUrutauNightFactor();
  const { isBlinkClosed } = useUrutauBusyBlink(ssePulse);
  const slotMeta = SYSTEM_IMAGE_SLOTS_META.find((s) => s.id === slot);
  const hasCompanyLogo = Boolean(brandConfig?.logoDataUrl);
  const slotCustom = brandConfig?.slotCustomizations?.[slot];

  if (slotCustom?.choice === 'imagem_especifica' && slotCustom.customDataUrl) {
    return (
      <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
        <img
          src={slotCustom.customDataUrl}
          alt={slotCustom.customFileName || slot}
          referrerPolicy="no-referrer"
          className="w-full h-full max-w-full max-h-full object-contain rounded"
        />
      </div>
    );
  }

  if (slotCustom?.choice === 'logo_principal' && hasCompanyLogo && brandConfig?.logoDataUrl) {
    return (
      <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
        <img
          src={brandConfig.logoDataUrl}
          alt={brandConfig.companyName || 'Logo da Empresa'}
          referrerPolicy="no-referrer"
          className="w-full h-full max-w-full max-h-full object-contain rounded"
        />
      </div>
    );
  }

  const placementForSlot: SystemImageSourceId =
    overrideSource ||
    brandConfig?.imagePlacements?.[slot] ||
    (slot === 'topo_painel' && hasCompanyLogo && !slotCustom
      ? 'logo_empresa'
      : slotMeta?.defaultSource || 'sentinela');

  if (!slotCustom && placementForSlot === 'logo_empresa' && hasCompanyLogo && brandConfig?.logoDataUrl) {
    return (
      <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
        <img
          src={brandConfig.logoDataUrl}
          alt={brandConfig.companyName || 'Logo da Empresa'}
          referrerPolicy="no-referrer"
          className="w-full h-full max-w-full max-h-full object-contain rounded"
        />
      </div>
    );
  }

  const customItem = (brandConfig?.customGallery || []).find((img) => img.id === placementForSlot);
  if (!slotCustom && customItem && customItem.dataUrl) {
    return (
      <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
        <img
          src={customItem.dataUrl}
          alt={customItem.nome}
          referrerPolicy="no-referrer"
          className="w-full h-full max-w-full max-h-full object-contain rounded"
        />
      </div>
    );
  }

  const isAlertSlot =
    slot === 'dialogos_seguranca' ||
    overrideSource === 'comunicacao' ||
    overrideSource === 'canto';

  const isSingingWave = useUrutauAlertSongAlternation(isAlertSlot);

  const activePostura: UrutauPosturaState = (() => {
    if (isAlertSlot) {
      return isSingingWave ? 'canto' : 'comunicacao';
    }
    if (isBlinkClosed) {
      return 'olhos_fechados';
    }
    return 'sentinela';
  })();

  const pair = useTransparentCircadianPair(activePostura);

  if (perchId) {
    return (
      <UrutauPerch
        id={perchId}
        pose={mapPosturaToPose(activePostura)}
        priority={perchPriority}
        size={slot === 'tela_login' ? 44 : 38}
      />
    );
  }

  if (slot === 'favicon_guia') {
    const symbolicSrc = buildSymbolicUrutauFaviconSvgDataUrl(
      activePostura,
      nightFactor,
      brandConfig?.effectivePrimaryHex
    );
    return (
      <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
        <img
          src={symbolicSrc}
          alt="Urutau Favicon Simbólico"
          className="w-full h-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
        />
      </div>
    );
  }

  const fallbackSvgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(ICONES_SVG.urutauOrnamental)}`;

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      <img
        src={pair.greenSrc}
        alt={`Urutau (${activePostura})`}
        onError={(e) => {
          if (e.currentTarget.src !== fallbackSvgDataUrl) {
            e.currentTarget.src = fallbackSvgDataUrl;
          }
        }}
        className="w-full h-full max-w-full max-h-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)]"
      />
    </div>
  );
}

export function UrutauDefaultPosesGallery({
  brandConfig,
  onUpdateBrandConfig,
  compact = false
}: {
  brandConfig: BrandIdentityConfig;
  onUpdateBrandConfig: (next: BrandIdentityConfig) => void;
  compact?: boolean;
}) {
  const [selectedFamily, setSelectedFamily] = useState<
    'todas' | 'madeira_circular' | 'esmeralda_circular'
  >('todas');
  const [zoomedPose, setZoomedPose] = useState<UrutauGaleriaPadraoItem | null>(null);

  const filteredItems = useMemo(() => {
    if (selectedFamily === 'todas') return URUTAU_GALERIA_PADRAO_ITEMS;
    return URUTAU_GALERIA_PADRAO_ITEMS.filter((item) => item.familia === selectedFamily);
  }, [selectedFamily]);

  const handleApplyPoseToSlot = (pose: UrutauGaleriaPadraoItem, slotId: SystemImageSlotId) => {
    onUpdateBrandConfig({
      ...brandConfig,
      imagePlacements: {
        ...(brandConfig.imagePlacements || {}),
        [slotId]: pose.id
      },
      slotCustomizations: {
        ...(brandConfig.slotCustomizations || {}),
        [slotId]: {
          choice: 'passaro'
        }
      }
    });
  };

  const handleApplyFamilyToAllSlots = (
    familia: 'madeira_circular' | 'esmeralda_circular'
  ) => {
    const familyPoses = URUTAU_GALERIA_PADRAO_ITEMS.filter((p) => p.familia === familia);
    const nextPlacements = { ...(brandConfig.imagePlacements || {}) };
    const nextCustoms: Partial<Record<SystemImageSlotId, SlotCustomizationItem>> = {
      ...(brandConfig.slotCustomizations || {})
    };

    familyPoses.forEach((pose) => {
      nextPlacements[pose.defaultSlot] = pose.id;
      nextCustoms[pose.defaultSlot] = { choice: 'passaro' };
    });

    onUpdateBrandConfig({
      ...brandConfig,
      imagePlacements: nextPlacements,
      slotCustomizations: nextCustoms
    });
  };

  return (
    <div className="space-y-3">
      {zoomedPose && (
        <div
          className="fixed inset-0 z-[130] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setZoomedPose(null)}
        >
          <div
            className="bg-[#061A1E] border border-emerald-500/40 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-black text-white">{zoomedPose.nome}</h4>
              </div>
              <button
                type="button"
                onClick={() => setZoomedPose(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full aspect-square p-3 flex items-center justify-center">
              <UrutauEmblemSVG
                postura={zoomedPose.id as UrutauPosturaState}
                disableAutoBlink
                className="w-full h-full"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {SYSTEM_IMAGE_SLOTS_META.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => {
                    handleApplyPoseToSlot(zoomedPose, slot.id);
                    setZoomedPose(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-600 hover:text-slate-950 text-emerald-200 border border-emerald-500/30 text-[11px] font-semibold truncate cursor-pointer transition-colors"
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'todas' as const, label: 'Todas' },
            { id: 'madeira_circular' as const, label: 'Madeira (Dia)' },
            { id: 'esmeralda_circular' as const, label: 'Esmeralda (Noite)' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedFamily(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                selectedFamily === tab.id
                  ? 'bg-emerald-500 text-[#04120C] border-emerald-400 shadow-sm'
                  : 'bg-[#041215] text-slate-300 border-white/10 hover:border-emerald-500/40 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {selectedFamily !== 'todas' && (
          <button
            type="button"
            onClick={() => handleApplyFamilyToAllSlots(selectedFamily)}
            className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/40 text-[11px] font-bold cursor-pointer"
          >
            Aplicar nos 6 locais
          </button>
        )}
      </div>

      <div
        className={`grid gap-2.5 ${
          compact
            ? 'grid-cols-3 sm:grid-cols-6'
            : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6'
        }`}
      >
        {filteredItems.map((pose) => {
          const isActiveInDefaultSlot =
            (brandConfig.slotCustomizations?.[pose.defaultSlot]?.choice || 'passaro') === 'passaro' &&
            (brandConfig.imagePlacements?.[pose.defaultSlot] ||
              SYSTEM_IMAGE_SLOTS_META.find((s) => s.id === pose.defaultSlot)?.defaultSource) === pose.id;

          return (
            <div
              key={pose.id}
              className={`p-2 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
                isActiveInDefaultSlot
                  ? 'bg-[#092622] border-emerald-400 ring-1 ring-emerald-400/50'
                  : 'bg-[#041215] border-white/10 hover:border-emerald-500/40'
              }`}
            >
              <button
                type="button"
                onClick={() => setZoomedPose(pose)}
                className="w-full aspect-square p-1 flex items-center justify-center cursor-pointer group relative"
                title={pose.nome}
              >
                <UrutauEmblemSVG
                  postura={pose.id as UrutauPosturaState}
                  disableAutoBlink
                  className="w-full h-full transition-transform duration-200 group-hover:scale-105"
                />
              </button>

              <div className="space-y-1">
                <div className="text-[10px] font-bold text-white leading-tight truncate" title={pose.nome}>
                  {pose.nomeCurto}
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyPoseToSlot(pose, pose.defaultSlot)}
                  className={`w-full py-1 px-1.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                    isActiveInDefaultSlot
                      ? 'bg-emerald-500 text-[#04120C]'
                      : 'bg-emerald-950/80 hover:bg-emerald-600 hover:text-white text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {isActiveInDefaultSlot ? 'Ativa' : 'Usar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function UrutauSlotImageManager({
  brandConfig,
  onUpdateBrandConfig,
  theme = 'dark'
}: {
  brandConfig: BrandIdentityConfig;
  onUpdateBrandConfig: (next: BrandIdentityConfig) => void;
  theme?: 'dark' | 'emerald';
}) {
  const hasCompanyLogo = Boolean(brandConfig?.logoDataUrl);
  const slotCustoms = brandConfig?.slotCustomizations || {};
  const tempGallery = brandConfig?.customGallery || [];
  const galleryUploadInputRef = useRef<HTMLInputElement | null>(null);
  const gallerySectionRef = useRef<HTMLDivElement | null>(null);

  const [activeSlotForGallery, setActiveSlotForGallery] = useState<SystemImageSlotId>('topo_painel');
  const [galleryOpenForSlot, setGalleryOpenForSlot] = useState<SystemImageSlotId | null>(null);
  const [poseFamilyFilter, setPoseFamilyFilter] = useState<
    'todas' | 'madeira_circular' | 'esmeralda_circular'
  >('todas');

  const filteredDefaultPoses = useMemo(() => {
    if (poseFamilyFilter === 'todas') return URUTAU_GALERIA_PADRAO_ITEMS;
    return URUTAU_GALERIA_PADRAO_ITEMS.filter((p) => p.familia === poseFamilyFilter);
  }, [poseFamilyFilter]);

  const targetSlotId: SystemImageSlotId = galleryOpenForSlot || activeSlotForGallery || 'topo_painel';
  const targetSlotMeta =
    SYSTEM_IMAGE_SLOTS_META.find((s) => s.id === targetSlotId) || SYSTEM_IMAGE_SLOTS_META[0];

  const handleSetSlotDefault = (slotId: SystemImageSlotId) => {
    const meta = SYSTEM_IMAGE_SLOTS_META.find((s) => s.id === slotId);
    const defaultPose = meta?.defaultSource || 'sentinela';
    onUpdateBrandConfig({
      ...brandConfig,
      imagePlacements: {
        ...(brandConfig.imagePlacements || {}),
        [slotId]: defaultPose
      },
      slotCustomizations: {
        ...slotCustoms,
        [slotId]: {
          choice: 'passaro'
        }
      }
    });
  };

  const handleOpenGalleryForSlot = (slotId: SystemImageSlotId) => {
    setActiveSlotForGallery(slotId);
    setGalleryOpenForSlot(slotId);
  };

  useEffect(() => {
    const handleExternalOpen = (ev: Event) => {
      const customEv = ev as CustomEvent<{ slotId?: SystemImageSlotId }>;
      const requestedSlot = customEv.detail?.slotId || activeSlotForGallery || 'topo_painel';
      setActiveSlotForGallery(requestedSlot);
      setGalleryOpenForSlot(requestedSlot);
    };
    window.addEventListener('urutau:open-gallery-modal', handleExternalOpen);
    return () => {
      window.removeEventListener('urutau:open-gallery-modal', handleExternalOpen);
    };
  }, [activeSlotForGallery]);

  const handleSelectDefaultPoseForSlot = (
    slotId: SystemImageSlotId,
    pose: UrutauGaleriaPadraoItem
  ) => {
    onUpdateBrandConfig({
      ...brandConfig,
      imagePlacements: {
        ...(brandConfig.imagePlacements || {}),
        [slotId]: pose.id
      },
      slotCustomizations: {
        ...slotCustoms,
        [slotId]: {
          choice: 'passaro'
        }
      }
    });
    setGalleryOpenForSlot(null);
  };

  const handleSelectCompanyLogoForSlot = (slotId: SystemImageSlotId) => {
    if (!brandConfig.logoDataUrl) return;
    onUpdateBrandConfig({
      ...brandConfig,
      imagePlacements: {
        ...(brandConfig.imagePlacements || {}),
        [slotId]: 'logo_empresa'
      },
      slotCustomizations: {
        ...slotCustoms,
        [slotId]: {
          choice: 'logo_principal'
        }
      }
    });
    setGalleryOpenForSlot(null);
  };

  const handleSelectFromGallery = (
    slotId: SystemImageSlotId,
    galleryItem: { id: string; nome: string; dataUrl: string }
  ) => {
    const nextSlotCustoms = {
      ...slotCustoms,
      [slotId]: {
        choice: 'imagem_especifica' as const,
        customDataUrl: galleryItem.dataUrl,
        customFileName: galleryItem.nome
      }
    };
    onUpdateBrandConfig({
      ...brandConfig,
      slotCustomizations: nextSlotCustoms
    });
    setGalleryOpenForSlot(null);
  };

  const handleUploadToGallery = (files: FileList | null, applyToSlotId?: SystemImageSlotId) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const newItems: { id: string; nome: string; dataUrl: string }[] = [];
    let processed = 0;

    fileArray.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const cleanName = file.name.replace(/\.[^/.]+$/, '').slice(0, 28) || `Foto ${idx + 1}`;
        if (!tempGallery.some((g) => g.dataUrl === dataUrl)) {
          newItems.push({
            id: `temp_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            nome: cleanName,
            dataUrl
          });
        }
        processed += 1;
        if (processed === fileArray.length) {
          const nextGallery = [...newItems, ...tempGallery];
          const firstUploaded = newItems[0] || nextGallery[0];
          const slotToApply = applyToSlotId || targetSlotId;
          const nextSlotCustoms =
            firstUploaded && slotToApply
              ? {
                  ...slotCustoms,
                  [slotToApply]: {
                    choice: 'imagem_especifica' as const,
                    customDataUrl: firstUploaded.dataUrl,
                    customFileName: firstUploaded.nome
                  }
                }
              : slotCustoms;

          onUpdateBrandConfig({
            ...brandConfig,
            customGallery: nextGallery,
            slotCustomizations: nextSlotCustoms
          });
          setGalleryOpenForSlot(null);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveGalleryItem = (itemId: string, itemDataUrl: string) => {
    const nextGallery = tempGallery.filter((g) => g.id !== itemId);
    const nextSlotCustoms = { ...slotCustoms };
    (Object.keys(nextSlotCustoms) as SystemImageSlotId[]).forEach((slotKey) => {
      if (nextSlotCustoms[slotKey]?.customDataUrl === itemDataUrl) {
        nextSlotCustoms[slotKey] = { choice: 'passaro' };
      }
    });
    onUpdateBrandConfig({
      ...brandConfig,
      customGallery: nextGallery,
      slotCustomizations: nextSlotCustoms
    });
  };

  const handleSetAllToBird = () => {
    const next: Partial<Record<SystemImageSlotId, SlotCustomizationItem>> = {};
    const nextPlacements = { ...(brandConfig.imagePlacements || {}) };
    SYSTEM_IMAGE_SLOTS_META.forEach((s) => {
      next[s.id] = { choice: 'passaro' };
      nextPlacements[s.id] = s.defaultSource;
    });
    onUpdateBrandConfig({
      ...brandConfig,
      imagePlacements: nextPlacements,
      slotCustomizations: next
    });
  };

  const isEmerald = theme === 'emerald';
  const cardBg = isEmerald ? 'bg-[#041215] border-white/10' : 'bg-[#131B24] border-white/10';
  const innerBg = isEmerald ? 'bg-[#072418]' : 'bg-[#08150F]';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-slate-300 font-medium">
          Locais do Sistema
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSetAllToBird}
            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/30 cursor-pointer"
          >
            Todos no Padrão
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {SYSTEM_IMAGE_SLOTS_META.map((slotMeta) => {
          const custom = slotCustoms[slotMeta.id];
          const currentChoice: SlotDisplayChoice = custom?.choice
            ? custom.choice
            : slotMeta.id === 'topo_painel' && hasCompanyLogo
            ? 'logo_principal'
            : 'passaro';

          const activePoseKey =
            brandConfig?.imagePlacements?.[slotMeta.id] || slotMeta.defaultSource;
          const isDefaultState =
            currentChoice === 'passaro' && activePoseKey === slotMeta.defaultSource;
          const isSelectingThisSlot = galleryOpenForSlot === slotMeta.id;

          return (
            <div
              key={slotMeta.id}
              onClick={() => handleOpenGalleryForSlot(slotMeta.id)}
              className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2.5 transition-all cursor-pointer ${cardBg} ${
                isSelectingThisSlot
                  ? 'ring-2 ring-emerald-400/70 border-emerald-400/60'
                  : 'hover:border-white/25'
              }`}
            >
              <div className="flex flex-col items-center text-center gap-1.5">
                <div className="w-14 h-14 flex items-center justify-center shrink-0 p-0.5">
                  <SystemSlotImage
                    slot={slotMeta.id}
                    brandConfig={brandConfig}
                    className="w-full h-full"
                  />
                </div>
                <div className="w-full min-w-0">
                  <div className="text-[11px] font-bold text-slate-100 truncate">
                    {slotMeta.label}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1 pt-1.5 border-t border-white/10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetSlotDefault(slotMeta.id);
                  }}
                  className={`px-1.5 py-1 rounded text-[10px] font-medium text-center transition-all cursor-pointer ${
                    isDefaultState
                      ? 'bg-emerald-600 text-white font-bold shadow-sm'
                      : 'bg-black/40 text-slate-300 hover:bg-black/60 hover:text-white'
                  }`}
                >
                  Padrão
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenGalleryForSlot(slotMeta.id);
                  }}
                  className={`px-1.5 py-1 rounded text-[10px] font-medium text-center transition-all cursor-pointer ${
                    !isDefaultState || galleryOpenForSlot === slotMeta.id
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-black/40 text-slate-300 hover:bg-black/60 hover:text-white'
                  }`}
                >
                  Outra foto
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {galleryOpenForSlot !== null && (
        <div
          className="fixed inset-0 z-[140] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setGalleryOpenForSlot(null)}
        >
          <div
            ref={gallerySectionRef}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[88vh] overflow-y-auto p-4 sm:p-5 rounded-2xl bg-[#061A1E] border border-emerald-500/40 shadow-2xl space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-white">Galeria</span>
                <span className="text-xs text-emerald-300 font-medium">
                  Aplicando em: <strong className="text-amber-300">{targetSlotMeta.label}</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setGalleryOpenForSlot(null)}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 cursor-pointer transition-colors"
              >
                Fechar
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {SYSTEM_IMAGE_SLOTS_META.map((slotMeta) => {
                const isTarget = targetSlotId === slotMeta.id;
                return (
                  <button
                    key={slotMeta.id}
                    type="button"
                    onClick={() => {
                      setActiveSlotForGallery(slotMeta.id);
                      setGalleryOpenForSlot(slotMeta.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      isTarget
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                        : 'bg-[#041215] text-slate-300 border-white/10 hover:border-white/30'
                    }`}
                  >
                    {slotMeta.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <label className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Enviar Foto</span>
                <input
                  ref={galleryUploadInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleUploadToGallery(e.target.files, targetSlotId);
                    e.target.value = '';
                  }}
                />
              </label>

              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'todas' as const, label: 'Todas' },
                  { id: 'madeira_circular' as const, label: 'Madeira (Dia)' },
                  { id: 'esmeralda_circular' as const, label: 'Esmeralda (Noite)' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setPoseFamilyFilter(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono cursor-pointer border transition-colors ${
                      poseFamilyFilter === f.id
                        ? 'bg-emerald-500 text-[#04120C] font-bold border-emerald-400'
                        : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/60'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-1">
              {hasCompanyLogo && brandConfig.logoDataUrl && (
                <button
                  type="button"
                  onClick={() => handleSelectCompanyLogoForSlot(targetSlotId)}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    (slotCustoms[targetSlotId]?.choice ||
                      (targetSlotId === 'topo_painel' ? 'logo_principal' : 'passaro')) ===
                    'logo_principal'
                      ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400/60'
                      : 'bg-[#071812] border-amber-500/30 hover:border-amber-400'
                  }`}
                  title="Logo da Empresa"
                >
                  <div className="w-full aspect-square rounded-lg bg-black/40 border border-white/10 p-1.5 flex items-center justify-center overflow-hidden">
                    <img
                      src={brandConfig.logoDataUrl}
                      alt="Logo da Empresa"
                      className="w-full h-full object-contain rounded"
                    />
                  </div>
                  <span className="text-[11px] font-bold text-amber-300 truncate w-full text-center">
                    Logo
                  </span>
                </button>
              )}

              {tempGallery.map((gItem) => {
                const isSelectedGalleryImg =
                  slotCustoms[targetSlotId]?.choice === 'imagem_especifica' &&
                  slotCustoms[targetSlotId]?.customDataUrl === gItem.dataUrl;
                return (
                  <div
                    key={gItem.id}
                    onClick={() => handleSelectFromGallery(targetSlotId, gItem)}
                    className={`relative group p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      isSelectedGalleryImg
                        ? 'bg-cyan-500/20 border-cyan-400 ring-1 ring-cyan-400/60'
                        : 'bg-[#071812] border-cyan-500/30 hover:border-cyan-400'
                    }`}
                    title={gItem.nome}
                  >
                    <div className="w-full aspect-square rounded-lg bg-black/40 border border-white/10 p-1.5 flex items-center justify-center overflow-hidden">
                      <img
                        src={gItem.dataUrl}
                        alt={gItem.nome}
                        className="w-full h-full object-contain rounded"
                      />
                    </div>
                    <span className="text-[11px] font-bold text-cyan-200 truncate w-full text-center">
                      {gItem.nome}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveGalleryItem(gItem.id, gItem.dataUrl);
                      }}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Remover"
                    >
                      x
                    </button>
                  </div>
                );
              })}

              {filteredDefaultPoses.map((pose) => {
                const currentSlotCustom = slotCustoms[targetSlotId];
                const currentSlotChoice: SlotDisplayChoice = currentSlotCustom?.choice
                  ? currentSlotCustom.choice
                  : targetSlotId === 'topo_painel' && hasCompanyLogo
                  ? 'logo_principal'
                  : 'passaro';
                const activePoseKey =
                  brandConfig?.imagePlacements?.[targetSlotId] || targetSlotMeta.defaultSource;
                const isSelectedPose =
                  currentSlotChoice === 'passaro' && activePoseKey === pose.id;

                return (
                  <button
                    key={pose.id}
                    type="button"
                    onClick={() => handleSelectDefaultPoseForSlot(targetSlotId, pose)}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      isSelectedPose
                        ? 'bg-emerald-500/20 border-emerald-400 ring-1 ring-emerald-400/60'
                        : 'bg-[#041215] border-white/10 hover:border-emerald-500/40'
                    }`}
                    title={pose.nome}
                  >
                    <div className="w-full aspect-square p-1 flex items-center justify-center">
                      <UrutauEmblemSVG
                        postura={pose.id as UrutauPosturaState}
                        disableAutoBlink
                        className="w-full h-full"
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-200 truncate w-full text-center">
                      {pose.nomeCurto}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const TAB_COMPANION_POSTURA_MAP: Record<
  string,
  { postura: UrutauPosturaState; tituloPosicao: string; fraseCompanheiro: string }
> = {
  rateio: { postura: 'sentinela', tituloPosicao: 'Rateio', fraseCompanheiro: '' },
  escalas: { postura: 'sentinela', tituloPosicao: 'Escalas', fraseCompanheiro: '' },
  agenda: { postura: 'canto', tituloPosicao: 'Agenda', fraseCompanheiro: '' },
  reservas: { postura: 'sentinela', tituloPosicao: 'Reservas', fraseCompanheiro: '' },
  portais: { postura: 'olhos_fechados', tituloPosicao: 'Portais', fraseCompanheiro: '' },
  chat: { postura: 'canto', tituloPosicao: 'WhatsApp', fraseCompanheiro: '' },
  caixa: { postura: 'sentinela', tituloPosicao: 'Caixa', fraseCompanheiro: '' },
  estoque: { postura: 'sentinela', tituloPosicao: 'Estoque', fraseCompanheiro: '' },
  compras: { postura: 'sentinela', tituloPosicao: 'Compras', fraseCompanheiro: '' },
  cmv: { postura: 'camuflagem', tituloPosicao: 'CMV', fraseCompanheiro: '' },
  cadastros: { postura: 'sentinela', tituloPosicao: 'Cadastros', fraseCompanheiro: '' },
  cargos: { postura: 'sentinela', tituloPosicao: 'Cargos', fraseCompanheiro: '' },
  equipe: { postura: 'sentinela', tituloPosicao: 'Equipe', fraseCompanheiro: '' },
  rh: { postura: 'sentinela', tituloPosicao: 'RH', fraseCompanheiro: '' },
  selecao: { postura: 'sentinela', tituloPosicao: 'Seleção', fraseCompanheiro: '' },
  unidades: { postura: 'sentinela', tituloPosicao: 'Unidades', fraseCompanheiro: '' },
  setores: { postura: 'sentinela', tituloPosicao: 'Setores', fraseCompanheiro: '' },
  checklists: { postura: 'sentinela', tituloPosicao: 'Checklists', fraseCompanheiro: '' },
  modulos: { postura: 'sentinela', tituloPosicao: 'Módulos', fraseCompanheiro: '' },
  notificacoes: { postura: 'canto', tituloPosicao: 'Alertas', fraseCompanheiro: '' },
  auditoria: { postura: 'camuflagem', tituloPosicao: 'Logs', fraseCompanheiro: '' },
  permissoes: { postura: 'camuflagem', tituloPosicao: 'Permissões', fraseCompanheiro: '' },
  config: { postura: 'sentinela', tituloPosicao: 'Marca', fraseCompanheiro: '' },
  servidor_ia: { postura: 'olhos_fechados', tituloPosicao: 'Servidor', fraseCompanheiro: '' }
};

export function UrutauScreenCompanionPerch({
  activeTab
}: {
  activeTab: TabId;
  lastActionLabel?: string;
  actionPulseCount?: number;
  brandConfig?: BrandIdentityConfig;
  onOpenAppearanceGallery?: () => void;
  onTriggerCompanionFlight?: () => void;
}) {
  const info = TAB_COMPANION_POSTURA_MAP[activeTab] || {
    postura: 'sentinela' as UrutauPosturaState,
    tituloPosicao: 'Painel',
    fraseCompanheiro: ''
  };

  const { anomalyCount, scrollToNextAnomaly } = useUrutau();
  const defaultTabPose = mapPosturaToPose(info.postura);

  return (
    <div className="sr-only" aria-hidden="true">
      <UrutauPerch
        id={`screen-perch-${activeTab}`}
        pose={defaultTabPose}
        priority={20}
        size={1}
      />
      {anomalyCount > 0 && (
        <button type="button" onClick={scrollToNextAnomaly}>
          {anomalyCount}
        </button>
      )}
    </div>
  );
}

export function UrutauUnusedGallerySection({
  brandConfig,
  onUpdateBrandConfig
}: {
  brandConfig: BrandIdentityConfig;
  onUpdateBrandConfig: (next: BrandIdentityConfig) => void;
}) {
  const [filterMode, setFilterMode] = useState<'nao_usadas' | 'todas'>('nao_usadas');
  const [pendingGalleryConfirm, setPendingGalleryConfirm] = useState<{
    titulo: string;
    descricao: string;
    tipo: 'salvar' | 'excluir' | 'redefinir';
    execute: () => void;
  } | null>(null);

  const placements = brandConfig.imagePlacements || {};
  const activeMapBySource = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    SYSTEM_IMAGE_SLOTS_META.forEach((slot) => {
      const src =
        placements[slot.id] ||
        (slot.id === 'topo_painel' && brandConfig.logoDataUrl ? 'logo_empresa' : slot.defaultSource);
      if (!map[src]) map[src] = [];
      map[src].push(slot.label);
    });
    return map;
  }, [placements, brandConfig.logoDataUrl]);

  const handleMultiPhotoGalleryUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const loadedItems: { id: string; nome: string; dataUrl: string }[] = [];
    let processed = 0;

    fileArray.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const cleanName =
          file.name.replace(/\.[^/.]+$/, '').slice(0, 28) || `Foto ${idx + 1}`;
        loadedItems.push({
          id: `custom_${Date.now()}_${idx}`,
          nome: cleanName,
          dataUrl
        });
        processed += 1;
        if (processed === fileArray.length) {
          setPendingGalleryConfirm({
            titulo: 'Salvar Fotos',
            descricao: `Salvar ${loadedItems.length} imagem(ns) na galeria?`,
            tipo: 'salvar',
            execute: () => {
              onUpdateBrandConfig({
                ...brandConfig,
                customGallery: [...(brandConfig.customGallery || []), ...loadedItems]
              });
              playUrutauSystemSound('salvamento', brandConfig);
            }
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const assignToSlot = (sourceId: SystemImageSourceId, slotId: SystemImageSlotId) => {
    const slotMeta = SYSTEM_IMAGE_SLOTS_META.find((s) => s.id === slotId);
    setPendingGalleryConfirm({
      titulo: 'Alterar Imagem',
      descricao: `Aplicar em "${slotMeta?.label || slotId}"?`,
      tipo: 'salvar',
      execute: () => {
        const isCompanyLogo = sourceId === 'logo_empresa';
        const isCustom = String(sourceId).startsWith('custom_');
        const customItem = (brandConfig.customGallery || []).find((x) => x.id === sourceId);
        onUpdateBrandConfig({
          ...brandConfig,
          imagePlacements: {
            ...(brandConfig.imagePlacements || {}),
            [slotId]: sourceId
          },
          slotCustomizations: {
            ...(brandConfig.slotCustomizations || {}),
            [slotId]: isCompanyLogo
              ? { choice: 'logo_principal' }
              : isCustom && customItem
              ? { choice: 'imagem_especifica', customDataUrl: customItem.dataUrl, customFileName: customItem.nome }
              : { choice: 'passaro' }
          }
        });
        playUrutauSystemSound('salvamento', brandConfig);
      }
    });
  };

  const removeCustomPhoto = (id: string) => {
    const itemObj = (brandConfig.customGallery || []).find((x) => x.id === id);
    setPendingGalleryConfirm({
      titulo: 'Excluir Foto',
      descricao: `Excluir "${itemObj?.nome || id}" da galeria?`,
      tipo: 'excluir',
      execute: () => {
        const nextPlacements = { ...(brandConfig.imagePlacements || {}) };
        (Object.keys(nextPlacements) as SystemImageSlotId[]).forEach((k) => {
          if (nextPlacements[k] === id) {
            delete nextPlacements[k];
          }
        });
        onUpdateBrandConfig({
          ...brandConfig,
          customGallery: (brandConfig.customGallery || []).filter((x) => x.id !== id),
          imagePlacements: nextPlacements
        });
        playUrutauSystemSound('erro', brandConfig);
      }
    });
  };

  const allItems = React.useMemo(() => {
    const list: {
      id: SystemImageSourceId;
      nome: string;
      resumo: string;
      isCustom: boolean;
      dataUrl?: string;
      postura?: UrutauPosturaState;
      usedInSlots: string[];
    }[] = [];

    URUTAU_GALERIA_PADRAO_ITEMS.forEach((b) => {
      list.push({
        id: b.id,
        nome: b.nome,
        resumo: b.familiaLabel,
        isCustom: false,
        postura: b.id as UrutauPosturaState,
        usedInSlots: activeMapBySource[b.id] || []
      });
    });

    if (brandConfig.logoDataUrl) {
      list.push({
        id: 'logo_empresa',
        nome: 'Minha logo.',
        resumo: '',
        isCustom: true,
        dataUrl: brandConfig.logoDataUrl,
        usedInSlots: activeMapBySource['logo_empresa'] || []
      });
    }

    (brandConfig.customGallery || []).forEach((c) => {
      list.push({
        id: c.id,
        nome: c.nome,
        resumo: '',
        isCustom: true,
        dataUrl: c.dataUrl,
        usedInSlots: activeMapBySource[c.id] || []
      });
    });

    return list;
  }, [activeMapBySource, brandConfig.logoDataUrl, brandConfig.customGallery]);

  const visibleItems =
    filterMode === 'nao_usadas'
      ? allItems.filter((it) => it.usedInSlots.length === 0)
      : allItems;

  const unusedCount = allItems.filter((it) => it.usedInSlots.length === 0).length;

  return (
    <div className="bg-[#0C1117] border border-white/10 rounded-xl p-4 sm:p-5 space-y-4">
      {pendingGalleryConfirm && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#091410] border border-[#10B981]/50 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 flex items-center justify-center shrink-0">
                <SystemSlotImage
                  slot="dialogos_seguranca"
                  brandConfig={brandConfig}
                  overrideSource="comunicacao"
                  className="w-11 h-11"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-white">{pendingGalleryConfirm.titulo}</h4>
                <p className="text-xs text-slate-300 mt-1">{pendingGalleryConfirm.descricao}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                data-no-confirm="true"
                onClick={() => setPendingGalleryConfirm(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-no-confirm="true"
                onClick={() => {
                  const fn = pendingGalleryConfirm.execute;
                  setPendingGalleryConfirm(null);
                  fn();
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                  pendingGalleryConfirm.tipo === 'excluir'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-[#10B981] hover:bg-emerald-400 text-[#05100C]'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-white">Galeria de Imagens</h3>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-[#131B24] p-0.5 border border-white/10">
            <button
              type="button"
              onClick={() => setFilterMode('nao_usadas')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                filterMode === 'nao_usadas'
                  ? 'bg-[#10B981] text-[#05100C] font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Guardadas ({unusedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('todas')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                filterMode === 'todas'
                  ? 'bg-[#10B981] text-[#05100C] font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Todas ({allItems.length})
            </button>
          </div>

          <label className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow">
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Fotos</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleMultiPhotoGalleryUpload(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <div className="p-6 rounded-xl bg-[#131B24] border border-dashed border-slate-700 text-center">
          <div className="text-xs text-slate-300 font-semibold">
            Todas as imagens estão em uso.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {visibleItems.map((item) => {
            const isUnused = item.usedInSlots.length === 0;
            return (
              <div
                key={item.id}
                className={`p-3 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                  isUnused
                    ? 'bg-[#131B24] border-amber-500/30 hover:border-amber-400'
                    : 'bg-[#0F1720] border-[#10B981]/35'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 flex items-center justify-center shrink-0 p-0.5">
                    {item.dataUrl ? (
                      <img
                        src={item.dataUrl}
                        alt={item.nome}
                        className="w-full h-full object-contain rounded"
                      />
                    ) : (
                      <UrutauEmblemSVG
                        className="w-full h-full"
                        postura={item.postura || 'vazado'}
                        disableAutoBlink
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                          isUnused
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {isUnused ? 'Guardada' : `Em uso (${item.usedInSlots.length})`}
                      </span>
                      {item.isCustom && item.id !== 'logo_empresa' && (
                        <button
                          type="button"
                          onClick={() => removeCustomPhoto(item.id)}
                          className="text-rose-400 hover:text-rose-300 text-xs cursor-pointer"
                          title="Excluir"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-100 truncate mt-1">
                      {item.nome}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center gap-1.5">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      assignToSlot(item.id, e.target.value as SystemImageSlotId);
                      e.target.value = '';
                    }}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#080D12] border border-slate-700 text-[11px] text-slate-200 cursor-pointer"
                  >
                    <option value="">Usar em...</option>
                    {SYSTEM_IMAGE_SLOTS_META.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface DateMultiViewCriterion {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  multiSelect?: boolean;
  selectedValues?: string[];
  onMultiChange?: (vals: string[]) => void;
}

export interface UrutauDateMultiViewProps<T = any> {
  title: string;
  items: T[];
  getDateISO: (item: T) => string;
  getTitle: (item: T) => string;
  getSubtitle?: (item: T) => string;
  getBadge?: (item: T) => { text: string; colorClass?: string };
  getRightMeta?: (item: T) => string;
  onEditItem: (item: T) => void;
  onCreateAtDate?: (dateISO: string) => void;
  createButtonLabel?: string;
  criteriaFilters?: DateMultiViewCriterion[];
  defaultView?: 'calendario_mes' | 'kanban_semana' | 'lista';
  initialDateISO?: string;
  onSelectedDateChange?: (dateISO: string) => void;
  emptyListMessage?: string;
}

const DIAS_SEMANA_EXPLORER = [
  { idx: 0, curto: 'Dom', longo: 'Domingo' },
  { idx: 1, curto: 'Seg', longo: 'Segunda' },
  { idx: 2, curto: 'Ter', longo: 'Terça' },
  { idx: 3, curto: 'Qua', longo: 'Quarta' },
  { idx: 4, curto: 'Qui', longo: 'Quinta' },
  { idx: 5, curto: 'Sex', longo: 'Sexta' },
  { idx: 6, curto: 'Sáb', longo: 'Sábado' }
];

const MESES_NOMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
];

function parseISODateSafe(iso: string): Date {
  const clean = String(iso || '').split('T')[0];
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0);
}

function toISODateString(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateBR(iso: string): string {
  const clean = String(iso || '').split('T')[0];
  const parts = clean.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function UrutauDateMultiView<T = any>({
  title,
  items,
  getDateISO,
  getTitle,
  getSubtitle,
  getBadge,
  getRightMeta,
  onEditItem,
  onCreateAtDate,
  createButtonLabel = 'Novo Registro',
  criteriaFilters = [],
  defaultView = 'calendario_mes',
  initialDateISO,
  onSelectedDateChange,
  emptyListMessage = 'Nenhum registro encontrado para os filtros selecionados.'
}: UrutauDateMultiViewProps<T>) {
  const todayISO = toISODateString(new Date());
  const [viewMode, setViewMode] = useState<'lista' | 'kanban_semana' | 'calendario_mes'>(defaultView);
  const [cursorDateISO, setCursorDateISO] = useState<string>(initialDateISO || todayISO);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [escopoPeriodoLista, setEscopoPeriodoLista] = useState<'mes' | 'semana' | 'todos'>('mes');
  const [mostrarDiasEmBranco, setMostrarDiasEmBranco] = useState<boolean>(false);

  useEffect(() => {
    if (initialDateISO && initialDateISO !== cursorDateISO) {
      setCursorDateISO(initialDateISO);
    }
  }, [initialDateISO]);

  const updateCursorDate = (nextISO: string) => {
    setCursorDateISO(nextISO);
    if (onSelectedDateChange) onSelectedDateChange(nextISO);
  };

  const stepDays = (deltaDays: number) => {
    const dt = parseISODateSafe(cursorDateISO);
    dt.setDate(dt.getDate() + deltaDays);
    updateCursorDate(toISODateString(dt));
  };

  const stepMonths = (deltaMonths: number) => {
    const dt = parseISODateSafe(cursorDateISO);
    dt.setMonth(dt.getMonth() + deltaMonths);
    updateCursorDate(toISODateString(dt));
  };

  const diasDaSemanaAtiva = React.useMemo(() => {
    const base = parseISODateSafe(cursorDateISO);
    const dow = base.getDay();
    const domingo = new Date(base);
    domingo.setDate(base.getDate() - dow);
    const list: { iso: string; dayNum: number; monthNum: number; dowIdx: number; curto: string; longo: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(domingo);
      d.setDate(domingo.getDate() + i);
      list.push({
        iso: toISODateString(d),
        dayNum: d.getDate(),
        monthNum: d.getMonth() + 1,
        dowIdx: i,
        curto: DIAS_SEMANA_EXPLORER[i].curto,
        longo: DIAS_SEMANA_EXPLORER[i].longo
      });
    }
    return list;
  }, [cursorDateISO]);

  const dadosMesAtivo = React.useMemo(() => {
    const base = parseISODateSafe(cursorDateISO);
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstDay = new Date(year, month, 1, 12, 0, 0);
    const lastDay = new Date(year, month + 1, 0, 12, 0, 0);
    const daysInMonth = lastDay.getDate();
    const startDow = firstDay.getDay();

    const allMonthDaysISO: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      allMonthDaysISO.push(toISODateString(new Date(year, month, d, 12, 0, 0)));
    }

    const cells: { iso: string | null; dayNum: number | null; isCurrentMonth: boolean }[] = [];
    for (let i = 0; i < startDow; i++) {
      cells.push({ iso: null, dayNum: null, isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toISODateString(new Date(year, month, d, 12, 0, 0));
      cells.push({ iso, dayNum: d, isCurrentMonth: true });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ iso: null, dayNum: null, isCurrentMonth: false });
    }

    return {
      year,
      month,
      monthLabel: `${MESES_NOMES[month]} de ${year}`,
      allMonthDaysISO,
      cells
    };
  }, [cursorDateISO]);

  const filteredItems = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return (items || []).filter((item) => {
      if (!q) return true;
      const t = String(getTitle(item) || '').toLowerCase();
      const s = String(getSubtitle ? getSubtitle(item) : '').toLowerCase();
      const b = String(getBadge ? getBadge(item)?.text : '').toLowerCase();
      const d = String(getDateISO(item) || '').toLowerCase();
      return t.includes(q) || s.includes(q) || b.includes(q) || d.includes(q);
    });
  }, [items, searchTerm, getTitle, getSubtitle, getBadge, getDateISO]);

  const itemsByDateMap = React.useMemo(() => {
    const map: Record<string, T[]> = {};
    filteredItems.forEach((it) => {
      const rawDate = String(getDateISO(it) || '').split('T')[0];
      if (!rawDate) return;
      if (!map[rawDate]) map[rawDate] = [];
      map[rawDate].push(it);
    });
    return map;
  }, [filteredItems, getDateISO]);

  const datasParaLista = React.useMemo(() => {
    const weekISOs = diasDaSemanaAtiva.map((d) => d.iso);
    const monthISOs = dadosMesAtivo.allMonthDaysISO;

    if (mostrarDiasEmBranco) {
      if (escopoPeriodoLista === 'semana') return weekISOs;
      return monthISOs;
    }

    const todasDatasComItens = Object.keys(itemsByDateMap).sort((a, b) => b.localeCompare(a));
    if (escopoPeriodoLista === 'semana') {
      const setSem = new Set(weekISOs);
      return todasDatasComItens.filter((d) => setSem.has(d));
    }
    if (escopoPeriodoLista === 'mes') {
      const prefix = `${dadosMesAtivo.year}-${String(dadosMesAtivo.month + 1).padStart(2, '0')}`;
      return todasDatasComItens.filter((d) => d.startsWith(prefix));
    }
    return todasDatasComItens;
  }, [
    mostrarDiasEmBranco,
    escopoPeriodoLista,
    diasDaSemanaAtiva,
    dadosMesAtivo,
    itemsByDateMap
  ]);

  return (
    <div className="bg-[#11151E] border border-slate-800/90 rounded-xl overflow-hidden space-y-0">
      
      <div className="p-4 border-b border-slate-800/90 bg-[#0D1118] flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold text-slate-100">{title}</h3>

          
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#07130E] border border-[#10B981]/30">
            <button
              type="button"
              onClick={() => setViewMode('calendario_mes')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'calendario_mes'
                  ? 'bg-[#10B981] text-[#05100C] font-bold shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Calendário do Mês (Visualização Primária)"
            >
              <Calendar className="w-3 h-3" />
              <span>Calendário</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban_semana')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'kanban_semana'
                  ? 'bg-[#10B981] text-[#05100C] font-bold shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Visualização da Semana (Colunas por Dia)"
            >
              <Columns className="w-3 h-3" />
              <span>Semana</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('lista')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'lista'
                  ? 'bg-[#10B981] text-[#05100C] font-bold shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Visualização em Lista"
            >
              <ListIcon className="w-3 h-3" />
              <span>Lista</span>
            </button>
          </div>
        </div>

        
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center rounded-lg bg-[#0B0D11] border border-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => stepMonths(-1)}
              className="px-2 py-1 text-[11px] font-mono text-slate-300 hover:text-amber-400 hover:bg-slate-800/60 rounded cursor-pointer"
              title="Recuar 1 Mês"
            >
              ◀◀ Mês
            </button>
            <button
              type="button"
              onClick={() => stepDays(-7)}
              className="px-2 py-1 text-[11px] font-mono text-slate-300 hover:text-[#10B981] hover:bg-slate-800/60 rounded cursor-pointer"
              title="Recuar 1 Semana"
            >
              ◀ Sem
            </button>
            <button
              type="button"
              onClick={() => updateCursorDate(todayISO)}
              className="px-2.5 py-1 text-[11px] font-mono font-bold text-amber-300 hover:bg-amber-500/15 rounded cursor-pointer"
              title="Ir para Hoje"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => stepDays(7)}
              className="px-2 py-1 text-[11px] font-mono text-slate-300 hover:text-[#10B981] hover:bg-slate-800/60 rounded cursor-pointer"
              title="Avançar 1 Semana"
            >
              Sem ▶
            </button>
            <button
              type="button"
              onClick={() => stepMonths(1)}
              className="px-2 py-1 text-[11px] font-mono text-slate-300 hover:text-amber-400 hover:bg-slate-800/60 rounded cursor-pointer"
              title="Avançar 1 Mês"
            >
              Mês ▶▶
            </button>
          </div>

          <input
            type="date"
            value={cursorDateISO}
            onChange={(e) => e.target.value && updateCursorDate(e.target.value)}
            className="px-2.5 py-1.5 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs font-mono text-slate-100"
          />

          {onCreateAtDate && (
            <button
              type="button"
              onClick={() => onCreateAtDate(cursorDateISO)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{createButtonLabel}</span>
            </button>
          )}
        </div>
      </div>

      
      <div className="px-4 py-3 bg-[#0B0D11]/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative min-w-[180px] flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar por texto, pessoa, status..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#11151E] border border-slate-800 rounded-lg text-xs text-slate-100"
            />
          </div>

          {criteriaFilters.map((cf) => {
            if (cf.multiSelect && cf.onMultiChange) {
              const nonAllOptions = cf.options.filter((o) => o.value !== 'TODOS');
              const currentVals = cf.selectedValues || [];
              const allSelected =
                currentVals.length === 0 || currentVals.length === nonAllOptions.length;

              const toggleVal = (val: string) => {
                if (currentVals.length === 0) {
                  cf.onMultiChange!([val]);
                } else if (currentVals.includes(val)) {
                  const next = currentVals.filter((v) => v !== val);
                  cf.onMultiChange!(next);
                } else {
                  cf.onMultiChange!([...currentVals, val]);
                }
              };

              return (
                <div
                  key={cf.id}
                  className="flex flex-wrap items-center gap-1.5 bg-[#080C10] border border-white/10 rounded-lg px-2.5 py-1.5"
                >
                  <Filter className="w-3 h-3 text-[#10B981] shrink-0" />
                  <span className="text-[10px] font-mono uppercase text-emerald-300 font-bold mr-1">
                    {cf.label}:
                  </span>
                  <label className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#131B24] border border-white/10 text-[10px] text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => cf.onMultiChange!([])}
                      className="w-3 h-3 accent-[#10B981] rounded cursor-pointer"
                    />
                    <span>Todos</span>
                  </label>
                  {nonAllOptions.map((opt) => {
                    const isChecked = !allSelected && currentVals.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] cursor-pointer select-none transition-colors ${
                          isChecked
                            ? 'bg-[#10B981]/20 border-[#10B981]/50 text-emerald-200 font-semibold'
                            : 'bg-[#131B24]/60 border-white/10 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleVal(opt.value)}
                          className="w-3 h-3 accent-[#10B981] rounded cursor-pointer"
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              );
            }

            return (
              <div key={cf.id} className="inline-flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium">{cf.label}:</span>
                <select
                  value={cf.value}
                  onChange={(e) => cf.onChange(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#11151E] border border-slate-800 rounded-lg text-xs text-slate-100"
                >
                  {cf.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'lista' && (
            <>
              <div className="inline-flex items-center rounded-lg bg-[#11151E] border border-slate-800 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setEscopoPeriodoLista('semana')}
                  className={`px-2 py-1 rounded cursor-pointer ${
                    escopoPeriodoLista === 'semana'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Semana
                </button>
                <button
                  type="button"
                  onClick={() => setEscopoPeriodoLista('mes')}
                  className={`px-2 py-1 rounded cursor-pointer ${
                    escopoPeriodoLista === 'mes'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Mês
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEscopoPeriodoLista('todos');
                    setMostrarDiasEmBranco(false);
                  }}
                  className={`px-2 py-1 rounded cursor-pointer ${
                    escopoPeriodoLista === 'todos'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tudo
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !mostrarDiasEmBranco;
                  setMostrarDiasEmBranco(next);
                  if (next && escopoPeriodoLista === 'todos') {
                    setEscopoPeriodoLista('mes');
                  }
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  mostrarDiasEmBranco
                    ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                    : 'bg-[#11151E] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Ver dias em branco</span>
              </button>
            </>
          )}

          <span className="text-[11px] font-mono text-slate-400">
            {viewMode === 'kanban_semana'
              ? `Semana: ${formatDateBR(diasDaSemanaAtiva[0].iso)} a ${formatDateBR(diasDaSemanaAtiva[6].iso)}`
              : dadosMesAtivo.monthLabel}
          </span>
        </div>
      </div>

      
      {viewMode === 'lista' && (
        <div className="divide-y divide-slate-800/70 max-h-[620px] overflow-y-auto">
          {datasParaLista.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-2">
              <div>{emptyListMessage}</div>
              <button
                type="button"
                onClick={() => {
                  setEscopoPeriodoLista('todos');
                  setMostrarDiasEmBranco(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-amber-300 text-xs font-semibold cursor-pointer"
              >
                Mostrar Todos os Períodos / Dias em Branco
              </button>
            </div>
          ) : (
            datasParaLista.map((dateISO) => {
              const dayItems = itemsByDateMap[dateISO] || [];
              const dtObj = parseISODateSafe(dateISO);
              const dowLabel = DIAS_SEMANA_EXPLORER[dtObj.getDay()]?.longo || '';
              const isToday = dateISO === todayISO;

              if (dayItems.length === 0) {
                return (
                  <div
                    key={dateISO}
                    onClick={() => onCreateAtDate && onCreateAtDate(dateISO)}
                    className="px-4 py-2.5 bg-[#090C11]/70 hover:bg-slate-800/30 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-slate-500">
                        {formatDateBR(dateISO)}
                      </span>
                      <span className="text-xs text-slate-500">{dowLabel}</span>
                      <span className="text-[11px] italic text-slate-500">
                        — Dia em branco (sem lançamentos)
                      </span>
                    </div>
                    {onCreateAtDate && (
                      <span className="text-[11px] font-mono text-[#10B981] hover:underline">
                        + Lançar neste dia
                      </span>
                    )}
                  </div>
                );
              }

              return (
                <div key={dateISO} className="bg-[#11151E]">
                  <div className="px-4 py-2 bg-[#0D1118] border-b border-slate-800/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400">
                        {formatDateBR(dateISO)}
                      </span>
                      <span className="text-slate-400">· {dowLabel}</span>
                      {isToday && (
                        <span className="text-[10px] font-mono uppercase text-[#10B981] font-bold">
                          • HOJE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-slate-400">
                        {dayItems.length} {dayItems.length === 1 ? 'registro' : 'registros'}
                      </span>
                      {onCreateAtDate && (
                        <button
                          type="button"
                          onClick={() => onCreateAtDate(dateISO)}
                          className="text-[11px] font-mono text-[#10B981] hover:underline cursor-pointer"
                        >
                          + Adicionar
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="divide-y divide-slate-800/40">
                    {dayItems.map((it, idx) => {
                      const badge = getBadge ? getBadge(it) : null;
                      const rightMeta = getRightMeta ? getRightMeta(it) : null;
                      return (
                        <div
                          key={idx}
                          onClick={() => onEditItem(it)}
                          className="px-4 py-3 hover:bg-[#10B981]/10 transition-colors cursor-pointer flex items-center justify-between gap-4 group"
                          title="Clique para editar este registro"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-slate-100 group-hover:text-[#10B981] transition-colors">
                                {getTitle(it)}
                              </span>
                              {badge && (
                                <span
                                  className={`text-[11px] font-mono ${
                                    badge.colorClass || 'text-amber-400'
                                  }`}
                                >
                                  · {badge.text}
                                </span>
                              )}
                            </div>
                            {getSubtitle && (
                              <div className="text-xs text-slate-400 truncate">
                                {getSubtitle(it)}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {rightMeta && (
                              <span className="text-xs font-mono font-bold text-slate-200 tabular-nums">
                                {rightMeta}
                              </span>
                            )}
                            <span className="text-[11px] font-mono text-slate-400 group-hover:text-amber-300">
                              Editar 
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      
      {viewMode === 'kanban_semana' && (
        <div className="p-4 overflow-x-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 min-w-[920px]">
            {diasDaSemanaAtiva.map((dia) => {
              const dayItems = itemsByDateMap[dia.iso] || [];
              const isToday = dia.iso === todayISO;
              const isSelected = dia.iso === cursorDateISO;
              return (
                <div
                  key={dia.iso}
                  className={`rounded-xl border flex flex-col min-h-[320px] transition-colors ${
                    isToday
                      ? 'bg-[#0A1F17]/70 border-[#10B981]/60'
                      : isSelected
                      ? 'bg-[#131B26] border-amber-500/50'
                      : 'bg-[#0B0D11] border-slate-800'
                  }`}
                >
                  <div
                    onClick={() => updateCursorDate(dia.iso)}
                    className="p-2.5 border-b border-slate-800/80 flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <span>{dia.curto}</span>
                        {isToday && (
                          <span className="w-2 h-2 rounded-full bg-[#10B981]" title="Hoje" />
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-amber-400">
                        {String(dia.dayNum).padStart(2, '0')}/{String(dia.monthNum).padStart(2, '0')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-slate-400">
                        ({dayItems.length})
                      </span>
                      {onCreateAtDate && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateAtDate(dia.iso);
                          }}
                          className="p-1 rounded bg-slate-800 hover:bg-[#10B981] text-slate-200 hover:text-slate-950 transition-colors cursor-pointer"
                          title={`Adicionar em ${formatDateBR(dia.iso)}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[420px]">
                    {dayItems.length === 0 ? (
                      <div
                        onClick={() => onCreateAtDate && onCreateAtDate(dia.iso)}
                        className="h-28 rounded-lg border border-dashed border-slate-800/80 flex flex-col items-center justify-center text-center p-2 text-[11px] text-slate-500 hover:border-slate-700 hover:text-slate-300 cursor-pointer"
                      >
                        <span>Sem registros</span>
                        {onCreateAtDate && (
                          <span className="text-[10px] text-[#10B981] mt-1">+ Clique p/ criar</span>
                        )}
                      </div>
                    ) : (
                      dayItems.map((it, idx) => {
                        const badge = getBadge ? getBadge(it) : null;
                        const rightMeta = getRightMeta ? getRightMeta(it) : null;
                        return (
                          <div
                            key={idx}
                            onClick={() => onEditItem(it)}
                            className="p-2.5 rounded-lg bg-[#141A24] border border-slate-800 hover:border-[#10B981] transition-all cursor-pointer space-y-1 shadow-sm group"
                            title="Clique para editar"
                          >
                            <div className="text-xs font-semibold text-slate-100 group-hover:text-[#10B981] line-clamp-2">
                              {getTitle(it)}
                            </div>
                            {getSubtitle && (
                              <div className="text-[11px] text-slate-400 line-clamp-2">
                                {getSubtitle(it)}
                              </div>
                            )}
                            <div className="pt-1 flex items-center justify-between gap-1 text-[10px] font-mono border-t border-slate-800/80">
                              <span className={badge?.colorClass || 'text-amber-400'}>
                                {badge?.text || 'Editar'}
                              </span>
                              {rightMeta && (
                                <span className="font-bold text-slate-200">{rightMeta}</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      
      {viewMode === 'calendario_mes' && (
        <div className="p-4 overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {DIAS_SEMANA_EXPLORER.map((d) => (
                <div
                  key={d.idx}
                  className="py-1.5 text-center text-xs font-mono uppercase text-slate-400 bg-[#0B0D11] rounded-lg border border-slate-800/80"
                >
                  {d.curto}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {dadosMesAtivo.cells.map((cell, cIdx) => {
                if (!cell.isCurrentMonth || !cell.iso) {
                  return (
                    <div
                      key={cIdx}
                      className="min-h-[110px] rounded-xl bg-[#080B10]/50 border border-slate-900/60"
                    />
                  );
                }
                const dayItems = itemsByDateMap[cell.iso] || [];
                const isToday = cell.iso === todayISO;
                const isSelected = cell.iso === cursorDateISO;
                return (
                  <div
                    key={cell.iso}
                    onClick={() => updateCursorDate(cell.iso!)}
                    className={`min-h-[115px] rounded-xl border p-2 flex flex-col justify-between transition-colors ${
                      isToday
                        ? 'bg-[#0A1F17]/80 border-[#10B981]'
                        : isSelected
                        ? 'bg-[#141C28] border-amber-500/60'
                        : 'bg-[#0B0D11] border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-mono font-bold ${
                          isToday ? 'text-[#10B981]' : 'text-slate-300'
                        }`}
                      >
                        {String(cell.dayNum).padStart(2, '0')}
                      </span>
                      {onCreateAtDate && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateAtDate(cell.iso!);
                          }}
                          className="text-[10px] font-mono text-slate-400 hover:text-[#10B981] px-1 rounded cursor-pointer"
                          title={`Novo registro em ${formatDateBR(cell.iso)}`}
                        >
                          +
                        </button>
                      )}
                    </div>

                    <div className="space-y-1 flex-1 overflow-y-auto max-h-[85px]">
                      {dayItems.map((it, idx) => {
                        const badge = getBadge ? getBadge(it) : null;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditItem(it);
                            }}
                            className="w-full text-left px-1.5 py-1 rounded bg-[#151D2A] hover:bg-[#10B981]/20 border border-slate-800 hover:border-[#10B981] text-[10px] text-slate-100 truncate transition-colors cursor-pointer block"
                            title={`${getTitle(it)} — Clique para editar`}
                          >
                            <span className="font-semibold">{getTitle(it)}</span>
                            {badge?.text && (
                              <span className="text-amber-300 ml-1">({badge.text})</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const SYSTEM_SOUND_SLOTS_META: {
  id: SystemSoundSlotId;
  label: string;
  descricao: string;
  defaultSource: SystemSoundSourceId;
  iconeEmoji: string;
}[] = [
  {
    id: 'salvamento',
    label: 'Salvamentos & Cadastros',
    descricao: 'Toca ao salvar registros, configurações, fichas técnicas, escalas e cadastros',
    defaultSource: 'amazonia_flauta',
    iconeEmoji: ''
  },
  {
    id: 'notificacao',
    label: 'Notificações & Avisos',
    descricao: 'Toca ao receber alertas operacionais, confirmações de ações e lembretes',
    defaultSource: 'amazonia_kalimba',
    iconeEmoji: ''
  },
  {
    id: 'erro',
    label: 'Erros, Exclusões & Bloqueios',
    descricao: 'Toca em validações pendentes, exclusões críticas, falhas ou bloqueio de perímetro',
    defaultSource: 'urutau_pio_alerta',
    iconeEmoji: ''
  },
  {
    id: 'mensagem',
    label: 'Mensagens & Chat WhatsApp',
    descricao: 'Toca ao enviar ou receber mensagens de atendimento, comunidade ou mural da equipe',
    defaultSource: 'amazonia_igarape',
    iconeEmoji: ''
  },
  {
    id: 'evento_sse',
    label: 'Eventos em Tempo Real (Sync)',
    descricao: 'Toca quando chega atualização multiplataforma ao vivo de outro dispositivo',
    defaultSource: 'urutau_solar',
    iconeEmoji: ''
  },
  {
    id: 'transicao_voo',
    label: 'Voo do Urutau & Transição de Tela',
    descricao: 'Toca sutilmente quando o Urutau levanta voo entre login, painel, menu e telas',
    defaultSource: 'urutau_voo',
    iconeEmoji: ''
  },
  {
    id: 'login_acesso',
    label: 'Login & Desbloqueio de Turno',
    descricao: 'Toca ao desbloquear sessão com Token WhatsApp ou Senha Argon2id',
    defaultSource: 'urutau_alvorada',
    iconeEmoji: ''
  },
  {
    id: 'alerta_caixa_estoque',
    label: 'Alertas de Caixa & Estoque',
    descricao: 'Toca em sangrias, fechamento de caixa, estoque mínimo ou divergência de CMV',
    defaultSource: 'amazonia_marimba',
    iconeEmoji: ''
  }
];

export const BUILTIN_SYSTEM_SOUNDS_META: {
  id: SystemSoundSourceId;
  label: string;
  resumo: string;
  wavFile?: string;
}[] = [
  {
    id: 'urutau_solar',
    label: 'Urutau Solar (urutau_solar.wav • 0.75s)',
    resumo: 'Tríade harmônica solar ascendente (840Hz → 1060Hz → 1270Hz) com harmônicos de 2ª oitava',
    wavFile: '/sons/urutau_solar.wav'
  },
  {
    id: 'urutau_alvorada',
    label: 'Urutau Alvorada (urutau_alvorada.wav • 0.95s)',
    resumo: 'Arpejo matinal em Ré Maior (587Hz, 740Hz, 880Hz, 1174Hz) + chamado solar agudo em 1420Hz',
    wavFile: '/sons/urutau_alvorada.wav'
  },
  {
    id: 'urutau_voo',
    label: 'Urutau Voo (urutau_voo.wav • 0.35s)',
    resumo: 'Brisa ascendente contínua de voo (660Hz → 1320Hz) com envelope senoidal suave',
    wavFile: '/sons/urutau_voo.wav'
  },
  {
    id: 'urutau_pio_alerta',
    label: 'Urutau Pio de Alerta (urutau_pio_alerta.wav • 0.48s)',
    resumo: 'Duplo pio descendente de atenção (523Hz → 443Hz e 440Hz → 392Hz)',
    wavFile: '/sons/urutau_pio_alerta.wav'
  },
  {
    id: 'amazonia_marimba',
    label: 'Amazônia Marimba (amazonia_marimba.wav • 0.55s)',
    resumo: 'Tríade percussiva de madeira amazônica (784Hz, 1046Hz, 1318Hz) com transiente de 8ª harmônica',
    wavFile: '/sons/amazonia_marimba.wav'
  },
  {
    id: 'amazonia_igarape',
    label: 'Amazônia Igarapé (amazonia_igarape.wav • 0.45s)',
    resumo: 'Duplo borbulhar cristalino de igarapé (920Hz e 1180Hz) para mensagens e chat',
    wavFile: '/sons/amazonia_igarape.wav'
  },
  {
    id: 'amazonia_flauta',
    label: 'Amazônia Flauta (amazonia_flauta.wav • 0.55s)',
    resumo: 'Intervalo de quinta justa em flauta nativa (987.77Hz → 1479.98Hz) para salvamentos',
    wavFile: '/sons/amazonia_flauta.wav'
  },
  {
    id: 'amazonia_kalimba',
    label: 'Amazônia Kalimba (amazonia_kalimba.wav • 0.65s)',
    resumo: 'Arpejo metálico-orgânico de kalimba (659Hz, 830Hz, 987Hz) para notificações',
    wavFile: '/sons/amazonia_kalimba.wav'
  },
  {
    id: 'silencioso',
    label: ' Silencioso (Desativar som neste evento)',
    resumo: 'Não reproduz nenhum som quando este evento ocorrer'
  }
];

export const DEFAULT_SOUND_SYSTEM_CONFIG: SoundSystemConfig = {
  enabled: true,
  masterVolume: 0.75,
  soundPlacements: {
    salvamento: 'amazonia_flauta',
    notificacao: 'amazonia_kalimba',
    erro: 'urutau_pio_alerta',
    mensagem: 'amazonia_igarape',
    evento_sse: 'urutau_solar',
    transicao_voo: 'urutau_voo',
    login_acesso: 'urutau_alvorada',
    alerta_caixa_estoque: 'amazonia_marimba'
  },
  customSounds: []
};

export function playUrutauSystemSound(
  _slot: SystemSoundSlotId,
  _brandConfig?: BrandIdentityConfig,
  _overrideSourceId?: SystemSoundSourceId
) {
  return;
}

export function UrutauSoundStudioSection({
  brandConfig,
  onUpdateBrandConfig
}: {
  brandConfig: BrandIdentityConfig;
  onUpdateBrandConfig: (next: BrandIdentityConfig) => void;
}) {
  const soundCfg: SoundSystemConfig = React.useMemo(
    () => ({
      ...DEFAULT_SOUND_SYSTEM_CONFIG,
      ...(brandConfig.soundConfig || {}),
      soundPlacements: {
        ...DEFAULT_SOUND_SYSTEM_CONFIG.soundPlacements,
        ...(brandConfig.soundConfig?.soundPlacements || {})
      },
      customSounds: brandConfig.soundConfig?.customSounds || []
    }),
    [brandConfig.soundConfig]
  );

  const [recordingSlot, setRecordingSlot] = useState<SystemSoundSlotId | 'galeria' | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [filterMode, setFilterMode] = useState<'nao_usados' | 'todos'>('todos');
  const [statusFeedback, setStatusFeedback] = useState<string>('');
  const [pendingConfirmAction, setPendingConfirmAction] = useState<{
    titulo: string;
    descricao: string;
    tipo: 'salvar' | 'excluir' | 'redefinir';
    execute: () => void;
  } | null>(null);

  const commitSoundConfig = (nextSoundConfig: SoundSystemConfig, feedbackMsg?: string) => {
    onUpdateBrandConfig({
      ...brandConfig,
      soundConfig: nextSoundConfig
    });
    if (feedbackMsg) {
      setStatusFeedback(feedbackMsg);
      setTimeout(() => setStatusFeedback(''), 3500);
    }
  };

  const handleDirectSlotAudioUpload = (slotId: SystemSoundSlotId, file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const slotMeta = SYSTEM_SOUND_SLOTS_META.find((s) => s.id === slotId);
      const cleanName =
        file.name.replace(/\.[^/.]+$/, '').slice(0, 32) ||
        `Som ${slotMeta?.label || slotId}`;
      const newSoundId = `custom_snd_${Date.now()}`;
      const newCustomItem: CustomSoundItem = {
        id: newSoundId,
        nome: cleanName,
        dataUrl,
        criadoEm: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };

      setPendingConfirmAction({
        titulo: 'Confirmar Salvamento de Novo Som Personalizado',
        descricao: `Deseja salvar o áudio "${cleanName}" e aplicá-lo ao evento "${slotMeta?.label || slotId}"?`,
        tipo: 'salvar',
        execute: () => {
          const nextCfg: SoundSystemConfig = {
            ...soundCfg,
            customSounds: [...(soundCfg.customSounds || []), newCustomItem],
            soundPlacements: {
              ...(soundCfg.soundPlacements || {}),
              [slotId]: newSoundId
            }
          };
          commitSoundConfig(
            nextCfg,
            `Som "${cleanName}" salvo e vinculado a "${slotMeta?.label}"!`
          );
          setTimeout(() => {
            playUrutauSystemSound(slotId, { ...brandConfig, soundConfig: nextCfg }, newSoundId);
          }, 120);
        }
      });
    };
    reader.readAsDataURL(file);
  };

  const handleMultiGalleryAudioUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const loaded: CustomSoundItem[] = [];
    let count = 0;

    fileArray.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const cleanName =
          file.name.replace(/\.[^/.]+$/, '').slice(0, 32) || `Áudio Galeria #${idx + 1}`;
        loaded.push({
          id: `custom_snd_${Date.now()}_${idx}`,
          nome: cleanName,
          dataUrl,
          criadoEm: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        });
        count += 1;
        if (count === fileArray.length) {
          setPendingConfirmAction({
            titulo: 'Confirmar Salvamento na Galeria Sonora',
            descricao: `Deseja salvar ${loaded.length} arquivo(s) de áudio no acervo da Galeria Sonora?`,
            tipo: 'salvar',
            execute: () => {
              commitSoundConfig(
                {
                  ...soundCfg,
                  customSounds: [...(soundCfg.customSounds || []), ...loaded]
                },
                `${loaded.length} som(ns) guardado(s) na Galeria Sonora!`
              );
              playUrutauSystemSound('salvamento', brandConfig);
            }
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const startMicRecording = async (target: SystemSoundSlotId | 'galeria') => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatusFeedback('Navegador sem permissão de microfone neste ambiente. Use o botão + Enviar Som.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || '');
          const slotMeta =
            target === 'galeria'
              ? null
              : SYSTEM_SOUND_SLOTS_META.find((s) => s.id === target);
          const newId = `custom_mic_${Date.now()}`;
          const nome = slotMeta
            ? `Gravação ${slotMeta.label.split(' ')[0]} (${new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
              })})`
            : `Gravação Gestor (${new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
              })})`;
          const newCustom: CustomSoundItem = {
            id: newId,
            nome,
            dataUrl,
            criadoEm: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          };

          setPendingConfirmAction({
            titulo: 'Confirmar Salvamento de Gravação de Áudio',
            descricao: slotMeta
              ? `Deseja salvar a gravação "${nome}" e vinculá-la ao evento "${slotMeta.label}"?`
              : `Deseja salvar a gravação "${nome}" na Galeria Sonora?`,
            tipo: 'salvar',
            execute: () => {
              const nextCfg: SoundSystemConfig = {
                ...soundCfg,
                customSounds: [...(soundCfg.customSounds || []), newCustom],
                soundPlacements:
                  target === 'galeria'
                    ? soundCfg.soundPlacements
                    : {
                        ...(soundCfg.soundPlacements || {}),
                        [target]: newId
                      }
              };
              commitSoundConfig(nextCfg, `Gravação "${nome}" salva com sucesso!`);
              setTimeout(() => {
                playUrutauSystemSound(
                  target === 'galeria' ? 'salvamento' : target,
                  { ...brandConfig, soundConfig: nextCfg },
                  newId
                );
              }, 100);
            }
          });
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingSlot(target);
    } catch {
      setStatusFeedback('Não foi possível acessar o microfone. Use o botão + Enviar Som para subir um arquivo de áudio.');
    }
  };

  const stopMicRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecordingSlot(null);
  };

  const activeSlotsBySound = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    SYSTEM_SOUND_SLOTS_META.forEach((slot) => {
      const src = soundCfg.soundPlacements?.[slot.id] || slot.defaultSource;
      if (!map[src]) map[src] = [];
      map[src].push(slot.label);
    });
    return map;
  }, [soundCfg.soundPlacements]);

  const allGallerySounds = React.useMemo(() => {
    const items: {
      id: SystemSoundSourceId;
      nome: string;
      resumo: string;
      isCustom: boolean;
      usedInSlots: string[];
    }[] = [];

    (soundCfg.customSounds || []).forEach((c) => {
      items.push({
        id: c.id,
        nome: c.nome,
        resumo: `Áudio próprio do gestor ${c.criadoEm ? `• enviado às ${c.criadoEm}` : ''}`,
        isCustom: true,
        usedInSlots: activeSlotsBySound[c.id] || []
      });
    });

    BUILTIN_SYSTEM_SOUNDS_META.filter((b) => b.id !== 'silencioso').forEach((b) => {
      items.push({
        id: b.id,
        nome: b.label,
        resumo: b.resumo,
        isCustom: false,
        usedInSlots: activeSlotsBySound[b.id] || []
      });
    });

    return items;
  }, [soundCfg.customSounds, activeSlotsBySound]);

  const visibleGallerySounds =
    filterMode === 'nao_usados'
      ? allGallerySounds.filter((s) => s.usedInSlots.length === 0)
      : allGallerySounds;

  const unusedSoundsCount = allGallerySounds.filter((s) => s.usedInSlots.length === 0).length;

  return (
    <div className="bg-[#0C1117] border border-white/10 rounded-xl p-4 sm:p-5 space-y-5">
      
      {pendingConfirmAction && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#091410] border border-[#10B981]/50 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 flex items-center justify-center shrink-0">
                <SystemSlotImage
                  slot="dialogos_seguranca"
                  brandConfig={brandConfig}
                  overrideSource="comunicacao"
                  className="w-11 h-11"
                />
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold mb-1 ${
                    pendingConfirmAction.tipo === 'excluir'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : pendingConfirmAction.tipo === 'redefinir'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {pendingConfirmAction.tipo === 'excluir'
                    ? 'Confirmação de Exclusão'
                    : pendingConfirmAction.tipo === 'redefinir'
                    ? 'Confirmação de Redefinição'
                    : 'Confirmação de Alteração'}
                </span>
                <h4 className="text-sm font-bold text-white">{pendingConfirmAction.titulo}</h4>
                <p className="text-xs text-slate-300 mt-1">{pendingConfirmAction.descricao}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                data-no-confirm="true"
                onClick={() => setPendingConfirmAction(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-no-confirm="true"
                onClick={() => {
                  const fn = pendingConfirmAction.execute;
                  setPendingConfirmAction(null);
                  fn();
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                  pendingConfirmAction.tipo === 'excluir'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : pendingConfirmAction.tipo === 'redefinir'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    : 'bg-[#10B981] hover:bg-emerald-400 text-[#05100C]'
                }`}
              >
                Sim, Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-[#F59E0B]" />
            <span> Sistema Sonoro Personalizável Urutau (Sons do Gestor & Eventos)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Escolha ou envie seus próprios sons (MP3, WAV, OGG, M4A ou gravação de voz) para salvamentos, notificações, erros, mensagens, transição de voo e eventos em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          
          <button
            type="button"
            data-no-confirm="true"
            onClick={() => {
              const nextEnabled = !soundCfg.enabled;
              commitSoundConfig(
                { ...soundCfg, enabled: nextEnabled },
                nextEnabled ? 'Sistema sonoro ativado!' : 'Sistema sonoro silenciado.'
              );
              if (nextEnabled) {
                playUrutauSystemSound('notificacao', {
                  ...brandConfig,
                  soundConfig: { ...soundCfg, enabled: true }
                });
              }
            }}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              soundCfg.enabled
                ? 'bg-[#10B981]/20 border-[#10B981]/50 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
            }`}
          >
            {soundCfg.enabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Som Ativo</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Silenciado</span>
              </>
            )}
          </button>

          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#131B24] border border-white/10">
            <span className="text-[11px] font-mono text-slate-300">
              Volume: {Math.round((soundCfg.masterVolume ?? 0.75) * 100)}%
            </span>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={Math.round((soundCfg.masterVolume ?? 0.75) * 100)}
              onChange={(e) => {
                const nextVol = Number(e.target.value) / 100;
                commitSoundConfig({ ...soundCfg, masterVolume: nextVol });
              }}
              className="w-20 accent-[#10B981] cursor-pointer"
            />
          </div>

          
          <button
            type="button"
            data-no-confirm="true"
            onClick={() => {
              setPendingConfirmAction({
                titulo: 'Confirmar Redefinição dos Sons Padrão',
                descricao:
                  'Deseja redefinir todos os 8 eventos sonoros para os sons originais da floresta Urutau? (Seus áudios enviados continuarão guardados na Galeria Sonora).',
                tipo: 'redefinir',
                execute: () => {
                  commitSoundConfig(
                    {
                      ...soundCfg,
                      enabled: true,
                      soundPlacements: { ...DEFAULT_SOUND_SYSTEM_CONFIG.soundPlacements }
                    },
                    'Sons redefinidos para o padrão original Urutau!'
                  );
                  playUrutauSystemSound('salvamento', {
                    ...brandConfig,
                    soundConfig: {
                      ...soundCfg,
                      enabled: true,
                      soundPlacements: { ...DEFAULT_SOUND_SYSTEM_CONFIG.soundPlacements }
                    }
                  });
                }
              });
            }}
            className="px-3 py-1.5 rounded-lg bg-[#0B2219] hover:bg-[#113326] border border-[#10B981]/40 text-xs font-semibold text-emerald-300 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Redefinir Sons Padrão</span>
          </button>
        </div>
      </div>

      {statusFeedback && (
        <div className="px-3.5 py-2 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-xs text-emerald-300 font-semibold flex items-center justify-between">
          <span> {statusFeedback}</span>
          <button
            type="button"
            data-no-confirm="true"
            onClick={() => setStatusFeedback('')}
            className="text-emerald-200 hover:text-white text-xs cursor-pointer"
          >
            
          </button>
        </div>
      )}

      
      <div className="p-3.5 rounded-xl bg-[#071712] border border-[#10B981]/35 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>Sons do Sistema</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            /public/sons
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {SYSTEM_SOUND_SLOTS_META.map((slot) => {
            const currentSource = soundCfg.soundPlacements?.[slot.id] || slot.defaultSource;
            return (
              <div
                key={slot.id}
                className="p-2.5 rounded-lg bg-[#09120E] border border-white/10 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white truncate">{slot.label}</span>
                  <select
                    value={currentSource}
                    onChange={(e) => {
                      const nextVal = e.target.value;
                      commitSoundConfig({
                        ...soundCfg,
                        soundPlacements: {
                          ...(soundCfg.soundPlacements || {}),
                          [slot.id]: nextVal
                        }
                      });
                    }}
                    className="px-2 py-1 rounded bg-[#05100C] border border-white/15 text-[10px] text-emerald-300"
                  >
                    {BUILTIN_SYSTEM_SOUNDS_META.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                    {(soundCfg.customSounds || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 cursor-pointer">
                    Enviar
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => handleDirectSlotAudioUpload(slot.id, e.target.files?.[0])}
                      className="hidden"
                    />
                  </label>
                  {recordingSlot === slot.id ? (
                    <button
                      type="button"
                      onClick={stopMicRecording}
                      className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 text-[10px] cursor-pointer"
                    >
                      Parar ({unusedSoundsCount})
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startMicRecording(slot.id)}
                      className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] cursor-pointer"
                    >
                      Gravar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {visibleGallerySounds.length > 0 && (
          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400">
              Sons na galeria: {visibleGallerySounds.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterMode(filterMode === 'todos' ? 'nao_usados' : 'todos')}
                className="px-2 py-1 rounded bg-white/5 text-[10px] text-slate-300 cursor-pointer"
              >
                {filterMode === 'todos' ? 'Ver não usados' : 'Ver todos'}
              </button>
              <label className="px-2 py-1 rounded bg-[#10B981]/20 text-[10px] text-emerald-300 cursor-pointer">
                Adicionar Áudios
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  onChange={(e) => handleMultiGalleryAudioUpload(e.target.files)}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function UrutauGlobalSelectSystem(_props?: {
  onRefreshErp?: () => void | Promise<void>;
}) {
  return null;
}

export interface ValidatedStateEntry {
  sigla: string;
  nome: string;
  cidades: string[];
}

export interface ValidatedCountryEntry {
  codigo: string;
  nome: string;
  estados: ValidatedStateEntry[];
}

export const VALIDATED_LOCATIONS_CATALOG: ValidatedCountryEntry[] = [
  {
    codigo: 'BR',
    nome: 'Brasil',
    estados: [
      { sigla: 'AC', nome: 'Acre', cidades: ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira', 'Tarauacá', 'Feijó', 'Brasiléia', 'Epitaciolândia'] },
      { sigla: 'AL', nome: 'Alagoas', cidades: ['Maceió', 'Arapiraca', 'Rio Largo', 'Palmeira dos Índios', 'Marechal Deodoro', 'Penedo', 'Maragogi'] },
      { sigla: 'AP', nome: 'Amapá', cidades: ['Macapá', 'Santana', 'Laranjal do Jari', 'Oiapoque', 'Mazagão', 'Porto Grande'] },
      { sigla: 'AM', nome: 'Amazonas', cidades: ['Manaus', 'Parintins', 'Itacoatiara', 'Manacapuru', 'Coari', 'Tefé', 'Tabatinga', 'Presidente Figueiredo', 'Iranduba'] },
      { sigla: 'BA', nome: 'Bahia', cidades: ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Juazeiro', 'Itabuna', 'Ilhéus', 'Porto Seguro', 'Lauro de Freitas', 'Barreiras'] },
      { sigla: 'CE', nome: 'Ceará', cidades: ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral', 'Crato', 'Itapipoca', 'Aquiraz', 'Jijoca de Jericoacoara'] },
      { sigla: 'DF', nome: 'Distrito Federal', cidades: ['Brasília', 'Taguatinga', 'Águas Claras', 'Ceilândia', 'Guará', 'Sobradinho', 'Gama'] },
      { sigla: 'ES', nome: 'Espírito Santo', cidades: ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Cachoeiro de Itapemirim', 'Linhares', 'Guarapari', 'Colatina'] },
      { sigla: 'GO', nome: 'Goiás', cidades: ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia', 'Águas Lindas de Goiás', 'Caldas Novas', 'Pirenópolis'] },
      { sigla: 'MA', nome: 'Maranhão', cidades: ['São Luís', 'Imperatriz', 'São José de Ribamar', 'Timon', 'Caxias', 'Paço do Lumiar', 'Codó', 'Barreirinhas', 'Balsas'] },
      { sigla: 'MT', nome: 'Mato Grosso', cidades: ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop', 'Tangará da Serra', 'Sorriso', 'Lucas do Rio Verde', 'Chapada dos Guimarães'] },
      { sigla: 'MS', nome: 'Mato Grosso do Sul', cidades: ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá', 'Ponta Porã', 'Bonito', 'Naviraí'] },
      { sigla: 'MG', nome: 'Minas Gerais', cidades: ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Uberaba', 'Poços de Caldas', 'Ouro Preto', 'Tiradentes'] },
      { sigla: 'PA', nome: 'Pará', cidades: ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Parauapebas', 'Castanhal', 'Abaetetuba', 'Cametá', 'Marituba', 'Bragança', 'Altamira', 'Tucuruí', 'Paragominas', 'Barcarena', 'Salinópolis', 'Capanema', 'Redenção', 'Itaituba', 'Oriximiná', 'Soure', 'Salvaterra'] },
      { sigla: 'PB', nome: 'Paraíba', cidades: ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos', 'Bayeux', 'Sousa', 'Cabedelo', 'Conde'] },
      { sigla: 'PR', nome: 'Paraná', cidades: ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'São José dos Pinhais', 'Foz do Iguaçu', 'Colombo', 'Guarapuava', 'Paranaguá'] },
      { sigla: 'PE', nome: 'Pernambuco', cidades: ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru', 'Petrolina', 'Paulista', 'Cabo de Santo Agostinho', 'Garanhuns', 'Ipojuca'] },
      { sigla: 'PI', nome: 'Piauí', cidades: ['Teresina', 'Parnaíba', 'Picos', 'Piripiri', 'Floriano', 'Campo Maior', 'Luís Correia'] },
      { sigla: 'RJ', nome: 'Rio de Janeiro', cidades: ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Belford Roxo', 'Campos dos Goytacazes', 'Petrópolis', 'Volta Redonda', 'Macaé', 'Cabo Frio', 'Armação dos Búzios', 'Paraty', 'Angra dos Reis'] },
      { sigla: 'RN', nome: 'Rio Grande do Norte', cidades: ['Natal', 'Mossoró', 'Parnamirim', 'São Gonçalo do Amarante', 'Macaíba', 'Ceará-Mirim', 'Caicó', 'Tibau do Sul'] },
      { sigla: 'RS', nome: 'Rio Grande do Sul', cidades: ['Porto Alegre', 'Caxias do Sul', 'Canoas', 'Pelotas', 'Santa Maria', 'Gravataí', 'Novo Hamburgo', 'São Leopoldo', 'Passo Fundo', 'Gramado', 'Canela', 'Bento Gonçalves'] },
      { sigla: 'RO', nome: 'Rondônia', cidades: ['Porto Velho', 'Ji-Paraná', 'Ariquemes', 'Vilhena', 'Cacoal', 'Rolim de Moura', 'Guajará-Mirim'] },
      { sigla: 'RR', nome: 'Roraima', cidades: ['Boa Vista', 'Rorainópolis', 'Caracaraí', 'Pacaraima', 'Cantá', 'Alto Alegre'] },
      { sigla: 'SC', nome: 'Santa Catarina', cidades: ['Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Chapecó', 'Itajaí', 'Criciúma', 'Jaraguá do Sul', 'Balneário Camboriú', 'Palhoça', 'Lages'] },
      { sigla: 'SP', nome: 'São Paulo', cidades: ['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'São José dos Campos', 'Ribeirão Preto', 'Sorocaba', 'Santos', 'Jundiaí', 'Piracicaba', 'Bauru', 'São José do Rio Preto', 'Barueri', 'Campos do Jordão', 'Ubatuba', 'Ilhabela'] },
      { sigla: 'SE', nome: 'Sergipe', cidades: ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto', 'Itabaiana', 'São Cristóvão', 'Estância'] },
      { sigla: 'TO', nome: 'Tocantins', cidades: ['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional', 'Paraíso do Tocantins', 'Colinas do Tocantins'] }
    ]
  },
  {
    codigo: 'PT',
    nome: 'Portugal',
    estados: [
      { sigla: 'LIS', nome: 'Lisboa', cidades: ['Lisboa', 'Sintra', 'Cascais', 'Loures', 'Oeiras', 'Amadora', 'Mafra'] },
      { sigla: 'PRT', nome: 'Porto', cidades: ['Porto', 'Vila Nova de Gaia', 'Matosinhos', 'Maia', 'Gondomar', 'Póvoa de Varzim'] },
      { sigla: 'BRG', nome: 'Braga', cidades: ['Braga', 'Guimarães', 'Barcelos', 'Vila Nova de Famalicão'] },
      { sigla: 'FAR', nome: 'Faro (Algarve)', cidades: ['Faro', 'Albufeira', 'Portimão', 'Loulé', 'Lagos', 'Tavira'] },
      { sigla: 'COI', nome: 'Coimbra', cidades: ['Coimbra', 'Figueira da Foz', 'Cantanhede'] }
    ]
  },
  {
    codigo: 'US',
    nome: 'Estados Unidos',
    estados: [
      { sigla: 'FL', nome: 'Florida', cidades: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale', 'Boca Raton'] },
      { sigla: 'NY', nome: 'New York', cidades: ['New York', 'Buffalo', 'Rochester', 'Albany', 'Syracuse'] },
      { sigla: 'CA', nome: 'California', cidades: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento'] },
      { sigla: 'TX', nome: 'Texas', cidades: ['Houston', 'Austin', 'Dallas', 'San Antonio', 'Fort Worth'] },
      { sigla: 'MA', nome: 'Massachusetts', cidades: ['Boston', 'Cambridge', 'Worcester', 'Somerville'] }
    ]
  },
  {
    codigo: 'AR',
    nome: 'Argentina',
    estados: [
      { sigla: 'CABA', nome: 'Buenos Aires', cidades: ['Buenos Aires', 'La Plata', 'Mar del Plata', 'Tigre', 'San Isidro'] },
      { sigla: 'COR', nome: 'Córdoba', cidades: ['Córdoba', 'Villa Carlos Paz', 'Río Cuarto'] },
      { sigla: 'MDZ', nome: 'Mendoza', cidades: ['Mendoza', 'San Rafael', 'Godoy Cruz', 'Luján de Cuyo'] },
      { sigla: 'SF', nome: 'Santa Fe', cidades: ['Rosario', 'Santa Fe', 'Rafaela'] }
    ]
  },
  {
    codigo: 'UY',
    nome: 'Uruguai',
    estados: [
      { sigla: 'MVD', nome: 'Montevidéu', cidades: ['Montevidéu', 'Ciudad de la Costa'] },
      { sigla: 'MAL', nome: 'Maldonado', cidades: ['Punta del Este', 'Maldonado', 'Piriápolis', 'José Ignacio'] },
      { sigla: 'COL', nome: 'Colonia', cidades: ['Colonia del Sacramento', 'Carmelo'] }
    ]
  },
  {
    codigo: 'PY',
    nome: 'Paraguai',
    estados: [
      { sigla: 'ASU', nome: 'Assunção', cidades: ['Assunção', 'Luque', 'San Lorenzo', 'Lambaré'] },
      { sigla: 'AAP', nome: 'Alto Paraná', cidades: ['Ciudad del Este', 'Hernandarias', 'Presidente Franco'] },
      { sigla: 'ITA', nome: 'Itapúa', cidades: ['Encarnación', 'Hohenau'] }
    ]
  }
];

const ibgeCitiesCache: Record<string, string[]> = {};

function parseFormattedCityStateCountry(rawValue: string): {
  countryCode: string;
  stateSigla: string;
  cityName: string;
} {
  const clean = String(rawValue || '').trim();
  if (!clean) {
    return { countryCode: 'BR', stateSigla: 'PA', cityName: 'Belém' };
  }

  const parts = clean.split(' - ').map((s) => s.trim());
  if (parts.length >= 2) {
    const rawCity = parts[0];
    const rightPart = parts[1];
    const countryMatch = rightPart.match(/^([A-Z0-9]+)\s*\(([A-Z]{2})\)$/i);
    if (countryMatch) {
      const st = countryMatch[1].toUpperCase();
      const ct = countryMatch[2].toUpperCase();
      const foundCountry = VALIDATED_LOCATIONS_CATALOG.find((c) => c.codigo === ct);
      if (foundCountry) {
        const foundState =
          foundCountry.estados.find((e) => e.sigla.toUpperCase() === st) || foundCountry.estados[0];
        return {
          countryCode: foundCountry.codigo,
          stateSigla: foundState.sigla,
          cityName: rawCity || foundState.cidades[0]
        };
      }
    }

    const stUpper = rightPart.toUpperCase();
    for (const country of VALIDATED_LOCATIONS_CATALOG) {
      const stObj = country.estados.find(
        (e) => e.sigla.toUpperCase() === stUpper || e.nome.toLowerCase() === rightPart.toLowerCase()
      );
      if (stObj) {
        return {
          countryCode: country.codigo,
          stateSigla: stObj.sigla,
          cityName: rawCity || stObj.cidades[0]
        };
      }
    }
  }

  for (const country of VALIDATED_LOCATIONS_CATALOG) {
    for (const st of country.estados) {
      const matchedCity = st.cidades.find((c) => c.toLowerCase() === clean.toLowerCase());
      if (matchedCity) {
        return {
          countryCode: country.codigo,
          stateSigla: st.sigla,
          cityName: matchedCity
        };
      }
    }
  }

  return { countryCode: 'BR', stateSigla: 'PA', cityName: 'Belém' };
}

function formatValidatedCityStateCountry(
  countryCode: string,
  stateSigla: string,
  cityName: string
): string {
  if (countryCode === 'BR') {
    return `${cityName} - ${stateSigla}`;
  }
  return `${cityName} - ${stateSigla} (${countryCode})`;
}

export function UrutauValidatedCityStateSelector({
  value,
  onChange,
  variant = 'dark'
}: {
  value: string;
  onChange: (formattedCityState: string) => void;
  variant?: 'dark' | 'emerald';
}) {
  const parsed = useMemo(() => parseFormattedCityStateCountry(value), [value]);
  const [countryCode, setCountryCode] = useState<string>(parsed.countryCode);
  const [stateSigla, setStateSigla] = useState<string>(parsed.stateSigla);
  const [cityName, setCityName] = useState<string>(parsed.cityName);
  const [dynamicBrCities, setDynamicBrCities] = useState<string[] | null>(null);

  useEffect(() => {
    const p = parseFormattedCityStateCountry(value);
    setCountryCode(p.countryCode);
    setStateSigla(p.stateSigla);
    setCityName(p.cityName);
  }, [value]);

  const currentCountry = useMemo(
    () =>
      VALIDATED_LOCATIONS_CATALOG.find((c) => c.codigo === countryCode) ||
      VALIDATED_LOCATIONS_CATALOG[0],
    [countryCode]
  );

  const currentState = useMemo(
    () =>
      currentCountry.estados.find((e) => e.sigla === stateSigla) ||
      currentCountry.estados[0],
    [currentCountry, stateSigla]
  );

  useEffect(() => {
    let active = true;
    if (currentCountry.codigo !== 'BR') {
      setDynamicBrCities(null);
      return;
    }
    const uf = currentState.sigla.toUpperCase();
    if (ibgeCitiesCache[uf]) {
      setDynamicBrCities(ibgeCitiesCache[uf]);
      return;
    }
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!active || !Array.isArray(json) || json.length === 0) return;
        const names = Array.from(
          new Set(
            json
              .map((item: any) => String(item?.nome || '').trim())
              .filter(Boolean)
          )
        );
        if (names.length > 0) {
          ibgeCitiesCache[uf] = names;
          setDynamicBrCities(names);
        }
      })
      .catch(() => {
        if (active) setDynamicBrCities(null);
      });
    return () => {
      active = false;
    };
  }, [currentCountry.codigo, currentState.sigla]);

  const validatedCities = useMemo(() => {
    const baseCities =
      currentCountry.codigo === 'BR' && dynamicBrCities && dynamicBrCities.length > 0
        ? dynamicBrCities
        : currentState.cidades;
    if (cityName && !baseCities.includes(cityName)) {
      return [cityName, ...baseCities];
    }
    return baseCities;
  }, [currentCountry.codigo, currentState.cidades, dynamicBrCities, cityName]);

  const selectClass =
    variant === 'emerald'
      ? 'w-full px-2.5 py-2.5 rounded-xl bg-[#041417] border border-[#10B981]/35 text-xs text-white focus:outline-none focus:border-[#10B981]'
      : 'w-full px-2.5 py-2 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-[#10B981]';

  const handleCountryChange = (nextCountryCode: string) => {
    const nextCountry =
      VALIDATED_LOCATIONS_CATALOG.find((c) => c.codigo === nextCountryCode) ||
      VALIDATED_LOCATIONS_CATALOG[0];
    const nextState = nextCountry.estados[0];
    const nextCity = nextState.cidades[0];
    setCountryCode(nextCountry.codigo);
    setStateSigla(nextState.sigla);
    setCityName(nextCity);
    onChange(formatValidatedCityStateCountry(nextCountry.codigo, nextState.sigla, nextCity));
  };

  const handleStateChange = (nextStateSigla: string) => {
    const nextState =
      currentCountry.estados.find((e) => e.sigla === nextStateSigla) ||
      currentCountry.estados[0];
    const cachedList =
      currentCountry.codigo === 'BR' ? ibgeCitiesCache[nextState.sigla] : undefined;
    const nextCity =
      cachedList && cachedList.length > 0
        ? nextState.cidades[0] && cachedList.includes(nextState.cidades[0])
          ? nextState.cidades[0]
          : cachedList[0]
        : nextState.cidades[0];
    setStateSigla(nextState.sigla);
    setCityName(nextCity);
    onChange(formatValidatedCityStateCountry(currentCountry.codigo, nextState.sigla, nextCity));
  };

  const handleCityChange = (nextCityName: string) => {
    setCityName(nextCityName);
    onChange(formatValidatedCityStateCountry(currentCountry.codigo, currentState.sigla, nextCityName));
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <div>
        <label className="block text-[10px] font-semibold text-slate-400 mb-1">País</label>
        <select
          value={currentCountry.codigo}
          onChange={(e) => handleCountryChange(e.target.value)}
          className={selectClass}
        >
          {VALIDATED_LOCATIONS_CATALOG.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Estado</label>
        <select
          value={currentState.sigla}
          onChange={(e) => handleStateChange(e.target.value)}
          className={selectClass}
        >
          {currentCountry.estados.map((st) => (
            <option key={st.sigla} value={st.sigla}>
              {st.nome} ({st.sigla})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Cidade</label>
        <select
          value={cityName}
          onChange={(e) => handleCityChange(e.target.value)}
          className={selectClass}
        >
          {validatedCities.map((cName) => (
            <option key={cName} value={cName}>
              {cName}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export const DEFAULT_ADMIN_MASTER_BRIGHTNESS = 38;

export const BACKGROUND_BRIGHTNESS_PRESETS: Array<{
  value: number;
  label: string;
  shortLabel: string;
  desc: string;
}> = [
  {
    value: 8,
    label: 'Igapó Profundo',
    shortLabel: 'Escuro',
    desc: 'Noite amazônica profunda em tom petróleo-ardósia frio para ambientes com pouca luz'
  },
  {
    value: 38,
    label: 'Noite Amazônica Conforto',
    shortLabel: 'Conforto',
    desc: 'Fundo noturno esfriado (verde-azulado dessaturado) para uso prolongado sem cansar a vista'
  },
  {
    value: 60,
    label: 'Luar na Copa',
    shortLabel: 'Iluminado',
    desc: 'Penumbra azul-esverdeada suave com contraste elevado e descanso visual'
  },
  {
    value: 85,
    label: 'Neblina da Manhã',
    shortLabel: 'Claro Suave',
    desc: 'Modo claro frio acetinado que não ofusca a leitura'
  },
  {
    value: 100,
    label: 'Claro Diurno',
    shortLabel: 'Claro Total',
    desc: 'Máxima luminosidade para salão ou ambiente aberto'
  }
];

export function clampBrightness(
  raw: unknown,
  fallback: number = DEFAULT_ADMIN_MASTER_BRIGHTNESS
): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

export function describeBrightnessLevel(val: number): string {
  const b = clampBrightness(val);
  if (b <= 15) return 'Igapó Profundo';
  if (b <= 45) return 'Noite Amazônica Conforto';
  if (b <= 72) return 'Luar na Copa';
  if (b <= 90) return 'Neblina da Manhã';
  return 'Claro Diurno';
}

function mixRgbHex(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number
): string {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * clamped);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * clamped);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * clamped);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`.toUpperCase();
}

export function applyBackgroundBrightnessToDom(rawBrightness: number): void {
  if (typeof document === 'undefined') return;
  const b = clampBrightness(rawBrightness);
  const root = document.documentElement;

  let canvasHex = '#0D171D';
  let surfaceHex = '#122027';
  let elevatedHex = '#182A33';
  let recessedHex = '#091116';
  let inputFocusHex = '#0E1B22';
  let sidebarHex = '#0B141A';
  let borderSubtle = 'rgba(148, 184, 198, 0.15)';
  let borderStrong = 'rgba(56, 189, 178, 0.23)';
  let textPrimary = '#F1F5F9';
  let textSecondary = '#CBD5E1';
  let textMuted = '#8899A8';
  const isLightMode = b >= 73;

  if (!isLightMode) {
    const t = b / 72;
    canvasHex = mixRgbHex([7, 13, 17], [18, 32, 39], t);
    surfaceHex = mixRgbHex([11, 20, 26], [24, 42, 51], t);
    elevatedHex = mixRgbHex([16, 28, 36], [32, 54, 65], t);
    recessedHex = mixRgbHex([5, 10, 14], [13, 24, 30], t);
    inputFocusHex = mixRgbHex([9, 17, 23], [19, 35, 43], t);
    sidebarHex = mixRgbHex([6, 12, 16], [15, 27, 34], t);
    borderSubtle = `rgba(148, 184, 198, ${(0.11 + t * 0.08).toFixed(3)})`;
    borderStrong = `rgba(56, 189, 178, ${(0.18 + t * 0.10).toFixed(3)})`;
    textPrimary = '#F1F5F9';
    textSecondary = t >= 0.35 ? '#CBD5E1' : '#B6C5D4';
    textMuted = t >= 0.35 ? '#8899A8' : '#738696';
    document.body.classList.remove('urutau-theme-claro');
  } else {
    const t = (b - 73) / 27;
    canvasHex = mixRgbHex([226, 235, 238], [243, 247, 249], t);
    surfaceHex = mixRgbHex([238, 244, 246], [255, 255, 255], t);
    elevatedHex = mixRgbHex([230, 239, 242], [247, 250, 252], t);
    recessedHex = mixRgbHex([242, 247, 249], [255, 255, 255], t);
    inputFocusHex = '#FFFFFF';
    sidebarHex = mixRgbHex([232, 240, 243], [249, 252, 253], t);
    borderSubtle = `rgba(15, 52, 67, ${(0.13 - t * 0.03).toFixed(3)})`;
    borderStrong = `rgba(15, 52, 67, ${(0.21 - t * 0.04).toFixed(3)})`;
    textPrimary = '#0F1E26';
    textSecondary = '#2B424F';
    textMuted = '#566F7D';
    document.body.classList.add('urutau-theme-claro');
  }

  root.style.setProperty('--urutau-bg-canvas', canvasHex);
  root.style.setProperty('--urutau-bg-surface', surfaceHex);
  root.style.setProperty('--urutau-bg-elevated', elevatedHex);
  root.style.setProperty('--urutau-bg-recessed', recessedHex);
  root.style.setProperty('--urutau-bg-input', recessedHex);
  root.style.setProperty('--urutau-bg-input-focus', inputFocusHex);
  root.style.setProperty('--urutau-bg-sidebar', sidebarHex);
  root.style.setProperty('--urutau-bg-header', sidebarHex);
  root.style.setProperty('--urutau-border-subtle', borderSubtle);
  root.style.setProperty('--urutau-border-strong', borderStrong);
  root.style.setProperty('--urutau-text-primary', textPrimary);
  root.style.setProperty('--urutau-text-secondary', textSecondary);
  root.style.setProperty('--urutau-text-muted', textMuted);

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', canvasHex);
  }
}

export function BackgroundBrightnessControlPanel({
  effectiveBrightness,
  adminMasterBrightness,
  userBrightnessOverride,
  isAdminMaster,
  userName,
  onChangeBrightness,
  compact = false
}: {
  effectiveBrightness: number;
  adminMasterBrightness: number;
  userBrightnessOverride: number | null;
  isAdminMaster: boolean;
  userName?: string;
  onChangeBrightness: (next: number | null) => void;
  compact?: boolean;
}) {
  const safeVal = clampBrightness(effectiveBrightness);
  const safeMaster = clampBrightness(adminMasterBrightness);
  const usingMasterDefault = isAdminMaster || userBrightnessOverride === null || userBrightnessOverride === undefined;

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
            {safeVal >= 73 ? <Sun className="w-4 h-4 shrink-0 text-amber-400" /> : <Moon className="w-4 h-4 shrink-0 text-emerald-400" />}
            <span>Brilho do Fundo do Sistema</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            {isAdminMaster ? (
              <>
                Você está como <strong className="text-slate-100">Admin Master</strong>: o nível escolhido aqui define o{' '}
                <strong className="text-emerald-400">padrão automático de todos os usuários</strong> que não personalizaram o próprio brilho.
              </>
            ) : usingMasterDefault ? (
              <>
                Usando o <strong className="text-emerald-400">padrão do Admin Master ({safeMaster}%)</strong>. Ajuste abaixo se quiser escolher um brilho exclusivo para{' '}
                <strong className="text-slate-100">{userName || 'seu usuário'}</strong>.
              </>
            ) : (
              <>
                Brilho personalizado ativo para <strong className="text-slate-100">{userName || 'seu usuário'}</strong> ({safeVal}%). O padrão atual do Admin Master é{' '}
                <strong className="text-slate-200">{safeMaster}%</strong>.
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-slate-100 tabular-nums">
            {safeVal}% • {describeBrightnessLevel(safeVal)}
          </span>
          {!isAdminMaster && !usingMasterDefault && (
            <button
              type="button"
              onClick={() => onChangeBrightness(null)}
              className="px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
              title="Voltar a seguir automaticamente o brilho definido pelo Admin Master"
            >
              <RotateCcw className="w-3 h-3 shrink-0" />
              <span>Usar Padrão Admin ({safeMaster}%)</span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono uppercase text-slate-400 shrink-0">Escuro</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={safeVal}
            onChange={(e) => onChangeBrightness(clampBrightness(e.target.value))}
            className="w-full accent-[#10B981] h-2 rounded-lg cursor-pointer"
            aria-label="Ajustar brilho do fundo"
          />
          <span className="text-[10px] font-mono uppercase text-slate-400 shrink-0">Claro</span>
        </div>
      </div>

      <div className={`grid ${compact ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-5'} gap-2`}>
        {BACKGROUND_BRIGHTNESS_PRESETS.map((preset) => {
          const isSelected = Math.abs(safeVal - preset.value) <= 3;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChangeBrightness(preset.value)}
              className={`px-2.5 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#10B981]/20 border-[#10B981] text-slate-100 ring-1 ring-[#10B981]/40'
                  : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
              title={preset.desc}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold truncate">
                  {compact ? preset.shortLabel : preset.label}
                </span>
                <span className="text-[10px] font-mono font-semibold text-emerald-400 tabular-nums">
                  {preset.value}%
                </span>
              </div>
              {!compact && (
                <div className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-2">
                  {preset.desc}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}