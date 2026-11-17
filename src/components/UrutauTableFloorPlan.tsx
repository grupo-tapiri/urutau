import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Crosshair,
  Download,
  Edit3,
  FolderOpen,
  Grid,
  Layers,
  Link2,
  Lock,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Minus,
  Move,
  Plus,
  RotateCw,
  Save,
  Search,
  Trash2,
  Unlink,
  Unlock,
  Upload,
  Users,
  Utensils,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { ComandaPdv } from '../types/erp';

export interface FloorEnvironmentZone {
  id: string;
  nome: string;
  corHex: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  tipoZona: 'ambiente' | 'bar' | 'palco' | 'entrada';
}

export type SeatCapacityOption = 2 | 3 | 4 | 6 | 8 | 10 | 12;

export interface FloorTableSeatSet {
  id: string;
  codigo: string;
  ambienteId: string;
  ambienteNome: string;
  lugares: SeatCapacityOption;
  formato: 'quadrada' | 'redonda' | 'retangular';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  reservaVinculadaId?: number | null;
}

export interface FloorPlanLayoutState {
  canvasWidth?: number;
  canvasHeight?: number;
  environments: FloorEnvironmentZone[];
  tables: FloorTableSeatSet[];
}

export interface SavedFloorPlanTemplate {
  id: string;
  nome: string;
  descricao?: string;
  tipo: 'builtin' | 'custom';
  layout: FloorPlanLayoutState;
  criadoEm?: string;
}

export interface NewReservaAtTablePayload {
  mesa: string;
  mesas_vinculadas?: string[];
  area: string;
  lugares: number;
  data?: string;
}

interface UrutauTableFloorPlanProps {
  reservas: any[];
  pdvComandas?: ComandaPdv[];
  configs?: { chave: string; valor_json: any; atualizado_em?: string }[];
  unidadeId?: number;
  empresaId?: number | null;
  currentUser?: any;
  areaFiltro: string;
  onChangeAreaFiltro: (area: string) => void;
  onOpenEditReserva: (reserva: any) => void;
  onOpenNewReservaAtTable: (payload: NewReservaAtTablePayload) => void;
  onOpenTableInPdv?: (payload: { mesaCodigo: string; comandaId?: number | null }) => void;
  onRefresh: () => Promise<void>;
  showAlert: (title: string, message: string) => void;
}

const FLOOR_PLAN_STORAGE_KEY = 'urutau_reservas_floor_plan_v2';
const FLOOR_PLAN_TEMPLATES_KEY = 'urutau_floor_plan_templates_v2';

const SEAT_OPTIONS: SeatCapacityOption[] = [2, 3, 4, 6, 8, 10, 12];

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function addDaysISO(iso: string, delta: number): string {
  const [y, m, d] = String(iso || getTodayISO()).split('-').map(Number);
  const dt = new Date(y || 2026, (m || 1) - 1, (d || 1) + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function formatShortDateBR(iso: string): string {
  const parts = String(iso || '').split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

function formatBRLCompact(val: number): string {
  return Number(val || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function normalizeTableCode(raw: any): string {
  return String(raw || '')
    .trim()
    .replace(/^mesa\s+/i, '')
    .trim()
    .toUpperCase();
}

function doesComandaMatchTable(comanda: ComandaPdv, tableCodigo: string): boolean {
  const tNorm = normalizeTableCode(tableCodigo);
  if (!tNorm) return false;
  const cMesa = normalizeTableCode(comanda.mesa_numero);
  const cIdent = normalizeTableCode(comanda.identificador);
  if (cMesa && cMesa === tNorm) return true;
  if (cIdent && cIdent === tNorm) return true;

  const tDigitsMatch = tNorm.match(/^M-?0*(\d+)$/i) || tNorm.match(/^0*(\d+)$/);
  if (tDigitsMatch) {
    const tNum = tDigitsMatch[1];
    const cMesaNumMatch = cMesa.match(/^M-?0*(\d+)$/i) || cMesa.match(/^0*(\d+)$/);
    if (cMesaNumMatch && cMesaNumMatch[1] === tNum) return true;
    const cIdentNumMatch = cIdent.match(/^M-?0*(\d+)$/i) || cIdent.match(/^0*(\d+)$/);
    if (cIdentNumMatch && cIdentNumMatch[1] === tNum) return true;
  }
  return false;
}

function getDefaultDimensionsForSeatCount(
  lugares: SeatCapacityOption,
  formato: 'quadrada' | 'redonda' | 'retangular'
): { width: number; height: number } {
  if (formato === 'redonda') {
    if (lugares <= 2) return { width: 68, height: 68 };
    if (lugares <= 4) return { width: 78, height: 78 };
    if (lugares <= 6) return { width: 92, height: 92 };
    return { width: 108, height: 108 };
  }
  if (lugares <= 2) return { width: 68, height: 64 };
  if (lugares === 3) return { width: 74, height: 68 };
  if (lugares === 4) return formato === 'retangular' ? { width: 88, height: 68 } : { width: 76, height: 74 };
  if (lugares === 6) return { width: 106, height: 74 };
  if (lugares === 8) return { width: 126, height: 78 };
  if (lugares === 10) return { width: 146, height: 82 };
  return { width: 164, height: 86 };
}

function computeReservaPax(r: any): number {
  return (
    Math.max(0, Number(r?.adultos_pagantes || 0)) +
    Math.max(0, Number(r?.adultos_frequentadores || 0)) +
    Math.max(0, Number(r?.criancas_pagantes || 0)) +
    Math.max(0, Number(r?.criancas_frequentadores || 0))
  );
}

function getReservaJoinedCodes(r: any): string[] {
  const primary = String(r?.mesa || '').trim();
  const extras = Array.isArray(r?.mesas_vinculadas)
    ? r.mesas_vinculadas.map((m: any) => String(m || '').trim()).filter(Boolean)
    : [];
  return Array.from(new Set([primary, ...extras].filter(Boolean)));
}

function resolveCanvasBounds(layout: FloorPlanLayoutState): { width: number; height: number } {
  let maxRight = Number(layout.canvasWidth || 0);
  let maxBottom = Number(layout.canvasHeight || 0);

  for (const env of layout.environments || []) {
    maxRight = Math.max(maxRight, Number(env.x || 0) + Number(env.width || 0) + 60);
    maxBottom = Math.max(maxBottom, Number(env.y || 0) + Number(env.height || 0) + 60);
  }
  for (const tbl of layout.tables || []) {
    maxRight = Math.max(maxRight, Number(tbl.x || 0) + Number(tbl.width || 0) + 60);
    maxBottom = Math.max(maxBottom, Number(tbl.y || 0) + Number(tbl.height || 0) + 60);
  }

  return {
    width: Math.min(4600, Math.max(960, Math.round(maxRight || 1200))),
    height: Math.min(3400, Math.max(600, Math.round(maxBottom || 720)))
  };
}

const DEFAULT_TAPIRI_LAYOUT: FloorPlanLayoutState = {
  canvasWidth: 1120,
  canvasHeight: 680,
  environments: [
    {
      id: 'env_salao_principal',
      nome: 'Salão Principal',
      corHex: '#10B981',
      x: 30,
      y: 96,
      width: 620,
      height: 540,
      rotation: 0,
      tipoZona: 'ambiente'
    },
    {
      id: 'env_varanda',
      nome: 'Varanda Cumaru',
      corHex: '#F59E0B',
      x: 676,
      y: 96,
      width: 410,
      height: 300,
      rotation: 0,
      tipoZona: 'ambiente'
    },
    {
      id: 'env_vip',
      nome: 'Sala VIP Copaíba',
      corHex: '#0EA5E9',
      x: 676,
      y: 416,
      width: 410,
      height: 220,
      rotation: 0,
      tipoZona: 'ambiente'
    },
    {
      id: 'env_entrada',
      nome: 'Recepção & Entrada',
      corHex: '#64748B',
      x: 30,
      y: 24,
      width: 310,
      height: 54,
      rotation: 0,
      tipoZona: 'entrada'
    },
    {
      id: 'env_bar',
      nome: 'Bar & Expedição',
      corHex: '#06B6D4',
      x: 360,
      y: 24,
      width: 420,
      height: 54,
      rotation: 0,
      tipoZona: 'bar'
    },
    {
      id: 'env_palco',
      nome: 'Palco Acústico',
      corHex: '#8B5CF6',
      x: 800,
      y: 24,
      width: 286,
      height: 54,
      rotation: 0,
      tipoZona: 'palco'
    }
  ],
  tables: [
    { id: 't_m01', codigo: 'M-01', ambienteId: 'env_salao_principal', ambienteNome: 'Salão Principal', lugares: 4, formato: 'quadrada', x: 70, y: 155, width: 78, height: 74, rotation: 0 },
    { id: 't_m02', codigo: 'M-02', ambienteId: 'env_salao_principal', ambienteNome: 'Salão Principal', lugares: 2, formato: 'quadrada', x: 240, y: 155, width: 68, height: 64, rotation: 0 },
    { id: 't_m03', codigo: 'M-03', ambienteId: 'env_salao_principal', ambienteNome: 'Salão Principal', lugares: 4, formato: 'quadrada', x: 400, y: 155, width: 78, height: 74, rotation: 0 },
    { id: 't_m04', codigo: 'M-04', ambienteId: 'env_salao_principal', ambienteNome: 'Salão Principal', lugares: 6, formato: 'retangular', x: 70, y: 310, width: 106, height: 74, rotation: 0 },
    { id: 't_m05', codigo: 'M-05', ambienteId: 'env_salao_principal', ambienteNome: 'Salão Principal', lugares: 4, formato: 'redonda', x: 255, y: 310, width: 78, height: 78, rotation: 0 },
    { id: 't_m06', codigo: 'M-06', ambienteId: 'env_salao_principal', ambienteNome: 'Salão Principal', lugares: 4, formato: 'quadrada', x: 415, y: 310, width: 78, height: 74, rotation: 0 },
    { id: 't_m07', codigo: 'M-07', ambienteId: 'env_salao_principal', ambienteNome: 'Salão Principal', lugares: 6, formato: 'retangular', x: 70, y: 470, width: 106, height: 74, rotation: 0 },
    { id: 't_m08', codigo: 'M-08', ambienteId: 'env_salao_principal', ambienteNome: 'Salão Principal', lugares: 4, formato: 'quadrada', x: 255, y: 470, width: 78, height: 74, rotation: 0 },
    { id: 't_v01', codigo: 'V-01', ambienteId: 'env_varanda', ambienteNome: 'Varanda Cumaru', lugares: 2, formato: 'redonda', x: 715, y: 165, width: 68, height: 68, rotation: 0 },
    { id: 't_v02', codigo: 'V-02', ambienteId: 'env_varanda', ambienteNome: 'Varanda Cumaru', lugares: 4, formato: 'quadrada', x: 845, y: 165, width: 78, height: 74, rotation: 0 },
    { id: 't_v03', codigo: 'V-03', ambienteId: 'env_varanda', ambienteNome: 'Varanda Cumaru', lugares: 4, formato: 'quadrada', x: 975, y: 165, width: 78, height: 74, rotation: 0 },
    { id: 't_vip01', codigo: 'VIP-01', ambienteId: 'env_vip', ambienteNome: 'Sala VIP Copaíba', lugares: 8, formato: 'retangular', x: 715, y: 495, width: 126, height: 78, rotation: 0 },
    { id: 't_vip02', codigo: 'VIP-02', ambienteId: 'env_vip', ambienteNome: 'Sala VIP Copaíba', lugares: 8, formato: 'retangular', x: 905, y: 495, width: 126, height: 78, rotation: 0 }
  ]
};

function buildGrandeOperacao67Layout(): FloorPlanLayoutState {
  const environments: FloorEnvironmentZone[] = [
    {
      id: 'env_recepcao_67',
      nome: 'Recepção & Hostess',
      corHex: '#64748B',
      x: 40,
      y: 28,
      width: 480,
      height: 62,
      rotation: 0,
      tipoZona: 'entrada'
    },
    {
      id: 'env_bar_central_67',
      nome: 'Bar Central & Copa',
      corHex: '#06B6D4',
      x: 550,
      y: 28,
      width: 1080,
      height: 62,
      rotation: 0,
      tipoZona: 'bar'
    },
    {
      id: 'env_palco_67',
      nome: 'Palco & Som Ambiente',
      corHex: '#8B5CF6',
      x: 1660,
      y: 28,
      width: 580,
      height: 62,
      rotation: 0,
      tipoZona: 'palco'
    },
    {
      id: 'env_salao_central_67',
      nome: 'Salão Principal',
      corHex: '#10B981',
      x: 40,
      y: 116,
      width: 1240,
      height: 760,
      rotation: 0,
      tipoZona: 'ambiente'
    },
    {
      id: 'env_varanda_coberta_67',
      nome: 'Varanda Coberta',
      corHex: '#F59E0B',
      x: 1310,
      y: 116,
      width: 930,
      height: 760,
      rotation: 0,
      tipoZona: 'ambiente'
    },
    {
      id: 'env_deck_jardim_67',
      nome: 'Deck & Área Externa',
      corHex: '#22C55E',
      x: 40,
      y: 908,
      width: 1240,
      height: 490,
      rotation: 0,
      tipoZona: 'ambiente'
    },
    {
      id: 'env_familia_vip_67',
      nome: 'Espaço Família & VIP',
      corHex: '#0EA5E9',
      x: 1310,
      y: 908,
      width: 930,
      height: 490,
      rotation: 0,
      tipoZona: 'ambiente'
    }
  ];

  const tables: FloorTableSeatSet[] = [];
  let seq = 1;
  const nextCode = () => `M-${String(seq++).padStart(2, '0')}`;

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 8; col++) {
      const codigo = nextCode();
      const lugares: SeatCapacityOption = row === 3 && col % 2 === 0 ? 6 : col % 4 === 1 ? 2 : 4;
      const formato = lugares === 6 ? 'retangular' : col % 4 === 3 ? 'redonda' : 'quadrada';
      const dims = getDefaultDimensionsForSeatCount(lugares, formato);
      tables.push({
        id: `tbl_67_${codigo}`,
        codigo,
        ambienteId: 'env_salao_central_67',
        ambienteNome: 'Salão Principal',
        lugares,
        formato,
        x: 76 + col * 148,
        y: 184 + row * 168,
        width: dims.width,
        height: dims.height,
        rotation: 0
      });
    }
  }

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const codigo = nextCode();
      const lugares: SeatCapacityOption = row === 2 && col % 2 === 1 ? 6 : col % 3 === 0 ? 2 : 4;
      const formato = lugares === 6 ? 'retangular' : row === 1 ? 'redonda' : 'quadrada';
      const dims = getDefaultDimensionsForSeatCount(lugares, formato);
      tables.push({
        id: `tbl_67_${codigo}`,
        codigo,
        ambienteId: 'env_varanda_coberta_67',
        ambienteNome: 'Varanda Coberta',
        lugares,
        formato,
        x: 1348 + col * 148,
        y: 196 + row * 214,
        width: dims.width,
        height: dims.height,
        rotation: 0
      });
    }
  }

  for (let idx = 0; idx < 11; idx++) {
    const row = idx < 6 ? 0 : 1;
    const col = idx < 6 ? idx : idx - 6;
    const codigo = nextCode();
    const lugares: SeatCapacityOption = idx >= 8 ? 6 : 4;
    const formato = lugares === 6 ? 'retangular' : 'redonda';
    const dims = getDefaultDimensionsForSeatCount(lugares, formato);
    tables.push({
      id: `tbl_67_${codigo}`,
      codigo,
      ambienteId: 'env_deck_jardim_67',
      ambienteNome: 'Deck & Área Externa',
      lugares,
      formato,
      x: 84 + col * 196,
      y: 988 + row * 192,
      width: dims.width,
      height: dims.height,
      rotation: 0
    });
  }

  for (let idx = 0; idx < 6; idx++) {
    const row = idx < 3 ? 0 : 1;
    const col = idx < 3 ? idx : idx - 3;
    const codigo = nextCode();
    const lugares: SeatCapacityOption = row === 1 && col === 1 ? 10 : row === 1 ? 8 : 6;
    const dims = getDefaultDimensionsForSeatCount(lugares, 'retangular');
    tables.push({
      id: `tbl_67_${codigo}`,
      codigo,
      ambienteId: 'env_familia_vip_67',
      ambienteNome: 'Espaço Família & VIP',
      lugares,
      formato: 'retangular',
      x: 1358 + col * 292,
      y: 992 + row * 192,
      width: dims.width,
      height: dims.height,
      rotation: 0
    });
  }

  return {
    canvasWidth: 2290,
    canvasHeight: 1450,
    environments,
    tables
  };
}

function buildMedioPorte36Layout(): FloorPlanLayoutState {
  const environments: FloorEnvironmentZone[] = [
    {
      id: 'env_med_entrada',
      nome: 'Entrada & Recepção',
      corHex: '#64748B',
      x: 40,
      y: 26,
      width: 420,
      height: 56,
      rotation: 0,
      tipoZona: 'entrada'
    },
    {
      id: 'env_med_bar',
      nome: 'Bar & Caixa',
      corHex: '#06B6D4',
      x: 486,
      y: 26,
      width: 680,
      height: 56,
      rotation: 0,
      tipoZona: 'bar'
    },
    {
      id: 'env_med_salao',
      nome: 'Salão Central',
      corHex: '#10B981',
      x: 40,
      y: 104,
      width: 1040,
      height: 680,
      rotation: 0,
      tipoZona: 'ambiente'
    },
    {
      id: 'env_med_terrazo',
      nome: 'Terraço Externo',
      corHex: '#F59E0B',
      x: 1110,
      y: 104,
      width: 560,
      height: 680,
      rotation: 0,
      tipoZona: 'ambiente'
    }
  ];

  const tables: FloorTableSeatSet[] = [];
  let seq = 1;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      const codigo = `M-${String(seq++).padStart(2, '0')}`;
      const lugares: SeatCapacityOption = r === 3 ? 6 : 4;
      const dims = getDefaultDimensionsForSeatCount(lugares, lugares === 6 ? 'retangular' : 'quadrada');
      tables.push({
        id: `tbl_med_${codigo}`,
        codigo,
        ambienteId: 'env_med_salao',
        ambienteNome: 'Salão Central',
        lugares,
        formato: lugares === 6 ? 'retangular' : 'quadrada',
        x: 78 + c * 162,
        y: 170 + r * 150,
        width: dims.width,
        height: dims.height,
        rotation: 0
      });
    }
  }
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const codigo = `M-${String(seq++).padStart(2, '0')}`;
      const lugares: SeatCapacityOption = c === 2 ? 4 : 2;
      const dims = getDefaultDimensionsForSeatCount(lugares, 'redonda');
      tables.push({
        id: `tbl_med_${codigo}`,
        codigo,
        ambienteId: 'env_med_terrazo',
        ambienteNome: 'Terraço Externo',
        lugares,
        formato: 'redonda',
        x: 1152 + c * 172,
        y: 174 + r * 150,
        width: dims.width,
        height: dims.height,
        rotation: 0
      });
    }
  }

  return {
    canvasWidth: 1720,
    canvasHeight: 830,
    environments,
    tables
  };
}

const BUILTIN_TEMPLATES: SavedFloorPlanTemplate[] = [
  {
    id: 'builtin_grande_operacao_67',
    nome: 'Grande Operação (67 Mesas / 276 Lugares)',
    descricao: 'Planta ampla distribuída em Salão Principal (32), Varanda (18), Deck Externo (11) e VIP/Família (6), projetada para 250+ clientes.',
    tipo: 'builtin',
    layout: buildGrandeOperacao67Layout()
  },
  {
    id: 'builtin_medio_porte_36',
    nome: 'Restaurante Médio Porte (36 Mesas / 148 Lugares)',
    descricao: 'Salão Central com 24 mesas e Terraço Externo com 12 mesas em corredores amplos.',
    tipo: 'builtin',
    layout: buildMedioPorte36Layout()
  },
  {
    id: 'builtin_tapiri_original',
    nome: 'Tapiri Compacto (13 Mesas / 56 Lugares)',
    descricao: 'Planta compacta com Salão Principal, Varanda Cumaru e Sala VIP Copaíba.',
    tipo: 'builtin',
    layout: DEFAULT_TAPIRI_LAYOUT
  }
];

function sanitizeLoadedLayout(raw: any): FloorPlanLayoutState | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!Array.isArray(raw.environments) || !Array.isArray(raw.tables)) return null;
  const envs: FloorEnvironmentZone[] = raw.environments.map((e: any, idx: number) => ({
    id: String(e.id || `env_${idx}`),
    nome: String(e.nome || `Ambiente ${idx + 1}`),
    corHex: String(e.corHex || '#10B981'),
    x: Number(e.x || 20),
    y: Number(e.y || 20),
    width: Math.max(80, Number(e.width || 300)),
    height: Math.max(48, Number(e.height || 200)),
    rotation: Number(e.rotation || 0),
    tipoZona: ['ambiente', 'bar', 'palco', 'entrada'].includes(e.tipoZona) ? e.tipoZona : 'ambiente'
  }));
  const tables: FloorTableSeatSet[] = raw.tables.map((t: any, idx: number) => {
    const rawLug = Number(t.lugares || 4);
    const lugares: SeatCapacityOption = (SEAT_OPTIONS.includes(rawLug as SeatCapacityOption)
      ? rawLug
      : 4) as SeatCapacityOption;
    const formato: 'quadrada' | 'redonda' | 'retangular' = ['quadrada', 'redonda', 'retangular'].includes(t.formato)
      ? t.formato
      : 'quadrada';
    const defDims = getDefaultDimensionsForSeatCount(lugares, formato);
    return {
      id: String(t.id || `tbl_${idx}`),
      codigo: String(t.codigo || `M-${String(idx + 1).padStart(2, '0')}`),
      ambienteId: String(t.ambienteId || envs[0]?.id || 'env_salao_principal'),
      ambienteNome: String(t.ambienteNome || envs[0]?.nome || 'Salão Principal'),
      lugares,
      formato,
      x: Number(t.x || 60),
      y: Number(t.y || 120),
      width: Math.max(52, Number(t.width || defDims.width)),
      height: Math.max(52, Number(t.height || defDims.height)),
      rotation: Number(t.rotation || 0),
      reservaVinculadaId: t.reservaVinculadaId ?? null
    };
  });
  const candidate: FloorPlanLayoutState = {
    canvasWidth: raw.canvasWidth ? Number(raw.canvasWidth) : undefined,
    canvasHeight: raw.canvasHeight ? Number(raw.canvasHeight) : undefined,
    environments: envs,
    tables
  };
  const bounds = resolveCanvasBounds(candidate);
  return {
    ...candidate,
    canvasWidth: bounds.width,
    canvasHeight: bounds.height
  };
}

function renderSeatTicks(table: FloorTableSeatSet): React.ReactNode[] {
  const count = table.lugares;
  const nodes: React.ReactNode[] = [];
  if (table.formato === 'redonda') {
    const radiusX = table.width / 2 + 5;
    const radiusY = table.height / 2 + 5;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const cx = table.width / 2 + Math.cos(angle) * radiusX;
      const cy = table.height / 2 + Math.sin(angle) * radiusY;
      nodes.push(
        <span
          key={i}
          style={{
            left: `${cx - 5}px`,
            top: `${cy - 5}px`
          }}
          className="absolute w-2.5 h-2.5 rounded-full bg-slate-300/60 border border-slate-900/60 pointer-events-none"
        />
      );
    }
    return nodes;
  }

  const topCount = Math.ceil(count / 2);
  const bottomCount = count - topCount;
  for (let i = 0; i < topCount; i++) {
    const pct = ((i + 1) / (topCount + 1)) * 100;
    nodes.push(
      <span
        key={`t_${i}`}
        style={{ left: `calc(${pct}% - 6px)`, top: '-6px' }}
        className="absolute w-3 h-1.5 rounded-t bg-slate-300/65 pointer-events-none"
      />
    );
  }
  for (let i = 0; i < bottomCount; i++) {
    const pct = ((i + 1) / (bottomCount + 1)) * 100;
    nodes.push(
      <span
        key={`b_${i}`}
        style={{ left: `calc(${pct}% - 6px)`, bottom: '-6px' }}
        className="absolute w-3 h-1.5 rounded-b bg-slate-300/65 pointer-events-none"
      />
    );
  }
  return nodes;
}

export const UrutauTableFloorPlan: React.FC<UrutauTableFloorPlanProps> = ({
  reservas,
  pdvComandas = [],
  configs = [],
  unidadeId = 1,
  empresaId = null,
  currentUser,
  areaFiltro,
  onChangeAreaFiltro,
  onOpenEditReserva,
  onOpenNewReservaAtTable,
  onOpenTableInPdv,
  onRefresh,
  showAlert
}) => {
  const [layout, setLayout] = useState<FloorPlanLayoutState>(() => {
    try {
      const fromServer = configs.find((c) => c.chave === 'mapa_mesas_salao_layout')?.valor_json;
      const cleanServer = sanitizeLoadedLayout(fromServer);
      if (cleanServer && cleanServer.tables.length > 0) return cleanServer;

      const rawLocal = localStorage.getItem(FLOOR_PLAN_STORAGE_KEY);
      if (rawLocal) {
        const cleanLocal = sanitizeLoadedLayout(JSON.parse(rawLocal));
        if (cleanLocal && cleanLocal.tables.length > 0) return cleanLocal;
      }
    } catch {}
    return buildGrandeOperacao67Layout();
  });

  const [customTemplates, setCustomTemplates] = useState<SavedFloorPlanTemplate[]>(() => {
    try {
      const raw = localStorage.getItem(FLOOR_PLAN_TEMPLATES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [editMode, setEditMode] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showMinimap, setShowMinimap] = useState<boolean>(true);
  const [savingLayout, setSavingLayout] = useState<boolean>(false);
  const [dirtyLayout, setDirtyLayout] = useState<boolean>(false);

  const [modoData, setModoData] = useState<'dia' | 'periodo'>('dia');
  const [diaSelecionado, setDiaSelecionado] = useState<string>(getTodayISO());
  const [periodoInicio, setPeriodoInicio] = useState<string>(getTodayISO());
  const [periodoFim, setPeriodoFim] = useState<string>(addDaysISO(getTodayISO(), 6));

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSectorId, setActiveSectorId] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [highlightedTableId, setHighlightedTableId] = useState<string | null>(null);

  const [linkingReservaId, setLinkingReservaId] = useState<string>('');
  const [savingAction, setSavingAction] = useState<boolean>(false);
  const [joinPickerOpen, setJoinPickerOpen] = useState<boolean>(false);
  const [joinReservaTargetId, setJoinReservaTargetId] = useState<number | null>(null);
  const [joinSelectedCodes, setJoinSelectedCodes] = useState<string[]>([]);
  const [joinSearchFilter, setJoinSearchFilter] = useState<string>('');

  const [walkInNome, setWalkInNome] = useState<string>('');
  const [walkInPessoas, setWalkInPessoas] = useState<number>(2);

  const [modalBatchOpen, setModalBatchOpen] = useState<boolean>(false);
  const [batchPrefix, setBatchPrefix] = useState<string>('M-');
  const [batchStartNum, setBatchStartNum] = useState<number>(1);
  const [batchCount, setBatchCount] = useState<number>(67);
  const [batchDigits, setBatchDigits] = useState<number>(2);
  const [batchSeats, setBatchSeats] = useState<SeatCapacityOption>(4);
  const [batchShape, setBatchShape] = useState<'quadrada' | 'redonda' | 'retangular'>('quadrada');
  const [batchCols, setBatchCols] = useState<number>(8);
  const [batchEnvMode, setBatchEnvMode] = useState<string>('auto_setores_67');
  const [batchNewEnvName, setBatchNewEnvName] = useState<string>('Salão Principal');
  const [batchReplaceExisting, setBatchReplaceExisting] = useState<boolean>(true);

  const [modalModelosOpen, setModalModelosOpen] = useState<boolean>(false);
  const [modalSalvarComoOpen, setModalSalvarComoOpen] = useState<boolean>(false);
  const [modalLimparOpen, setModalLimparOpen] = useState<boolean>(false);
  const [modalDimensoesOpen, setModalDimensoesOpen] = useState<boolean>(false);
  const [nomeNovoModelo, setNomeNovoModelo] = useState<string>('');
  const [descNovoModelo, setDescNovoModelo] = useState<string>('');

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [camera, setCamera] = useState<{ panX: number; panY: number; zoom: number }>({
    panX: 24,
    panY: 24,
    zoom: 0.65
  });
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({ w: 960, h: 560 });
  const [smoothCameraTransition, setSmoothCameraTransition] = useState<boolean>(false);

  const gestureRef = useRef<{
    type: 'none' | 'pan' | 'pinch' | 'item_move' | 'item_resize' | 'item_rotate';
    pointerId?: number;
    startClientX: number;
    startClientY: number;
    movedDistance: number;
    initialPanX: number;
    initialPanY: number;
    initialZoom: number;
    pinchInitialDist: number;
    pinchMidX: number;
    pinchMidY: number;
    targetKind?: 'table' | 'env';
    targetId?: string;
    itemOrigX?: number;
    itemOrigY?: number;
    itemOrigW?: number;
    itemOrigH?: number;
    itemCenterX?: number;
    itemCenterY?: number;
  }>({
    type: 'none',
    startClientX: 0,
    startClientY: 0,
    movedDistance: 0,
    initialPanX: 0,
    initialPanY: 0,
    initialZoom: 1,
    pinchInitialDist: 1,
    pinchMidX: 0,
    pinchMidY: 0
  });

  const canvasBounds = useMemo(() => resolveCanvasBounds(layout), [layout]);

  useEffect(() => {
    try {
      localStorage.setItem(FLOOR_PLAN_STORAGE_KEY, JSON.stringify(layout));
      window.dispatchEvent(new Event('urutau-floor-plan-updated'));
    } catch {}
  }, [layout]);

  useEffect(() => {
    const handleExternalTableAdded = (ev: Event) => {
      const customEv = ev as CustomEvent<{
        table?: {
          codigo: string;
          ambienteNome: string;
          lugares: number;
          formato?: 'quadrada' | 'redonda' | 'retangular';
        };
        environment?: {
          nome: string;
        };
      }>;
      const detail = customEv.detail;
      if (!detail) return;

      setLayout((prev) => {
        let nextEnvironments = [...(prev.environments || [])];
        let nextTables = [...(prev.tables || [])];
        let changed = false;

        const envTargetName = String(
          detail.environment?.nome || detail.table?.ambienteNome || ''
        ).trim();

        let matchedEnv = nextEnvironments.find(
          (e) =>
            (e.tipoZona === 'ambiente' || !e.tipoZona) &&
            String(e.nome || '').trim().toLowerCase() === envTargetName.toLowerCase()
        );

        if (envTargetName && !matchedEnv) {
          const newEnv: FloorEnvironmentZone = {
            id: `env_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            nome: envTargetName,
            corHex: '#10B981',
            x: 40 + (nextEnvironments.length % 3) * 420,
            y: 96 + Math.floor(nextEnvironments.length / 3) * 340,
            width: 390,
            height: 300,
            rotation: 0,
            tipoZona: 'ambiente'
          };
          nextEnvironments.push(newEnv);
          matchedEnv = newEnv;
          changed = true;
        }

        if (detail.table?.codigo) {
          const codeClean = String(detail.table.codigo).trim();
          const alreadyExists = nextTables.some(
            (t) => normalizeTableCode(t.codigo) === normalizeTableCode(codeClean)
          );
          if (!alreadyExists && codeClean) {
            const rawSeats = Number(detail.table.lugares || 4);
            const validSeats: SeatCapacityOption = ([2, 3, 4, 6, 8, 10, 12].find(
              (s) => s >= rawSeats
            ) || 4) as SeatCapacityOption;
            const fmt: 'quadrada' | 'redonda' | 'retangular' =
              detail.table.formato && ['quadrada', 'redonda', 'retangular'].includes(detail.table.formato)
                ? detail.table.formato
                : 'quadrada';
            const dims = getDefaultDimensionsForSeatCount(validSeats, fmt);
            const envObj =
              matchedEnv ||
              nextEnvironments.find((e) => e.tipoZona === 'ambiente') ||
              nextEnvironments[0];
            const envTablesCount = nextTables.filter(
              (t) => t.ambienteNome === (envTargetName || envObj?.nome || 'Salão Principal')
            ).length;
            const baseX = envObj ? Number(envObj.x) + 28 : 60;
            const baseY = envObj ? Number(envObj.y) + 52 : 140;

            const newTbl: FloorTableSeatSet = {
              id: `tbl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              codigo: codeClean,
              ambienteId: envObj?.id || 'env_salao_principal',
              ambienteNome: envTargetName || envObj?.nome || 'Salão Principal',
              lugares: validSeats,
              formato: fmt,
              x: baseX + (envTablesCount % 4) * 92,
              y: baseY + Math.floor(envTablesCount / 4) * 86,
              width: dims.width,
              height: dims.height,
              rotation: 0
            };
            nextTables.push(newTbl);
            changed = true;
          }
        }

        if (!changed) return prev;
        const nextLayout: FloorPlanLayoutState = {
          ...prev,
          environments: nextEnvironments,
          tables: nextTables
        };
        fetch('/api/erp/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chave: 'mapa_mesas_salao_layout',
            valor: nextLayout,
            empresa_id: empresaId
          })
        }).catch(() => {});
        return nextLayout;
      });
    };

    window.addEventListener('urutau-external-floor-plan-table-added', handleExternalTableAdded);
    return () => {
      window.removeEventListener('urutau-external-floor-plan-table-added', handleExternalTableAdded);
    };
  }, [empresaId]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const updateRect = () => {
      setViewportSize({
        w: Math.max(280, el.clientWidth),
        h: Math.max(280, el.clientHeight)
      });
    };
    updateRect();
    const ro = new ResizeObserver(updateRect);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isFullscreen]);

  const animateCameraTo = useCallback((next: { panX: number; panY: number; zoom: number }) => {
    setSmoothCameraTransition(true);
    setCamera({
      panX: Math.round(next.panX),
      panY: Math.round(next.panY),
      zoom: Number(Math.min(2.2, Math.max(0.2, next.zoom)).toFixed(3))
    });
    window.setTimeout(() => setSmoothCameraTransition(false), 190);
  }, []);

  const fitRectInViewport = useCallback(
    (rect: { minX: number; minY: number; maxX: number; maxY: number }, maxZoomCap = 1.25) => {
      const el = viewportRef.current;
      const vw = el ? el.clientWidth : viewportSize.w;
      const vh = el ? el.clientHeight : viewportSize.h;
      const pad = vw < 640 ? 20 : 36;
      const contentW = Math.max(180, rect.maxX - rect.minX);
      const contentH = Math.max(160, rect.maxY - rect.minY);
      const scaleX = (vw - pad * 2) / contentW;
      const scaleY = (vh - pad * 2) / contentH;
      const nextZoom = Math.min(maxZoomCap, Math.max(0.22, Math.min(scaleX, scaleY)));
      const centerX = (rect.minX + rect.maxX) / 2;
      const centerY = (rect.minY + rect.maxY) / 2;
      animateCameraTo({
        zoom: nextZoom,
        panX: vw / 2 - centerX * nextZoom,
        panY: vh / 2 - centerY * nextZoom
      });
    },
    [animateCameraTo, viewportSize.h, viewportSize.w]
  );

  const fitAllSalon = useCallback(() => {
    const items = [...layout.environments, ...layout.tables];
    if (items.length === 0) {
      fitRectInViewport({ minX: 0, minY: 0, maxX: canvasBounds.width, maxY: canvasBounds.height }, 1.0);
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const it of items) {
      minX = Math.min(minX, it.x);
      minY = Math.min(minY, it.y);
      maxX = Math.max(maxX, it.x + it.width);
      maxY = Math.max(maxY, it.y + it.height);
    }
    fitRectInViewport({ minX: minX - 24, minY: minY - 24, maxX: maxX + 24, maxY: maxY + 24 }, 1.15);
  }, [canvasBounds.height, canvasBounds.width, fitRectInViewport, layout.environments, layout.tables]);

  const initialFitDoneRef = useRef<boolean>(false);
  useEffect(() => {
    if (!initialFitDoneRef.current && viewportSize.w > 300) {
      initialFitDoneRef.current = true;
      fitAllSalon();
    }
  }, [fitAllSalon, viewportSize.w]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fitAllSalon();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [isFullscreen]);

  const ambienteZones = useMemo(
    () => layout.environments.filter((e) => e.tipoZona === 'ambiente'),
    [layout.environments]
  );

  const activeReservasInWindow = useMemo(() => {
    return (reservas || []).filter((r: any) => {
      if (r.arquivado_legal) return false;
      if (String(r.status || '').toLowerCase() === 'encerrada') return false;
      const d = String(r.data || getTodayISO());
      if (modoData === 'dia') return d === diaSelecionado;
      return d >= periodoInicio && d <= periodoFim;
    });
  }, [diaSelecionado, modoData, periodoFim, periodoInicio, reservas]);

  const openMesaComandas = useMemo(() => {
    return (pdvComandas || []).filter(
      (c) =>
        !c.arquivado_legal &&
        c.status !== 'fechada' &&
        c.status !== 'cancelada' &&
        (c.modalidade === 'mesa' || Boolean(c.mesa_numero))
    );
  }, [pdvComandas]);

  const reservasByTableId = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const t of layout.tables) {
      const tNorm = normalizeTableCode(t.codigo);
      map[t.id] = activeReservasInWindow.filter((r: any) => {
        const codes = getReservaJoinedCodes(r).map(normalizeTableCode);
        return codes.includes(tNorm);
      });
    }
    return map;
  }, [activeReservasInWindow, layout.tables]);

  const comandaByTableId = useMemo(() => {
    const map: Record<string, ComandaPdv | null> = {};
    const isViewingToday = modoData === 'dia' ? diaSelecionado === getTodayISO() : periodoInicio <= getTodayISO() && periodoFim >= getTodayISO();
    for (const t of layout.tables) {
      if (!isViewingToday) {
        map[t.id] = null;
        continue;
      }
      const linkedReservas = reservasByTableId[t.id] || [];
      const explicitComandaId = linkedReservas.find((r) => r.comanda_pdv_id)?.comanda_pdv_id;
      if (explicitComandaId) {
        const foundById = openMesaComandas.find((c) => Number(c.id) === Number(explicitComandaId));
        if (foundById) {
          map[t.id] = foundById;
          continue;
        }
      }
      let matched = openMesaComandas.find((c) => doesComandaMatchTable(c, t.codigo)) || null;
      if (!matched && linkedReservas.length > 0) {
        for (const r of linkedReservas) {
          const primaryCode = String(r.mesa || '').trim();
          if (primaryCode) {
            const mPrimary = openMesaComandas.find((c) => doesComandaMatchTable(c, primaryCode));
            if (mPrimary) {
              matched = mPrimary;
              break;
            }
          }
        }
      }
      map[t.id] = matched;
    }
    return map;
  }, [diaSelecionado, layout.tables, modoData, openMesaComandas, periodoFim, periodoInicio, reservasByTableId]);

  const getTableOperationalState = useCallback(
    (table: FloorTableSeatSet): {
      state: 'livre' | 'reservada' | 'sentada' | 'espera';
      label: string;
      primaryReserva: any | null;
      comanda: ComandaPdv | null;
      joinedCount: number;
    } => {
      const list = reservasByTableId[table.id] || [];
      const comanda = comandaByTableId[table.id] || null;
      const primaryReserva = list[0] || null;
      const joinedCount = primaryReserva ? getReservaJoinedCodes(primaryReserva).length : 1;

      if (comanda || (primaryReserva && String(primaryReserva.status || '').toLowerCase() === 'sentada')) {
        return {
          state: 'sentada',
          label: comanda ? 'Comanda Ativa' : 'Sentada',
          primaryReserva,
          comanda,
          joinedCount
        };
      }
      if (
        (primaryReserva && String(primaryReserva.status || '').toLowerCase().includes('espera')) ||
        list.length > 1
      ) {
        return {
          state: 'espera',
          label: list.length > 1 ? `${list.length} Reservas` : 'Espera',
          primaryReserva,
          comanda: null,
          joinedCount
        };
      }
      if (primaryReserva) {
        return {
          state: 'reservada',
          label: 'Reservada',
          primaryReserva,
          comanda: null,
          joinedCount
        };
      }
      return {
        state: 'livre',
        label: 'Livre',
        primaryReserva: null,
        comanda: null,
        joinedCount: 1
      };
    },
    [comandaByTableId, reservasByTableId]
  );

  const salonSummary = useMemo(() => {
    let totalSeats = 0;
    let livres = 0;
    let reservadas = 0;
    let sentadas = 0;
    let espera = 0;
    for (const t of layout.tables) {
      totalSeats += Number(t.lugares || 0);
      const st = getTableOperationalState(t).state;
      if (st === 'livre') livres++;
      else if (st === 'reservada') reservadas++;
      else if (st === 'sentada') sentadas++;
      else espera++;
    }
    const paxReservado = activeReservasInWindow.reduce((acc, r) => acc + computeReservaPax(r), 0);
    return {
      totalTables: layout.tables.length,
      totalSeats,
      livres,
      reservadas,
      sentadas,
      espera,
      paxReservado
    };
  }, [activeReservasInWindow, getTableOperationalState, layout.tables]);

  const joinedConnectorLines = useMemo(() => {
    const segments: {
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      midX: number;
      midY: number;
      label: string;
      isSeated: boolean;
    }[] = [];

    const tableByNormCode = new Map<string, FloorTableSeatSet>();
    for (const t of layout.tables) {
      tableByNormCode.set(normalizeTableCode(t.codigo), t);
    }

    for (const r of activeReservasInWindow) {
      const codes = getReservaJoinedCodes(r);
      if (codes.length < 2) continue;
      const matchedTables = codes
        .map((c) => tableByNormCode.get(normalizeTableCode(c)))
        .filter((x): x is FloorTableSeatSet => Boolean(x));
      if (matchedTables.length < 2) continue;

      const sorted = [...matchedTables].sort((a, b) => a.x - b.x || a.y - b.y);
      const totalJoinedSeats = sorted.reduce((acc, item) => acc + item.lugares, 0);
      const isSeated = String(r.status || '').toLowerCase() === 'sentada';

      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        const x1 = a.x + a.width / 2;
        const y1 = a.y + a.height / 2;
        const x2 = b.x + b.width / 2;
        const y2 = b.y + b.height / 2;
        segments.push({
          key: `join_${r.id}_${a.id}_${b.id}`,
          x1,
          y1,
          x2,
          y2,
          midX: (x1 + x2) / 2,
          midY: (y1 + y2) / 2,
          label: i === 0 ? `${sorted.length}M (${totalJoinedSeats}L)` : '',
          isSeated
        });
      }
    }
    return segments;
  }, [activeReservasInWindow, layout.tables]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return layout.tables.filter((t) => {
      if (t.codigo.toLowerCase().includes(q)) return true;
      const digitsOnly = q.replace(/\D/g, '');
      if (digitsOnly && normalizeTableCode(t.codigo).replace(/\D/g, '') === digitsOnly) return true;
      const resList = reservasByTableId[t.id] || [];
      if (resList.some((r) => String(r.cliente || '').toLowerCase().includes(q))) return true;
      const com = comandaByTableId[t.id];
      if (com && String(com.cliente_nome || '').toLowerCase().includes(q)) return true;
      return false;
    });
  }, [comandaByTableId, layout.tables, reservasByTableId, searchQuery]);

  const focusOnTable = useCallback(
    (table: FloorTableSeatSet, openDetails = false) => {
      const el = viewportRef.current;
      const vw = el ? el.clientWidth : viewportSize.w;
      const vh = el ? el.clientHeight : viewportSize.h;
      const targetZoom = Math.max(camera.zoom, vw < 640 ? 0.95 : 1.05);
      const cx = table.x + table.width / 2;
      const cy = table.y + table.height / 2;
      animateCameraTo({
        zoom: targetZoom,
        panX: vw / 2 - cx * targetZoom,
        panY: vh / 2 - cy * targetZoom
      });
      setHighlightedTableId(table.id);
      setSelectedId(table.id);
      if (openDetails) {
        setDrawerOpen(true);
      }
      window.setTimeout(() => {
        setHighlightedTableId((curr) => (curr === table.id ? null : curr));
      }, 2800);
    },
    [animateCameraTo, camera.zoom, viewportSize.h, viewportSize.w]
  );

  const handleJumpSector = (env: FloorEnvironmentZone | 'all') => {
    if (env === 'all') {
      setActiveSectorId('all');
      onChangeAreaFiltro('Todas');
      fitAllSalon();
      return;
    }
    setActiveSectorId(env.id);
    onChangeAreaFiltro(env.nome);
    fitRectInViewport(
      {
        minX: env.x - 16,
        minY: env.y - 16,
        maxX: env.x + env.width + 16,
        maxY: env.y + env.height + 16
      },
      1.2
    );
  };

  const selectedTable = useMemo(
    () => layout.tables.find((t) => t.id === selectedId) || null,
    [layout.tables, selectedId]
  );

  const selectedEnvironment = useMemo(
    () => layout.environments.find((e) => e.id === selectedId) || null,
    [layout.environments, selectedId]
  );

  useEffect(() => {
    if (selectedTable) {
      setWalkInPessoas(Math.min(12, Math.max(1, selectedTable.lugares)));
      setWalkInNome('');
      setJoinPickerOpen(false);
    }
  }, [selectedTable?.id]);

  const handleSaveLayoutToServer = async (customNextLayout?: FloorPlanLayoutState, silent = false) => {
    const target = customNextLayout || layout;
    setSavingLayout(true);
    try {
      const bounds = resolveCanvasBounds(target);
      const normalized: FloorPlanLayoutState = {
        ...target,
        canvasWidth: bounds.width,
        canvasHeight: bounds.height
      };
      localStorage.setItem(FLOOR_PLAN_STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new Event('urutau-floor-plan-updated'));

      await fetch('/api/erp/configs/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chave: 'mapa_mesas_salao_layout',
          valor_json: normalized
        })
      });
      setDirtyLayout(false);
      if (!silent) {
        showAlert('Planta Salva', `Mapa com ${normalized.tables.length} mesas salvo e sincronizado para todos os aparelhos.`);
      }
      await onRefresh();
    } catch (e: any) {
      if (!silent) {
        showAlert('Salvo neste Aparelho', 'Planta gravada localmente e será sincronizada assim que a conexão estabilizar.');
      }
    } finally {
      setSavingLayout(false);
    }
  };

  const handleZoomStep = (delta: number) => {
    const el = viewportRef.current;
    const vw = el ? el.clientWidth : viewportSize.w;
    const vh = el ? el.clientHeight : viewportSize.h;
    const prevZoom = camera.zoom;
    const nextZoom = Math.min(2.2, Math.max(0.22, Number((prevZoom + delta).toFixed(2))));
    const worldCenterX = (vw / 2 - camera.panX) / prevZoom;
    const worldCenterY = (vh / 2 - camera.panY) / prevZoom;
    animateCameraTo({
      zoom: nextZoom,
      panX: vw / 2 - worldCenterX * nextZoom,
      panY: vh / 2 - worldCenterY * nextZoom
    });
  };

  const handleWheelViewport = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isFullscreen && !e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const prevZoom = camera.zoom;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = Math.min(2.2, Math.max(0.22, Number((prevZoom * factor).toFixed(3))));
    const worldX = (cursorX - camera.panX) / prevZoom;
    const worldY = (cursorY - camera.panY) / prevZoom;
    setCamera({
      zoom: nextZoom,
      panX: Math.round(cursorX - worldX * nextZoom),
      panY: Math.round(cursorY - worldY * nextZoom)
    });
  };

  const handleTouchStartViewport = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const rect = viewportRef.current?.getBoundingClientRect();
      const midX = (t0.clientX + t1.clientX) / 2 - (rect?.left || 0);
      const midY = (t0.clientY + t1.clientY) / 2 - (rect?.top || 0);
      gestureRef.current = {
        ...gestureRef.current,
        type: 'pinch',
        pinchInitialDist: Math.max(20, dist),
        pinchMidX: midX,
        pinchMidY: midY,
        initialZoom: camera.zoom,
        initialPanX: camera.panX,
        initialPanY: camera.panY
      };
    }
  };

  const handleTouchMoveViewport = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && gestureRef.current.type === 'pinch') {
      e.preventDefault();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const ratio = dist / Math.max(20, gestureRef.current.pinchInitialDist);
      const nextZoom = Math.min(2.2, Math.max(0.22, gestureRef.current.initialZoom * ratio));
      const worldX = (gestureRef.current.pinchMidX - gestureRef.current.initialPanX) / gestureRef.current.initialZoom;
      const worldY = (gestureRef.current.pinchMidY - gestureRef.current.initialPanY) / gestureRef.current.initialZoom;
      setCamera({
        zoom: Number(nextZoom.toFixed(3)),
        panX: Math.round(gestureRef.current.pinchMidX - worldX * nextZoom),
        panY: Math.round(gestureRef.current.pinchMidY - worldY * nextZoom)
      });
    }
  };

  const handleTouchEndViewport = (e: React.TouchEvent<HTMLDivElement>) => {
    if (gestureRef.current.type === 'pinch' && e.touches.length < 2) {
      gestureRef.current.type = 'none';
    }
  };

  const handlePointerDownCanvasBackground = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gestureRef.current.type === 'pinch') return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    gestureRef.current = {
      ...gestureRef.current,
      type: 'pan',
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      movedDistance: 0,
      initialPanX: camera.panX,
      initialPanY: camera.panY
    };
  };

  const handlePointerDownItem = (
    e: React.PointerEvent,
    kind: 'table' | 'env',
    itemId: string,
    mode: 'move' | 'resize' | 'rotate' = 'move'
  ) => {
    if (gestureRef.current.type === 'pinch') return;
    e.stopPropagation();

    if (!editMode) {
      gestureRef.current = {
        ...gestureRef.current,
        type: 'pan',
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        movedDistance: 0,
        initialPanX: camera.panX,
        initialPanY: camera.panY,
        targetKind: kind,
        targetId: itemId
      };
      (viewportRef.current as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
      return;
    }

    setSelectedId(itemId);
    const targetObj =
      kind === 'table'
        ? layout.tables.find((t) => t.id === itemId)
        : layout.environments.find((ev) => ev.id === itemId);
    if (!targetObj) return;

    (viewportRef.current as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
    gestureRef.current = {
      ...gestureRef.current,
      type: mode === 'move' ? 'item_move' : mode === 'resize' ? 'item_resize' : 'item_rotate',
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      movedDistance: 0,
      initialPanX: camera.panX,
      initialPanY: camera.panY,
      targetKind: kind,
      targetId: itemId,
      itemOrigX: targetObj.x,
      itemOrigY: targetObj.y,
      itemOrigW: targetObj.width,
      itemOrigH: targetObj.height,
      itemCenterX: targetObj.x + targetObj.width / 2,
      itemCenterY: targetObj.y + targetObj.height / 2
    };
  };

  const handlePointerMoveViewport = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (g.type === 'none' || g.type === 'pinch') return;

    const dxScreen = e.clientX - g.startClientX;
    const dyScreen = e.clientY - g.startClientY;
    g.movedDistance = Math.hypot(dxScreen, dyScreen);

    if (g.type === 'pan') {
      if (g.movedDistance > 4) {
        setCamera((prev) => ({
          ...prev,
          panX: Math.round(g.initialPanX + dxScreen),
          panY: Math.round(g.initialPanY + dyScreen)
        }));
      }
      return;
    }

    const dxWorld = dxScreen / camera.zoom;
    const dyWorld = dyScreen / camera.zoom;

    if (g.type === 'item_move' && g.targetId) {
      setDirtyLayout(true);
      const snap = 4;
      const nextX = Math.max(8, Math.round(((g.itemOrigX || 0) + dxWorld) / snap) * snap);
      const nextY = Math.max(8, Math.round(((g.itemOrigY || 0) + dyWorld) / snap) * snap);

      if (g.targetKind === 'table') {
        setLayout((prev) => {
          const updatedTables = prev.tables.map((t) => {
            if (t.id !== g.targetId) return t;
            const cx = nextX + t.width / 2;
            const cy = nextY + t.height / 2;
            const matchingEnv = prev.environments.find(
              (env) =>
                env.tipoZona === 'ambiente' &&
                cx >= env.x &&
                cx <= env.x + env.width &&
                cy >= env.y &&
                cy <= env.y + env.height
            );
            return {
              ...t,
              x: nextX,
              y: nextY,
              ambienteId: matchingEnv ? matchingEnv.id : t.ambienteId,
              ambienteNome: matchingEnv ? matchingEnv.nome : t.ambienteNome
            };
          });
          return {
            ...prev,
            canvasWidth: Math.max(prev.canvasWidth || 1200, nextX + 220),
            canvasHeight: Math.max(prev.canvasHeight || 720, nextY + 200),
            tables: updatedTables
          };
        });
      } else {
        setLayout((prev) => ({
          ...prev,
          canvasWidth: Math.max(prev.canvasWidth || 1200, nextX + (g.itemOrigW || 300) + 80),
          canvasHeight: Math.max(prev.canvasHeight || 720, nextY + (g.itemOrigH || 200) + 80),
          environments: prev.environments.map((ev) =>
            ev.id === g.targetId ? { ...ev, x: nextX, y: nextY } : ev
          )
        }));
      }
      return;
    }

    if (g.type === 'item_resize' && g.targetId) {
      setDirtyLayout(true);
      const nextW = Math.max(g.targetKind === 'table' ? 54 : 110, Math.round((g.itemOrigW || 76) + dxWorld));
      const nextH = Math.max(g.targetKind === 'table' ? 54 : 52, Math.round((g.itemOrigH || 74) + dyWorld));
      if (g.targetKind === 'table') {
        setLayout((prev) => ({
          ...prev,
          tables: prev.tables.map((t) =>
            t.id === g.targetId ? { ...t, width: nextW, height: nextH } : t
          )
        }));
      } else {
        setLayout((prev) => ({
          ...prev,
          canvasWidth: Math.max(prev.canvasWidth || 1200, (g.itemOrigX || 0) + nextW + 80),
          canvasHeight: Math.max(prev.canvasHeight || 720, (g.itemOrigY || 0) + nextH + 80),
          environments: prev.environments.map((ev) =>
            ev.id === g.targetId ? { ...ev, width: nextW, height: nextH } : ev
          )
        }));
      }
      return;
    }

    if (g.type === 'item_rotate' && g.targetId && viewportRef.current) {
      setDirtyLayout(true);
      const rect = viewportRef.current.getBoundingClientRect();
      const worldX = (e.clientX - rect.left - camera.panX) / camera.zoom;
      const worldY = (e.clientY - rect.top - camera.panY) / camera.zoom;
      const angleRad = Math.atan2(worldY - (g.itemCenterY || 0), worldX - (g.itemCenterX || 0));
      let deg = Math.round((angleRad * 180) / Math.PI + 90);
      deg = ((deg % 360) + 360) % 360;
      const snapped = Math.round(deg / 15) * 15;
      if (g.targetKind === 'table') {
        setLayout((prev) => ({
          ...prev,
          tables: prev.tables.map((t) => (t.id === g.targetId ? { ...t, rotation: snapped } : t))
        }));
      } else {
        setLayout((prev) => ({
          ...prev,
          environments: prev.environments.map((ev) =>
            ev.id === g.targetId ? { ...ev, rotation: snapped } : ev
          )
        }));
      }
    }
  };

  const handlePointerUpViewport = () => {
    const g = gestureRef.current;
    if (g.type === 'pan' && g.movedDistance < 8) {
      if (g.targetKind === 'table' && g.targetId) {
        setSelectedId(g.targetId);
        setDrawerOpen(true);
      } else if (!g.targetId) {
        if (!editMode) {
          setDrawerOpen(false);
        }
      }
    } else if (
      (g.type === 'item_move' || g.type === 'item_resize' || g.type === 'item_rotate') &&
      g.movedDistance < 6 &&
      g.targetId
    ) {
      setSelectedId(g.targetId);
      setDrawerOpen(true);
    }

    gestureRef.current = {
      ...gestureRef.current,
      type: 'none',
      targetKind: undefined,
      targetId: undefined
    };
  };

  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / Math.max(1, rect.width);
    const relY = (e.clientY - rect.top) / Math.max(1, rect.height);
    const worldX = relX * canvasBounds.width;
    const worldY = relY * canvasBounds.height;
    const el = viewportRef.current;
    const vw = el ? el.clientWidth : viewportSize.w;
    const vh = el ? el.clientHeight : viewportSize.h;
    animateCameraTo({
      zoom: camera.zoom,
      panX: vw / 2 - worldX * camera.zoom,
      panY: vh / 2 - worldY * camera.zoom
    });
  };

  const handleAddSingleTable = () => {
    const targetEnv =
      ambienteZones.find((z) => z.id === activeSectorId) ||
      ambienteZones[0] || {
        id: 'env_salao_principal',
        nome: 'Salão Principal',
        x: 40,
        y: 110,
        width: 800,
        height: 500
      };

    const nextNumber = layout.tables.length + 1;
    const codigo = `M-${String(nextNumber).padStart(2, '0')}`;
    const existingInEnv = layout.tables.filter((t) => t.ambienteId === targetEnv.id);
    const col = existingInEnv.length % 6;
    const row = Math.floor(existingInEnv.length / 6);
    const dims = getDefaultDimensionsForSeatCount(4, 'quadrada');
    const newTable: FloorTableSeatSet = {
      id: `tbl_${Date.now()}`,
      codigo,
      ambienteId: targetEnv.id,
      ambienteNome: targetEnv.nome,
      lugares: 4,
      formato: 'quadrada',
      x: targetEnv.x + 36 + col * 138,
      y: targetEnv.y + 56 + row * 142,
      width: dims.width,
      height: dims.height,
      rotation: 0
    };

    setLayout((prev) => ({
      ...prev,
      canvasWidth: Math.max(prev.canvasWidth || 1200, newTable.x + 220),
      canvasHeight: Math.max(prev.canvasHeight || 720, newTable.y + 200),
      tables: [...prev.tables, newTable]
    }));
    setDirtyLayout(true);
    setSelectedId(newTable.id);
    setDrawerOpen(true);
  };

  const handleAddEnvironmentZone = (tipoZona: 'ambiente' | 'bar' | 'palco' | 'entrada') => {
    const labels: Record<typeof tipoZona, { nome: string; cor: string; w: number; h: number }> = {
      ambiente: {
        nome: `Novo Setor ${ambienteZones.length + 1}`,
        cor: '#10B981',
        w: 620,
        h: 440
      },
      bar: { nome: 'Bar / Copa', cor: '#06B6D4', w: 360, h: 68 },
      palco: { nome: 'Palco', cor: '#8B5CF6', w: 300, h: 68 },
      entrada: { nome: 'Entrada / Recepção', cor: '#64748B', w: 280, h: 64 }
    };
    const cfg = labels[tipoZona];
    const newZone: FloorEnvironmentZone = {
      id: `env_${Date.now()}`,
      nome: cfg.nome,
      corHex: cfg.cor,
      x: 60 + (layout.environments.length % 3) * 120,
      y: 120 + (layout.environments.length % 4) * 80,
      width: cfg.w,
      height: cfg.h,
      rotation: 0,
      tipoZona
    };
    setLayout((prev) => ({
      ...prev,
      canvasWidth: Math.max(prev.canvasWidth || 1200, newZone.x + newZone.width + 100),
      canvasHeight: Math.max(prev.canvasHeight || 720, newZone.y + newZone.height + 100),
      environments: [...prev.environments, newZone]
    }));
    setDirtyLayout(true);
    setSelectedId(newZone.id);
    setDrawerOpen(true);
  };

  const handleAutoOrganizeTables = () => {
    const envs = layout.environments.filter((e) => e.tipoZona === 'ambiente');
    if (envs.length === 0) return;

    const updatedEnvs = [...layout.environments];
    const updatedTables = [...layout.tables];
    let maxRight = layout.canvasWidth || 1200;
    let maxBottom = layout.canvasHeight || 720;

    for (const env of envs) {
      const envTables = updatedTables
        .filter((t) => t.ambienteId === env.id || t.ambienteNome === env.nome)
        .sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));
      if (envTables.length === 0) continue;

      const cellW = 152;
      const cellH = 148;
      const cols = Math.max(2, Math.floor((env.width - 56) / cellW));
      const neededRows = Math.ceil(envTables.length / cols);
      const minEnvHeight = Math.max(env.height, 82 + neededRows * cellH);

      const envIdx = updatedEnvs.findIndex((x) => x.id === env.id);
      if (envIdx >= 0 && minEnvHeight > updatedEnvs[envIdx].height) {
        updatedEnvs[envIdx] = { ...updatedEnvs[envIdx], height: minEnvHeight };
      }

      envTables.forEach((tbl, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const tIdx = updatedTables.findIndex((u) => u.id === tbl.id);
        if (tIdx >= 0) {
          const nx = env.x + 34 + col * cellW;
          const ny = env.y + 68 + row * cellH;
          updatedTables[tIdx] = {
            ...updatedTables[tIdx],
            x: nx,
            y: ny,
            rotation: 0
          };
          maxRight = Math.max(maxRight, nx + updatedTables[tIdx].width + 80);
          maxBottom = Math.max(maxBottom, ny + updatedTables[tIdx].height + 80);
        }
      });
    }

    setLayout({
      canvasWidth: maxRight,
      canvasHeight: maxBottom,
      environments: updatedEnvs,
      tables: updatedTables
    });
    setDirtyLayout(true);
    window.setTimeout(fitAllSalon, 60);
  };

  const handleExecuteBatchGenerator = () => {
    const qty = Math.min(200, Math.max(1, Number(batchCount || 1)));
    const start = Math.max(1, Number(batchStartNum || 1));
    const cols = Math.min(14, Math.max(2, Number(batchCols || 8)));
    const dims = getDefaultDimensionsForSeatCount(batchSeats, batchShape);
    const cellW = Math.max(142, dims.width + 54);
    const cellH = Math.max(146, dims.height + 64);

    if (batchEnvMode === 'auto_setores_67' && batchReplaceExisting && qty === 67 && start === 1 && batchPrefix === 'M-') {
      const preset67 = buildGrandeOperacao67Layout();
      setLayout(preset67);
      setDirtyLayout(true);
      setModalBatchOpen(false);
      window.setTimeout(fitAllSalon, 60);
      return;
    }

    let nextEnvs = [...layout.environments];
    let targetEnv: FloorEnvironmentZone | undefined;

    if (batchEnvMode === 'novo_ambiente') {
      const nomeLimpo = batchNewEnvName.trim() || `Salão Expandido ${ambienteZones.length + 1}`;
      const rows = Math.ceil(qty / cols);
      const envW = 72 + cols * cellW;
      const envH = 96 + rows * cellH;
      const maxExistingY = nextEnvs.reduce((acc, e) => Math.max(acc, e.y + e.height), 90);
      targetEnv = {
        id: `env_batch_${Date.now()}`,
        nome: nomeLimpo,
        corHex: '#10B981',
        x: 40,
        y: nextEnvs.length === 0 || batchReplaceExisting ? 110 : maxExistingY + 36,
        width: envW,
        height: envH,
        rotation: 0,
        tipoZona: 'ambiente'
      };
      nextEnvs.push(targetEnv);
    } else {
      targetEnv =
        nextEnvs.find((e) => e.id === batchEnvMode) ||
        nextEnvs.find((e) => e.tipoZona === 'ambiente');
      if (!targetEnv) {
        const rows = Math.ceil(qty / cols);
        targetEnv = {
          id: `env_batch_${Date.now()}`,
          nome: 'Salão Principal',
          corHex: '#10B981',
          x: 40,
          y: 110,
          width: 72 + cols * cellW,
          height: 96 + rows * cellH,
          rotation: 0,
          tipoZona: 'ambiente'
        };
        nextEnvs.push(targetEnv);
      }
    }

    const baseTables = batchReplaceExisting ? [] : [...layout.tables];
    const existingInTarget = baseTables.filter((t) => t.ambienteId === targetEnv!.id).length;
    const totalInTarget = existingInTarget + qty;
    const totalRows = Math.ceil(totalInTarget / cols);
    const reqWidth = Math.max(targetEnv.width, 72 + cols * cellW);
    const reqHeight = Math.max(targetEnv.height, 96 + totalRows * cellH);

    nextEnvs = nextEnvs.map((e) =>
      e.id === targetEnv!.id ? { ...e, width: reqWidth, height: reqHeight } : e
    );

    const generated: FloorTableSeatSet[] = [];
    for (let i = 0; i < qty; i++) {
      const idxInGrid = existingInTarget + i;
      const col = idxInGrid % cols;
      const row = Math.floor(idxInGrid / cols);
      const numStr = String(start + i).padStart(batchDigits, '0');
      const codigo = `${batchPrefix}${numStr}`;
      generated.push({
        id: `tbl_gen_${Date.now()}_${i}`,
        codigo,
        ambienteId: targetEnv.id,
        ambienteNome: targetEnv.nome,
        lugares: batchSeats,
        formato: batchShape,
        x: targetEnv.x + 36 + col * cellW,
        y: targetEnv.y + 68 + row * cellH,
        width: dims.width,
        height: dims.height,
        rotation: 0
      });
    }

    const combinedTables = [...baseTables, ...generated];
    const nextLayout: FloorPlanLayoutState = {
      environments: nextEnvs,
      tables: combinedTables
    };
    const bounds = resolveCanvasBounds(nextLayout);
    nextLayout.canvasWidth = bounds.width;
    nextLayout.canvasHeight = bounds.height;

    setLayout(nextLayout);
    setDirtyLayout(true);
    setModalBatchOpen(false);
    window.setTimeout(fitAllSalon, 70);
  };

  const handleLinkReservaToSelectedTable = async (reservaId: number) => {
    if (!selectedTable) return;
    const alvo = reservas.find((r) => Number(r.id) === Number(reservaId));
    if (!alvo) return;
    setSavingAction(true);
    try {
      const resp = await fetch('/api/reservas/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...alvo,
          mesa: selectedTable.codigo,
          mesas_vinculadas: [selectedTable.codigo],
          area: selectedTable.ambienteNome
        })
      });
      if (!resp.ok) throw new Error('Falha ao vincular reserva.');
      setLinkingReservaId('');
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro ao Vincular', e?.message || 'Não foi possível vincular a reserva.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleUnlinkReservaFromTable = async (r: any) => {
    if (!selectedTable) return;
    setSavingAction(true);
    try {
      const currentCodes = getReservaJoinedCodes(r);
      const remaining = currentCodes.filter(
        (c) => normalizeTableCode(c) !== normalizeTableCode(selectedTable.codigo)
      );
      const nextPrimary = remaining[0] || 'Sem Mesa';
      const resp = await fetch('/api/reservas/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...r,
          mesa: nextPrimary,
          mesas_vinculadas: remaining
        })
      });
      if (!resp.ok) throw new Error('Falha ao soltar reserva.');
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro ao Desvincular', e?.message || 'Não foi possível soltar a mesa.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleOpenJoinPickerForReserva = (r: any) => {
    setJoinReservaTargetId(Number(r.id));
    setJoinSelectedCodes(getReservaJoinedCodes(r));
    setJoinSearchFilter('');
    setJoinPickerOpen(true);
  };

  const handleSaveJoinedTables = async () => {
    if (!joinReservaTargetId || joinSelectedCodes.length === 0) return;
    const r = reservas.find((item) => Number(item.id) === Number(joinReservaTargetId));
    if (!r) return;
    setSavingAction(true);
    try {
      const primary = joinSelectedCodes[0];
      const primaryTableObj = layout.tables.find(
        (t) => normalizeTableCode(t.codigo) === normalizeTableCode(primary)
      );
      const resp = await fetch('/api/reservas/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...r,
          mesa: primary,
          mesas_vinculadas: joinSelectedCodes,
          area: primaryTableObj?.ambienteNome || r.area
        })
      });
      if (!resp.ok) throw new Error('Não foi possível salvar a junção de mesas.');
      setJoinPickerOpen(false);
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro na Junção de Mesas', e?.message || 'Falha ao unir mesas.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleSitReservaAndOpenPdv = async (r: any) => {
    if (!selectedTable) return;
    setSavingAction(true);
    try {
      const joinedCodes = getReservaJoinedCodes(r);
      const mesaPrincipal = joinedCodes[0] || selectedTable.codigo;
      const ident =
        joinedCodes.length > 1
          ? `Mesa ${mesaPrincipal} (+${joinedCodes.slice(1).join(',')})`
          : `Mesa ${mesaPrincipal}`;
      const pax = Math.max(1, computeReservaPax(r));

      const respPdv = await fetch('/api/pdv/comandas/abrir-ou-adicionar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comanda_id: r.comanda_pdv_id || undefined,
          modalidade: 'mesa',
          identificador: ident,
          mesa_numero: mesaPrincipal,
          cliente_nome: r.cliente || '',
          cliente_telefone: r.whatsapp || '',
          garcom_nome: currentUser?.nome || 'Recepção',
          pessoas_mesa: pax,
          imprimir_setores: false,
          unidade_id: Number(r.unidade_id || unidadeId || 1),
          empresa_id: Number(empresaId || r.unidade_id || 1),
          novos_itens: []
        })
      });
      const jsonPdv = await respPdv.json();
      if (!respPdv.ok || !jsonPdv?.ok) {
        throw new Error(jsonPdv?.erro || 'Falha ao abrir comanda no PDV.');
      }

      const comandaCriadaId = jsonPdv?.comanda?.id ?? r.comanda_pdv_id ?? null;

      await fetch('/api/reservas/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...r,
          mesa: mesaPrincipal,
          mesas_vinculadas: joinedCodes.length > 0 ? joinedCodes : [mesaPrincipal],
          status: 'Sentada',
          comanda_pdv_id: comandaCriadaId
        })
      });

      await onRefresh();
      setIsFullscreen(false);
      setDrawerOpen(false);
      onOpenTableInPdv?.({
        mesaCodigo: mesaPrincipal,
        comandaId: comandaCriadaId
      });
    } catch (e: any) {
      showAlert('Erro ao Abrir Mesa no PDV', e?.message || 'Não foi possível iniciar o atendimento no PDV.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleWalkInOpenPdv = async () => {
    if (!selectedTable) return;
    setSavingAction(true);
    try {
      const mesaCodigo = selectedTable.codigo;
      const respPdv = await fetch('/api/pdv/comandas/abrir-ou-adicionar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modalidade: 'mesa',
          identificador: `Mesa ${mesaCodigo}`,
          mesa_numero: mesaCodigo,
          cliente_nome: walkInNome.trim(),
          garcom_nome: currentUser?.nome || 'Salão',
          pessoas_mesa: Math.max(1, Number(walkInPessoas || selectedTable.lugares || 2)),
          imprimir_setores: false,
          unidade_id: Number(unidadeId || 1),
          empresa_id: Number(empresaId || unidadeId || 1),
          novos_itens: []
        })
      });
      const jsonPdv = await respPdv.json();
      if (!respPdv.ok || !jsonPdv?.ok) {
        throw new Error(jsonPdv?.erro || 'Falha ao abrir mesa no PDV.');
      }
      await onRefresh();
      setIsFullscreen(false);
      setDrawerOpen(false);
      onOpenTableInPdv?.({
        mesaCodigo,
        comandaId: jsonPdv?.comanda?.id ?? null
      });
    } catch (e: any) {
      showAlert('Erro ao Abrir Mesa', e?.message || 'Falha ao abrir comanda no PDV.');
    } finally {
      setSavingAction(false);
    }
  };

  const allAvailableTemplates = useMemo(
    () => [...BUILTIN_TEMPLATES, ...customTemplates],
    [customTemplates]
  );

  const handleLoadTemplate = (tpl: SavedFloorPlanTemplate) => {
    const clean = sanitizeLoadedLayout(tpl.layout);
    if (!clean) return;
    setLayout(clean);
    setDirtyLayout(true);
    setSelectedId(null);
    setModalModelosOpen(false);
    window.setTimeout(fitAllSalon, 70);
  };

  const handleSaveAsNewCustomTemplate = () => {
    const nome = nomeNovoModelo.trim();
    if (!nome) {
      showAlert('Nome Obrigatório', 'Informe um nome para identificar este modelo de salão.');
      return;
    }
    const novo: SavedFloorPlanTemplate = {
      id: `custom_${Date.now()}`,
      nome,
      descricao:
        descNovoModelo.trim() ||
        `${layout.environments.filter((e) => e.tipoZona === 'ambiente').length} setores e ${layout.tables.length} mesas.`,
      tipo: 'custom',
      layout: JSON.parse(JSON.stringify(layout)),
      criadoEm: new Date().toISOString()
    };
    const next = [novo, ...customTemplates];
    setCustomTemplates(next);
    localStorage.setItem(FLOOR_PLAN_TEMPLATES_KEY, JSON.stringify(next));
    setModalSalvarComoOpen(false);
    showAlert('Modelo Guardado', `O modelo "${nome}" foi salvo na biblioteca.`);
  };

  const handleDeleteCustomTemplate = (tplId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = customTemplates.filter((t) => t.id !== tplId);
    setCustomTemplates(next);
    localStorage.setItem(FLOOR_PLAN_TEMPLATES_KEY, JSON.stringify(next));
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planta-salao-${layout.tables.length}-mesas.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSONFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const clean = sanitizeLoadedLayout(parsed?.layout || parsed);
        if (!clean) throw new Error('Formato JSON inválido.');
        setLayout(clean);
        setDirtyLayout(true);
        setModalModelosOpen(false);
        window.setTimeout(fitAllSalon, 70);
      } catch (err: any) {
        showAlert('Arquivo Inválido', err?.message || 'Não foi possível ler o arquivo JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const minimapMetrics = useMemo(() => {
    const maxW = 168;
    const maxH = 112;
    const scale = Math.min(maxW / canvasBounds.width, maxH / canvasBounds.height);
    const mapW = Math.round(canvasBounds.width * scale);
    const mapH = Math.round(canvasBounds.height * scale);
    const viewWorldX = -camera.panX / camera.zoom;
    const viewWorldY = -camera.panY / camera.zoom;
    const viewWorldW = viewportSize.w / camera.zoom;
    const viewWorldH = viewportSize.h / camera.zoom;
    return {
      scale,
      mapW,
      mapH,
      vpLeft: Math.max(0, Math.min(mapW - 8, viewWorldX * scale)),
      vpTop: Math.max(0, Math.min(mapH - 8, viewWorldY * scale)),
      vpWidth: Math.min(mapW, Math.max(12, viewWorldW * scale)),
      vpHeight: Math.min(mapH, Math.max(10, viewWorldH * scale))
    };
  }, [camera.panX, camera.panY, camera.zoom, canvasBounds.height, canvasBounds.width, viewportSize.h, viewportSize.w]);

  const isCompactZoom = camera.zoom < 0.56;

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[70] flex flex-col bg-[#080D11] select-none'
          : 'w-full rounded-2xl bg-[#0F171E] border border-white/10 overflow-hidden flex flex-col select-none'
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportJSONFile}
      />

      <div className="px-3 py-2 bg-[#0B1217] border-b border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex items-center gap-2 pr-2 border-r border-white/10">
            <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-slate-100 whitespace-nowrap">
              Mapa do Salão
            </span>
            <span className="hidden sm:inline text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap">
              {salonSummary.totalTables} mesas · {salonSummary.totalSeats} lug.
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-950/70 p-0.5 rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => setModoData('dia')}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                modoData === 'dia'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => setModoData('periodo')}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                modoData === 'periodo'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Período
            </button>
          </div>

          {modoData === 'dia' ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDiaSelecionado((d) => addDaysISO(d, -1))}
                className="p-1.5 rounded-lg bg-slate-950/70 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                title="Dia anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <input
                type="date"
                value={diaSelecionado}
                onChange={(e) => setDiaSelecionado(e.target.value || getTodayISO())}
                className="px-2 py-1 text-xs font-mono tabular-nums rounded-lg bg-slate-950 border border-white/15 text-slate-100"
              />
              <button
                type="button"
                onClick={() => setDiaSelecionado((d) => addDaysISO(d, 1))}
                className="p-1.5 rounded-lg bg-slate-950/70 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                title="Próximo dia"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              {diaSelecionado !== getTodayISO() && (
                <button
                  type="button"
                  onClick={() => setDiaSelecionado(getTodayISO())}
                  className="px-2 py-1 rounded-lg bg-white/10 text-[11px] font-semibold text-emerald-300 hover:bg-white/15 cursor-pointer whitespace-nowrap"
                >
                  Hoje
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs font-mono tabular-nums">
              <CalendarRange className="w-3.5 h-3.5 text-amber-400 shrink-0 hidden sm:inline" />
              <input
                type="date"
                value={periodoInicio}
                onChange={(e) => setPeriodoInicio(e.target.value)}
                className="px-2 py-1 text-xs font-mono rounded-lg bg-slate-950 border border-white/15 text-slate-100"
              />
              <span className="text-slate-400">a</span>
              <input
                type="date"
                value={periodoFim}
                onChange={(e) => setPeriodoFim(e.target.value)}
                className="px-2 py-1 text-xs font-mono rounded-lg bg-slate-950 border border-white/15 text-slate-100"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchResults.length > 0) {
                  focusOnTable(searchResults[0], true);
                  setSearchQuery('');
                }
              }}
              placeholder="Buscar M-42 ou cliente..."
              className="w-36 sm:w-48 pl-8 pr-7 py-1.5 text-xs rounded-lg bg-slate-950 border border-white/15 text-slate-100"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {searchQuery.trim() !== '' && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl bg-[#0B1217] border border-emerald-500/40 shadow-2xl max-h-56 overflow-y-auto divide-y divide-white/5">
                {searchResults.length === 0 ? (
                  <div className="p-2.5 text-[11px] text-slate-400">Nenhuma mesa ou cliente encontrado.</div>
                ) : (
                  searchResults.slice(0, 12).map((t) => {
                    const st = getTableOperationalState(t);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          focusOnTable(t, true);
                          setSearchQuery('');
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-emerald-500/15 flex items-center justify-between gap-2 text-xs cursor-pointer"
                      >
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-white">{t.codigo}</span>
                          <span className="text-slate-400 ml-1.5 truncate text-[11px]">
                            {st.primaryReserva?.cliente || st.comanda?.cliente_nome || t.ambienteNome}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono tabular-nums text-emerald-300 shrink-0">
                          {st.label}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setEditMode((prev) => !prev);
            }}
            className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
              editMode
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-950/80 text-slate-200 border-white/15 hover:border-amber-400/50'
            }`}
            title={editMode ? 'Concluir edição e travar planta para operação segura' : 'Destravar planta para mover, criar ou gerar mesas em lote'}
          >
            {editMode ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{editMode ? 'Travar Planta' : 'Editar Planta'}</span>
          </button>

          <button
            type="button"
            onClick={() => setModalModelosOpen(true)}
            className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-white/10 border border-white/15 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title="Modelos de salão (incluindo 67 mesas)"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Modelos</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 border cursor-pointer whitespace-nowrap ${
              isFullscreen
                ? 'bg-rose-500/20 text-rose-200 border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25'
            }`}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'Sair Tela Cheia' : 'Tela Cheia'}</span>
          </button>
        </div>
      </div>

      <div className="px-3 py-1.5 bg-slate-950/70 border-b border-white/10 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => handleJumpSector('all')}
            className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
              activeSectorId === 'all'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45'
                : 'bg-transparent text-slate-300 border-white/10 hover:bg-white/5'
            }`}
          >
            Visão Geral ({salonSummary.totalTables})
          </button>

          {ambienteZones.map((env) => {
            const envTables = layout.tables.filter(
              (t) => t.ambienteId === env.id || t.ambienteNome === env.nome
            );
            const occupied = envTables.filter((t) => getTableOperationalState(t).state !== 'livre').length;
            const isSelectedSector = activeSectorId === env.id;
            return (
              <button
                key={env.id}
                type="button"
                onClick={() => handleJumpSector(env)}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 ${
                  isSelectedSector
                    ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
                    : 'bg-transparent text-slate-300 border-white/10 hover:bg-white/5'
                }`}
              >
                <span>{env.nome}</span>
                <span className="font-mono tabular-nums text-[11px] opacity-80">
                  {occupied}/{envTables.length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="hidden lg:flex items-center gap-3 text-xs font-mono tabular-nums shrink-0 text-slate-300">
          <span>Livres: <strong className="text-emerald-400">{salonSummary.livres}</strong></span>
          <span>·</span>
          <span>Reservadas: <strong className="text-amber-400">{salonSummary.reservadas}</strong></span>
          <span>·</span>
          <span>Sentadas/PDV: <strong className="text-sky-400">{salonSummary.sentadas}</strong></span>
          <span>·</span>
          <span>Público Agendado: <strong className="text-slate-100">{salonSummary.paxReservado} pax</strong></span>
        </div>
      </div>

      {editMode && (
        <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/35 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-amber-300 pr-2 border-r border-amber-500/30 whitespace-nowrap">
              Modo Edição Ativo
            </span>

            <button
              type="button"
              onClick={() => setModalBatchOpen(true)}
              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Gerar Mesas em Lote (Ex: M-01 a M-67)</span>
            </button>

            <button
              type="button"
              onClick={handleAddSingleTable}
              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+1 Mesa</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddEnvironmentZone('ambiente')}
              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5 text-amber-300" />
              <span>+ Setor</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddEnvironmentZone('bar')}
              className="min-h-[34px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs cursor-pointer whitespace-nowrap"
            >
              + Bar
            </button>

            <button
              type="button"
              onClick={() => handleAddEnvironmentZone('palco')}
              className="min-h-[34px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs cursor-pointer whitespace-nowrap"
            >
              + Palco
            </button>

            <button
              type="button"
              onClick={handleAutoOrganizeTables}
              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 text-xs font-semibold cursor-pointer whitespace-nowrap"
              title="Alinhar mesas automaticamente dentro de cada setor"
            >
              Auto-Alinhar Grade
            </button>

            <button
              type="button"
              onClick={() => setModalDimensoesOpen(true)}
              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 text-xs font-mono tabular-nums cursor-pointer whitespace-nowrap"
            >
              Planta: {canvasBounds.width}x{canvasBounds.height}px
            </button>

            <button
              type="button"
              onClick={() => setModalLimparOpen(true)}
              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={savingLayout}
              onClick={() => handleSaveLayoutToServer()}
              className="min-h-[34px] px-3.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingLayout ? 'Salvando...' : dirtyLayout ? 'Salvar Planta *' : 'Salvar Planta'}</span>
            </button>
          </div>
        </div>
      )}

      <div
        ref={viewportRef}
        onWheel={handleWheelViewport}
        onTouchStart={handleTouchStartViewport}
        onTouchMove={handleTouchMoveViewport}
        onTouchEnd={handleTouchEndViewport}
        onPointerDown={handlePointerDownCanvasBackground}
        onPointerMove={handlePointerMoveViewport}
        onPointerUp={handlePointerUpViewport}
        onPointerCancel={handlePointerUpViewport}
        style={{ touchAction: 'none' }}
        className={`relative w-full overflow-hidden bg-[#091017] ${
          isFullscreen ? 'flex-1 min-h-0' : 'h-[66vh] min-h-[460px] max-h-[820px]'
        } ${editMode ? 'ring-2 ring-inset ring-amber-400/50 cursor-grab active:cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}`}
      >
        <div
          style={{
            width: `${canvasBounds.width}px`,
            height: `${canvasBounds.height}px`,
            transform: `translate3d(${camera.panX}px, ${camera.panY}px, 0) scale(${camera.zoom})`,
            transformOrigin: '0 0',
            transition: smoothCameraTransition ? 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
            backgroundImage:
              'radial-gradient(rgba(148, 163, 184, 0.16) 1px, transparent 1px), linear-gradient(to right, rgba(148, 163, 184, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.05) 1px, transparent 1px)',
            backgroundSize: '24px 24px, 120px 120px, 120px 120px'
          }}
          className="relative rounded-xl border border-white/15 bg-[#0C1620]/90"
        >
          {layout.environments.map((env) => {
            const isSelected = selectedId === env.id;
            const envTables = layout.tables.filter(
              (t) => t.ambienteId === env.id || t.ambienteNome === env.nome
            );
            const envSeats = envTables.reduce((acc, t) => acc + t.lugares, 0);

            return (
              <div
                key={env.id}
                onPointerDown={(e) => handlePointerDownItem(e, 'env', env.id, 'move')}
                style={{
                  left: `${env.x}px`,
                  top: `${env.y}px`,
                  width: `${env.width}px`,
                  height: `${env.height}px`,
                  transform: `rotate(${env.rotation || 0}deg)`,
                  borderColor: isSelected ? '#F59E0B' : `${env.corHex}66`,
                  backgroundColor:
                    env.tipoZona === 'ambiente' ? `${env.corHex}10` : `${env.corHex}22`
                }}
                className={`absolute rounded-2xl border-2 transition-shadow ${
                  editMode ? 'cursor-move' : 'pointer-events-auto'
                } ${isSelected && editMode ? 'ring-2 ring-amber-400' : ''}`}
              >
                <div
                  style={{ backgroundColor: `${env.corHex}26`, borderColor: `${env.corHex}55` }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-tl-xl rounded-br-xl border-b border-r text-xs font-bold text-slate-100"
                >
                  <span>{env.nome}</span>
                  {env.tipoZona === 'ambiente' && (
                    <span className="font-mono tabular-nums text-[11px] text-slate-300 font-normal">
                      {envTables.length}M · {envSeats}L
                    </span>
                  )}
                </div>

                {editMode && isSelected && (
                  <>
                    <button
                      type="button"
                      onPointerDown={(e) => handlePointerDownItem(e, 'env', env.id, 'rotate')}
                      className="absolute -top-3.5 right-3 w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow cursor-grab"
                      title="Arraste para girar ambiente"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onPointerDown={(e) => handlePointerDownItem(e, 'env', env.id, 'resize')}
                      className="absolute -bottom-3 -right-3 w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center shadow cursor-nwse-resize"
                      title="Arraste para redimensionar ambiente"
                    >
                      <Move className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {joinedConnectorLines.length > 0 && (
            <svg
              width={canvasBounds.width}
              height={canvasBounds.height}
              className="absolute inset-0 pointer-events-none z-10"
            >
              {joinedConnectorLines.map((seg) => (
                <g key={seg.key}>
                  <line
                    x1={seg.x1}
                    y1={seg.y1}
                    x2={seg.x2}
                    y2={seg.y2}
                    stroke={seg.isSeated ? '#38BDF8' : '#F59E0B'}
                    strokeWidth={4}
                    strokeDasharray="8 5"
                  />
                  {seg.label && (
                    <g transform={`translate(${seg.midX}, ${seg.midY})`}>
                      <rect
                        x={-36}
                        y={-11}
                        width={72}
                        height={22}
                        rx={6}
                        fill="#0B1217"
                        stroke={seg.isSeated ? '#38BDF8' : '#F59E0B'}
                        strokeWidth={1.5}
                      />
                      <text
                        x={0}
                        y={4}
                        textAnchor="middle"
                        fill="#F8FAFC"
                        fontSize={10}
                        fontFamily="var(--font-mono)"
                        fontWeight={700}
                      >
                        {seg.label}
                      </text>
                    </g>
                  )}
                </g>
              ))}
            </svg>
          )}

          {layout.tables.map((table) => {
            const op = getTableOperationalState(table);
            const isSelected = selectedId === table.id;
            const isHighlighted = highlightedTableId === table.id;
            const dimByFilter =
              areaFiltro !== 'Todas' &&
              table.ambienteNome !== areaFiltro;

            let surfaceClasses =
              'bg-emerald-950/90 border-emerald-500/75 text-emerald-50 hover:border-emerald-300';
            if (op.state === 'sentada') {
              surfaceClasses =
                'bg-sky-950/95 border-sky-400 text-sky-50 hover:border-sky-300';
            } else if (op.state === 'reservada') {
              surfaceClasses =
                'bg-amber-950/95 border-amber-400 text-amber-50 hover:border-amber-300';
            } else if (op.state === 'espera') {
              surfaceClasses =
                'bg-rose-950/95 border-rose-400 text-rose-50 hover:border-rose-300';
            }

            const guestShort = String(
              op.primaryReserva?.cliente || op.comanda?.cliente_nome || ''
            )
              .trim()
              .split(' ')
              .slice(0, 2)
              .join(' ');

            return (
              <div
                key={table.id}
                onPointerDown={(e) => handlePointerDownItem(e, 'table', table.id, 'move')}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (op.primaryReserva) {
                    onOpenEditReserva(op.primaryReserva);
                  } else {
                    onOpenNewReservaAtTable({
                      mesa: table.codigo,
                      mesas_vinculadas: [table.codigo],
                      area: table.ambienteNome,
                      lugares: table.lugares,
                      data: modoData === 'dia' ? diaSelecionado : periodoInicio
                    });
                  }
                }}
                style={{
                  left: `${table.x}px`,
                  top: `${table.y}px`,
                  width: `${table.width}px`,
                  height: `${table.height}px`,
                  transform: `rotate(${table.rotation || 0}deg)`
                }}
                className={`absolute z-20 border-2 flex flex-col items-center justify-center px-1.5 py-1 text-center transition-opacity ${
                  table.formato === 'redonda' ? 'rounded-full' : 'rounded-xl'
                } ${surfaceClasses} ${
                  isSelected ? 'ring-3 ring-white shadow-xl' : ''
                } ${isHighlighted ? 'ring-4 ring-amber-300 scale-105' : ''} ${
                  dimByFilter ? 'opacity-30' : 'opacity-100'
                } ${editMode ? 'cursor-move' : 'cursor-pointer'}`}
              >
                {!isCompactZoom && renderSeatTicks(table)}

                <div className="font-mono font-bold tabular-nums text-xs leading-none tracking-tight flex items-center gap-1">
                  <span>{table.codigo}</span>
                  {op.joinedCount > 1 && (
                    <Link2 className="w-3 h-3 text-amber-300 shrink-0" />
                  )}
                </div>

                {isCompactZoom ? (
                  <div className="text-[10px] font-mono tabular-nums leading-tight mt-0.5 opacity-90">
                    {op.state === 'livre' ? `${table.lugares}L` : op.label.slice(0, 6)}
                  </div>
                ) : (
                  <>
                    {guestShort ? (
                      <div className="text-[10px] font-semibold leading-tight truncate max-w-full mt-0.5">
                        {guestShort}
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono tabular-nums text-emerald-300/90 mt-0.5">
                        {table.lugares} lug.
                      </div>
                    )}

                    {op.comanda ? (
                      <div className="text-[9px] font-mono tabular-nums text-sky-300 leading-none mt-0.5">
                        {formatBRLCompact(op.comanda.saldo_restante)}
                      </div>
                    ) : op.primaryReserva ? (
                      <div className="text-[9px] font-mono tabular-nums text-amber-200 leading-none mt-0.5">
                        {op.primaryReserva.hora || '20:00'} · {computeReservaPax(op.primaryReserva)}p
                      </div>
                    ) : null}
                  </>
                )}

                {editMode && isSelected && (
                  <>
                    <button
                      type="button"
                      onPointerDown={(e) => handlePointerDownItem(e, 'table', table.id, 'rotate')}
                      className="absolute -top-3.5 -right-2 w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow cursor-grab"
                      title="Girar mesa"
                    >
                      <RotateCw className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onPointerDown={(e) => handlePointerDownItem(e, 'table', table.id, 'resize')}
                      className="absolute -bottom-3 -right-2 w-6 h-6 rounded-md bg-emerald-500 text-slate-950 flex items-center justify-center shadow cursor-nwse-resize"
                      title="Redimensionar mesa"
                    >
                      <Move className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute left-3 bottom-3 z-30 flex items-center gap-1 p-1 rounded-xl bg-[#0B1217]/95 border border-white/15 shadow-xl"
        >
          <button
            type="button"
            onClick={() => handleZoomStep(-0.15)}
            className="w-9 h-9 rounded-lg hover:bg-white/10 text-slate-200 flex items-center justify-center cursor-pointer"
            title="Afastar zoom"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={fitAllSalon}
            className="px-2.5 h-9 rounded-lg hover:bg-white/10 text-xs font-mono font-bold tabular-nums text-emerald-300 cursor-pointer"
            title="Enquadrar salão inteiro na tela"
          >
            {Math.round(camera.zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => handleZoomStep(0.15)}
            className="w-9 h-9 rounded-lg hover:bg-white/10 text-slate-200 flex items-center justify-center cursor-pointer"
            title="Aproximar zoom"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={fitAllSalon}
            className="px-2.5 h-9 rounded-lg bg-white/5 hover:bg-white/15 text-xs font-semibold text-slate-200 inline-flex items-center gap-1 cursor-pointer"
            title="Centralizar e enquadrar todas as mesas"
          >
            <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Enquadrar</span>
          </button>
          <button
            type="button"
            onClick={() => setShowMinimap((m) => !m)}
            className={`px-2.5 h-9 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
              showMinimap ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white'
            }`}
            title="Mostrar ou ocultar minimapa"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Minimapa</span>
          </button>
        </div>

        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="hidden md:flex absolute left-3 top-3 z-30 items-center gap-3 px-3 py-1.5 rounded-lg bg-[#0B1217]/90 border border-white/10 text-[11px] text-slate-300"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
            Livre ({salonSummary.livres})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
            Reservada ({salonSummary.reservadas})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 inline-block" />
            Comanda / Sentada ({salonSummary.sentadas})
          </span>
          {salonSummary.espera > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block" />
              Espera ({salonSummary.espera})
            </span>
          )}
        </div>

        {showMinimap && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleMinimapClick}
            style={{ width: `${minimapMetrics.mapW}px`, height: `${minimapMetrics.mapH}px` }}
            className="absolute right-3 bottom-3 z-30 rounded-lg bg-[#070C10]/95 border border-white/20 shadow-2xl overflow-hidden cursor-crosshair"
            title="Toque no minimapa para mover a câmera rapidamente"
          >
            {layout.environments.map((env) => (
              <div
                key={env.id}
                style={{
                  left: `${env.x * minimapMetrics.scale}px`,
                  top: `${env.y * minimapMetrics.scale}px`,
                  width: `${Math.max(4, env.width * minimapMetrics.scale)}px`,
                  height: `${Math.max(3, env.height * minimapMetrics.scale)}px`,
                  borderColor: `${env.corHex}88`,
                  backgroundColor: `${env.corHex}1A`
                }}
                className="absolute border rounded-[2px] pointer-events-none"
              />
            ))}
            {layout.tables.map((t) => {
              const st = getTableOperationalState(t).state;
              const dotColor =
                st === 'sentada'
                  ? '#38BDF8'
                  : st === 'reservada'
                  ? '#F59E0B'
                  : st === 'espera'
                  ? '#F43F5E'
                  : '#10B981';
              return (
                <div
                  key={t.id}
                  style={{
                    left: `${t.x * minimapMetrics.scale}px`,
                    top: `${t.y * minimapMetrics.scale}px`,
                    width: `${Math.max(3, t.width * minimapMetrics.scale)}px`,
                    height: `${Math.max(3, t.height * minimapMetrics.scale)}px`,
                    backgroundColor: dotColor
                  }}
                  className="absolute rounded-[1px] pointer-events-none"
                />
              );
            })}
            <div
              style={{
                left: `${minimapMetrics.vpLeft}px`,
                top: `${minimapMetrics.vpTop}px`,
                width: `${minimapMetrics.vpWidth}px`,
                height: `${minimapMetrics.vpHeight}px`
              }}
              className="absolute border-2 border-white/90 bg-white/10 rounded-[2px] pointer-events-none"
            />
          </div>
        )}

        {drawerOpen && (selectedTable || (editMode && selectedEnvironment)) && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:w-[390px] max-h-[78%] sm:max-h-none z-40 bg-[#0B1217]/98 border-t sm:border-t-0 sm:border-l border-white/15 shadow-2xl flex flex-col overflow-hidden rounded-t-2xl sm:rounded-none"
          >
            <div className="px-4 py-3 bg-slate-950/90 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
              {selectedTable ? (
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold font-mono tabular-nums text-white">
                      Mesa {selectedTable.codigo}
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-mono tabular-nums text-emerald-300">
                      {selectedTable.lugares} lugares
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {selectedTable.ambienteNome} ·{' '}
                    {modoData === 'dia'
                      ? formatShortDateBR(diaSelecionado)
                      : `${formatShortDateBR(periodoInicio)} a ${formatShortDateBR(periodoFim)}`}
                  </div>
                </div>
              ) : (
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">
                    {selectedEnvironment?.nome}
                  </div>
                  <div className="text-xs text-slate-400">Configuração do Ambiente</div>
                </div>
              )}

              <div className="flex items-center gap-1 shrink-0">
                {editMode && (selectedTable || selectedEnvironment) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedTable) {
                        setLayout((prev) => ({
                          ...prev,
                          tables: prev.tables.filter((t) => t.id !== selectedTable.id)
                        }));
                      } else if (selectedEnvironment) {
                        setLayout((prev) => ({
                          ...prev,
                          environments: prev.environments.filter(
                            (ev) => ev.id !== selectedEnvironment.id
                          )
                        }));
                      }
                      setDirtyLayout(true);
                      setSelectedId(null);
                      setDrawerOpen(false);
                    }}
                    className="w-9 h-9 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 flex items-center justify-center cursor-pointer"
                    title="Excluir item da planta"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="w-9 h-9 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
                  aria-label="Fechar painel da mesa"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedTable && (() => {
                const op = getTableOperationalState(selectedTable);
                const linkedReservas = reservasByTableId[selectedTable.id] || [];

                return (
                  <>
                    {op.comanda && (
                      <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-400/40 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-sky-300">
                              Comanda Aberta no PDV ({op.comanda.identificador})
                            </div>
                            <div className="text-[11px] text-slate-300">
                              {op.comanda.cliente_nome || 'Cliente em atendimento'} ·{' '}
                              <span className="font-mono tabular-nums">
                                {op.comanda.itens?.length || 0} itens
                              </span>
                            </div>
                          </div>
                          <div className="text-right font-mono tabular-nums">
                            <div className="text-xs text-slate-400">Saldo</div>
                            <div className="text-sm font-bold text-sky-200">
                              {formatBRLCompact(op.comanda.saldo_restante)}
                            </div>
                          </div>
                        </div>

                        {onOpenTableInPdv && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsFullscreen(false);
                              setDrawerOpen(false);
                              onOpenTableInPdv({
                                mesaCodigo: op.comanda?.mesa_numero || selectedTable.codigo,
                                comandaId: op.comanda?.id || null
                              });
                            }}
                            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Utensils className="w-4 h-4" />
                            <span>Ir para Comanda desta Mesa no PDV</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-200">
                          Reservas desta Mesa ({linkedReservas.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsFullscreen(false);
                            onOpenNewReservaAtTable({
                              mesa: selectedTable.codigo,
                              mesas_vinculadas: [selectedTable.codigo],
                              area: selectedTable.ambienteNome,
                              lugares: selectedTable.lugares,
                              data: modoData === 'dia' ? diaSelecionado : periodoInicio
                            });
                          }}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Nova Reserva</span>
                        </button>
                      </div>

                      {linkedReservas.length === 0 ? (
                        <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 space-y-3">
                          <div className="text-xs text-slate-400">
                            Mesa livre sem reserva para a data selecionada.
                          </div>

                          {!op.comanda && onOpenTableInPdv && (
                            <div className="pt-2 border-t border-white/10 space-y-2">
                              <div className="text-xs font-semibold text-emerald-300">
                                Atendimento Direto sem Reserva (Walk-in)
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <input
                                  type="text"
                                  value={walkInNome}
                                  onChange={(e) => setWalkInNome(e.target.value)}
                                  placeholder="Cliente (opcional)"
                                  className="col-span-2 px-2.5 py-2 text-xs rounded-lg bg-slate-900 border border-white/15 text-slate-100"
                                />
                                <div className="flex items-center justify-between px-2 rounded-lg bg-slate-900 border border-white/15">
                                  <button
                                    type="button"
                                    onClick={() => setWalkInPessoas((p) => Math.max(1, p - 1))}
                                    className="p-1 text-slate-300 hover:text-white cursor-pointer"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="text-xs font-mono font-bold tabular-nums text-white">
                                    {walkInPessoas}p
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setWalkInPessoas((p) => Math.min(30, p + 1))}
                                    className="p-1 text-slate-300 hover:text-white cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={savingAction}
                                onClick={handleWalkInOpenPdv}
                                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Utensils className="w-4 h-4" />
                                <span>Abrir Mesa Direto no PDV</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {linkedReservas.map((r: any) => {
                            const pax = computeReservaPax(r);
                            const joined = getReservaJoinedCodes(r);
                            const isSeated = String(r.status || '').toLowerCase() === 'sentada';

                            return (
                              <div
                                key={r.id}
                                className="p-3 rounded-xl bg-slate-950/80 border border-white/15 space-y-2.5"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-sm font-bold text-white truncate">
                                      {r.cliente}
                                    </div>
                                    <div className="text-xs text-slate-400 font-mono tabular-nums">
                                      {r.hora || '20:00'} · {pax} pax · {r.status || 'Confirmada'}
                                    </div>
                                  </div>
                                  <span className="text-xs font-mono tabular-nums text-amber-300 shrink-0">
                                    {joined.join(' + ')}
                                  </span>
                                </div>

                                {!op.comanda && (
                                  <button
                                    type="button"
                                    disabled={savingAction}
                                    onClick={() => handleSitReservaAndOpenPdv(r)}
                                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                                  >
                                    <Check className="w-4 h-4" />
                                    <span>
                                      {isSeated
                                        ? 'Abrir Comanda desta Reserva no PDV'
                                        : 'Sentar Cliente & Abrir Comanda no PDV'}
                                    </span>
                                  </button>
                                )}

                                <div className="grid grid-cols-3 gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenJoinPickerForReserva(r)}
                                    className="min-h-[38px] px-2 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-200 text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Link2 className="w-3.5 h-3.5" />
                                    <span>Juntar ({joined.length})</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsFullscreen(false);
                                      onOpenEditReserva(r);
                                    }}
                                    className="min-h-[38px] px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Editar</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={savingAction}
                                    onClick={() => handleUnlinkReservaFromTable(r)}
                                    className="min-h-[38px] px-2 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Unlink className="w-3.5 h-3.5" />
                                    <span>Soltar</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {joinPickerOpen && joinReservaTargetId && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/40 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-200">
                            Juntar Mesas na Mesma Reserva
                          </span>
                          <button
                            type="button"
                            onClick={() => setJoinPickerOpen(false)}
                            className="text-xs text-slate-400 hover:text-white cursor-pointer"
                          >
                            Fechar
                          </button>
                        </div>

                        <div className="text-[11px] font-mono tabular-nums text-slate-300">
                          Selecionadas ({joinSelectedCodes.length}):{' '}
                          <strong className="text-white">{joinSelectedCodes.join(' + ')}</strong> (
                          {joinSelectedCodes.reduce((acc, c) => {
                            const found = layout.tables.find(
                              (t) => normalizeTableCode(t.codigo) === normalizeTableCode(c)
                            );
                            return acc + (found?.lugares || 0);
                          }, 0)}{' '}
                          lugares somados)
                        </div>

                        <input
                          type="text"
                          value={joinSearchFilter}
                          onChange={(e) => setJoinSearchFilter(e.target.value)}
                          placeholder="Filtrar mesa (ex: M-14)..."
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-white/15 text-slate-100"
                        />

                        <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
                          {[...layout.tables]
                            .filter((t) =>
                              !joinSearchFilter.trim()
                                ? true
                                : t.codigo.toLowerCase().includes(joinSearchFilter.trim().toLowerCase())
                            )
                            .sort((a, b) => {
                              const aSame = a.ambienteId === selectedTable.ambienteId ? 0 : 1;
                              const bSame = b.ambienteId === selectedTable.ambienteId ? 0 : 1;
                              if (aSame !== bSame) return aSame - bSame;
                              const distA = Math.hypot(a.x - selectedTable.x, a.y - selectedTable.y);
                              const distB = Math.hypot(b.x - selectedTable.x, b.y - selectedTable.y);
                              return distA - distB;
                            })
                            .map((t) => {
                              const checked = joinSelectedCodes.some(
                                (c) => normalizeTableCode(c) === normalizeTableCode(t.codigo)
                              );
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => {
                                    setJoinSelectedCodes((prev) => {
                                      const exists = prev.some(
                                        (c) => normalizeTableCode(c) === normalizeTableCode(t.codigo)
                                      );
                                      if (exists) {
                                        if (prev.length <= 1) return prev;
                                        return prev.filter(
                                          (c) => normalizeTableCode(c) !== normalizeTableCode(t.codigo)
                                        );
                                      }
                                      return [...prev, t.codigo];
                                    });
                                  }}
                                  className={`py-2 px-1.5 rounded-lg text-xs font-mono tabular-nums font-bold border cursor-pointer ${
                                    checked
                                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                                      : 'bg-slate-950 text-slate-300 border-white/10 hover:border-white/30'
                                  }`}
                                >
                                  {t.codigo} ({t.lugares}L)
                                </button>
                              );
                            })}
                        </div>

                        <button
                          type="button"
                          disabled={savingAction}
                          onClick={handleSaveJoinedTables}
                          className="w-full min-h-[42px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                        >
                          Confirmar Junção ({joinSelectedCodes.length} Mesas)
                        </button>
                      </div>
                    )}

                    <div className="pt-2 border-t border-white/10 space-y-1.5">
                      <label className="block text-xs text-slate-300 font-semibold">
                        Alocar Reserva Existente nesta Mesa
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={linkingReservaId}
                          onChange={(e) => setLinkingReservaId(e.target.value)}
                          className="flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-slate-950 border border-white/15 text-xs text-slate-100"
                        >
                          <option value="">Selecionar reserva do período...</option>
                          {activeReservasInWindow.map((r: any) => (
                            <option key={r.id} value={r.id}>
                              {r.hora} — {r.cliente} ({r.mesa || 'Sem mesa'})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!linkingReservaId || savingAction}
                          onClick={() => handleLinkReservaToSelectedTable(Number(linkingReservaId))}
                          className="min-h-[40px] px-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-bold cursor-pointer shrink-0"
                        >
                          Vincular
                        </button>
                      </div>
                    </div>

                    {editMode && (
                      <div className="pt-3 border-t border-white/10 space-y-3">
                        <div className="text-xs font-bold text-amber-300">
                          Geometria & Capacidade da Mesa
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 text-xs">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Código</label>
                            <input
                              type="text"
                              value={selectedTable.codigo}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDirtyLayout(true);
                                setLayout((prev) => ({
                                  ...prev,
                                  tables: prev.tables.map((t) =>
                                    t.id === selectedTable.id ? { ...t, codigo: val } : t
                                  )
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/15 font-mono text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Setor</label>
                            <select
                              value={selectedTable.ambienteId}
                              onChange={(e) => {
                                const envId = e.target.value;
                                const envObj = ambienteZones.find((z) => z.id === envId);
                                setDirtyLayout(true);
                                setLayout((prev) => ({
                                  ...prev,
                                  tables: prev.tables.map((t) =>
                                    t.id === selectedTable.id
                                      ? {
                                          ...t,
                                          ambienteId: envId,
                                          ambienteNome: envObj?.nome || t.ambienteNome
                                        }
                                      : t
                                  )
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/15 text-white"
                            >
                              {ambienteZones.map((env) => (
                                <option key={env.id} value={env.id}>
                                  {env.nome}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Quantidade de Lugares
                          </label>
                          <div className="grid grid-cols-7 gap-1">
                            {SEAT_OPTIONS.map((qtd) => (
                              <button
                                key={qtd}
                                type="button"
                                onClick={() => {
                                  const dims = getDefaultDimensionsForSeatCount(qtd, selectedTable.formato);
                                  setDirtyLayout(true);
                                  setLayout((prev) => ({
                                    ...prev,
                                    tables: prev.tables.map((t) =>
                                      t.id === selectedTable.id
                                        ? { ...t, lugares: qtd, width: dims.width, height: dims.height }
                                        : t
                                    )
                                  }));
                                }}
                                className={`py-1.5 rounded-lg text-xs font-mono tabular-nums font-bold border cursor-pointer ${
                                  selectedTable.lugares === qtd
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                    : 'bg-slate-950 text-slate-300 border-white/10'
                                }`}
                              >
                                {qtd}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            [
                              { id: 'quadrada', label: 'Quadrada' },
                              { id: 'redonda', label: 'Redonda' },
                              { id: 'retangular', label: 'Retangular' }
                            ] as const
                          ).map((fmt) => (
                            <button
                              key={fmt.id}
                              type="button"
                              onClick={() => {
                                const dims = getDefaultDimensionsForSeatCount(selectedTable.lugares, fmt.id);
                                setDirtyLayout(true);
                                setLayout((prev) => ({
                                  ...prev,
                                  tables: prev.tables.map((t) =>
                                    t.id === selectedTable.id
                                      ? { ...t, formato: fmt.id, width: dims.width, height: dims.height }
                                      : t
                                  )
                                }));
                              }}
                              className={`py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                                selectedTable.formato === fmt.id
                                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                                  : 'bg-slate-950 text-slate-300 border-white/10'
                              }`}
                            >
                              {fmt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {!selectedTable && selectedEnvironment && editMode && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Nome do Ambiente</label>
                    <input
                      type="text"
                      value={selectedEnvironment.nome}
                      onChange={(e) => {
                        const novoNome = e.target.value;
                        setDirtyLayout(true);
                        setLayout((prev) => ({
                          ...prev,
                          environments: prev.environments.map((ev) =>
                            ev.id === selectedEnvironment.id ? { ...ev, nome: novoNome } : ev
                          ),
                          tables: prev.tables.map((t) =>
                            t.ambienteId === selectedEnvironment.id
                              ? { ...t, ambienteNome: novoNome }
                              : t
                          )
                        }));
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Largura ({selectedEnvironment.width}px)
                      </label>
                      <input
                        type="number"
                        min={100}
                        max={3600}
                        step={20}
                        value={selectedEnvironment.width}
                        onChange={(e) => {
                          const w = Math.max(100, Number(e.target.value || 100));
                          setDirtyLayout(true);
                          setLayout((prev) => ({
                            ...prev,
                            canvasWidth: Math.max(prev.canvasWidth || 1200, selectedEnvironment.x + w + 80),
                            environments: prev.environments.map((ev) =>
                              ev.id === selectedEnvironment.id ? { ...ev, width: w } : ev
                            )
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/15 font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Altura ({selectedEnvironment.height}px)
                      </label>
                      <input
                        type="number"
                        min={52}
                        max={2800}
                        step={20}
                        value={selectedEnvironment.height}
                        onChange={(e) => {
                          const h = Math.max(52, Number(e.target.value || 52));
                          setDirtyLayout(true);
                          setLayout((prev) => ({
                            ...prev,
                            canvasHeight: Math.max(prev.canvasHeight || 720, selectedEnvironment.y + h + 80),
                            environments: prev.environments.map((ev) =>
                              ev.id === selectedEnvironment.id ? { ...ev, height: h } : ev
                            )
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/15 font-mono text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Cor Identificadora</label>
                    <input
                      type="color"
                      value={selectedEnvironment.corHex}
                      onChange={(e) => {
                        const hex = e.target.value;
                        setDirtyLayout(true);
                        setLayout((prev) => ({
                          ...prev,
                          environments: prev.environments.map((ev) =>
                            ev.id === selectedEnvironment.id ? { ...ev, corHex: hex } : ev
                          )
                        }));
                      }}
                      className="w-full h-9 rounded-lg bg-slate-950 border border-white/15 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {modalBatchOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#0B1217] border border-amber-500/45 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Gerador de Mesas em Lote</h3>
                <p className="text-xs text-slate-400">
                  Monte dezenas de mesas numeradas em segundos com corredores automáticos
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalBatchOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { label: '67 Mesas (250+ Clientes)', count: 67, cols: 8, mode: 'auto_setores_67' },
                { label: '40 Mesas', count: 40, cols: 8, mode: ambienteZones[0]?.id || 'novo_ambiente' },
                { label: '24 Mesas', count: 24, cols: 6, mode: ambienteZones[0]?.id || 'novo_ambiente' },
                { label: '12 Mesas', count: 12, cols: 4, mode: ambienteZones[0]?.id || 'novo_ambiente' }
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setBatchCount(p.count);
                    setBatchCols(p.cols);
                    setBatchStartNum(1);
                    setBatchPrefix('M-');
                    setBatchEnvMode(p.mode);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                    batchCount === p.count
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                      : 'bg-slate-950 text-slate-300 border-white/15 hover:border-white/30'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Prefixo</label>
                <input
                  type="text"
                  value={batchPrefix}
                  onChange={(e) => setBatchPrefix(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-white/15 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Nº Inicial</label>
                <input
                  type="number"
                  min={1}
                  value={batchStartNum}
                  onChange={(e) => setBatchStartNum(Math.max(1, Number(e.target.value || 1)))}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-white/15 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Quantidade</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={batchCount}
                  onChange={(e) => setBatchCount(Math.min(200, Math.max(1, Number(e.target.value || 1))))}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-white/15 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Colunas/Fila</label>
                <input
                  type="number"
                  min={2}
                  max={14}
                  value={batchCols}
                  onChange={(e) => setBatchCols(Math.min(14, Math.max(2, Number(e.target.value || 6))))}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-white/15 font-mono text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Destino na Planta</label>
                <select
                  value={batchEnvMode}
                  onChange={(e) => setBatchEnvMode(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-white/15 text-white"
                >
                  <option value="auto_setores_67">
                    Distribuição Multi-Setor (Salão + Varanda + Deck + VIP)
                  </option>
                  {ambienteZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      Setor: {z.nome}
                    </option>
                  ))}
                  <option value="novo_ambiente">+ Criar Novo Setor Expandido</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Lugares por Mesa</label>
                <select
                  value={batchSeats}
                  onChange={(e) => setBatchSeats(Number(e.target.value) as SeatCapacityOption)}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-white/15 font-mono text-white"
                >
                  {SEAT_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s} lugares ({batchCount * s} lugares no lote)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {batchEnvMode === 'novo_ambiente' && (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Nome do Novo Setor</label>
                <input
                  type="text"
                  value={batchNewEnvName}
                  onChange={(e) => setBatchNewEnvName(e.target.value)}
                  placeholder="Ex: Anexo Eventos, Salão Superior..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-xs text-white"
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={batchReplaceExisting}
                onChange={(e) => setBatchReplaceExisting(e.target.checked)}
                className="accent-amber-500"
              />
              <span>Substituir mesas existentes na planta antes de gerar o lote</span>
            </label>

            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono tabular-nums text-slate-300">
              Prévia: <strong>{batchPrefix}{String(batchStartNum).padStart(batchDigits, '0')}</strong> até{' '}
              <strong>{batchPrefix}{String(batchStartNum + batchCount - 1).padStart(batchDigits, '0')}</strong> ({batchCount} mesas)
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalBatchOpen(false)}
                className="min-h-[42px] px-4 rounded-xl bg-white/10 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteBatchGenerator}
                className="min-h-[42px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Gerar {batchCount} Mesas Agora
              </button>
            </div>
          </div>
        </div>
      )}

      {modalDimensoesOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#0B1217] border border-white/20 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Dimensões da Planta do Salão</h3>
                <p className="text-xs text-slate-400">Expanda a área disponível para distribuir novos setores</p>
              </div>
              <button
                type="button"
                onClick={() => setModalDimensoesOpen(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Largura Total (px)</label>
                <input
                  type="number"
                  min={960}
                  max={4600}
                  step={100}
                  value={layout.canvasWidth || canvasBounds.width}
                  onChange={(e) => {
                    const w = Math.min(4600, Math.max(960, Number(e.target.value || 1200)));
                    setDirtyLayout(true);
                    setLayout((prev) => ({ ...prev, canvasWidth: w }));
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Altura Total (px)</label>
                <input
                  type="number"
                  min={600}
                  max={3400}
                  step={100}
                  value={layout.canvasHeight || canvasBounds.height}
                  onChange={(e) => {
                    const h = Math.min(3400, Math.max(600, Number(e.target.value || 800)));
                    setDirtyLayout(true);
                    setLayout((prev) => ({ ...prev, canvasHeight: h }));
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 font-mono text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setDirtyLayout(true);
                  setLayout((prev) => ({
                    ...prev,
                    canvasWidth: Math.min(4600, (prev.canvasWidth || canvasBounds.width) + 600),
                    canvasHeight: Math.min(3400, (prev.canvasHeight || canvasBounds.height) + 400)
                  }));
                }}
                className="px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold cursor-pointer"
              >
                + Expandir (+600x400px)
              </button>
              <button
                type="button"
                onClick={() => {
                  const stripped = { ...layout, canvasWidth: 0, canvasHeight: 0 };
                  const fitted = resolveCanvasBounds(stripped);
                  setDirtyLayout(true);
                  setLayout((prev) => ({
                    ...prev,
                    canvasWidth: fitted.width,
                    canvasHeight: fitted.height
                  }));
                }}
                className="px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Auto-Ajustar às Mesas
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setModalDimensoesOpen(false);
                  fitAllSalon();
                }}
                className="min-h-[40px] px-5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {modalModelosOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-[#0B1217] border border-emerald-500/40 p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Modelos de Planta & Presets de Escala</h3>
                <p className="text-xs text-slate-400">
                  Carregue layouts prontos (como Grande Operação de 67 mesas) ou salve os seus
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalModelosOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setModalModelosOpen(false);
                  setNomeNovoModelo('');
                  setDescNovoModelo('');
                  setModalSalvarComoOpen(true);
                }}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Planta Atual como Modelo</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Exportar JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Importar JSON</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 pr-1">
              {allAvailableTemplates.map((tpl) => {
                const numMesas = tpl.layout?.tables?.length || 0;
                const numLugares = (tpl.layout?.tables || []).reduce(
                  (acc, t) => acc + Number(t.lugares || 0),
                  0
                );
                const isCustom = tpl.tipo === 'custom';

                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleLoadTemplate(tpl)}
                    className="p-4 rounded-xl bg-slate-950 border border-white/15 hover:border-emerald-400/60 transition-colors cursor-pointer flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>{isCustom ? 'Modelo Salvo' : 'Preset Oficial'}</span>
                        {isCustom && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustomTemplate(tpl.id, e)}
                            className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-white">{tpl.nome}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{tpl.descricao}</p>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-mono tabular-nums text-emerald-300">
                      <span>
                        {numMesas} mesas · {numLugares} lug.
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold">
                        Aplicar <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {modalSalvarComoOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#0B1217] border border-emerald-500/40 p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Salvar Planta como Modelo</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Nome do Modelo</label>
                <input
                  type="text"
                  value={nomeNovoModelo}
                  onChange={(e) => setNomeNovoModelo(e.target.value)}
                  placeholder="Ex: Sexta Lotação Máxima (67 Mesas)"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={descNovoModelo}
                  onChange={(e) => setDescNovoModelo(e.target.value)}
                  placeholder="Opcional..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalSalvarComoOpen(false)}
                className="min-h-[40px] px-4 rounded-xl bg-white/10 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveAsNewCustomTemplate}
                className="min-h-[40px] px-5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Salvar Modelo
              </button>
            </div>
          </div>
        </div>
      )}

      {modalLimparOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#0B1217] border border-rose-500/45 p-5 shadow-2xl space-y-3">
            <h3 className="text-base font-bold text-white">Redefinir ou Limpar Planta</h3>

            <button
              type="button"
              onClick={() => {
                setLayout((prev) => ({ ...prev, tables: [] }));
                setDirtyLayout(true);
                setSelectedId(null);
                setModalLimparOpen(false);
              }}
              className="w-full p-3 rounded-xl bg-slate-950 hover:bg-rose-500/10 border border-white/15 text-left cursor-pointer"
            >
              <div className="text-xs font-bold text-rose-300">Remover Apenas as Mesas</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Mantém os ambientes desenhados para gerar uma nova numeração em lote.
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setLayout(buildGrandeOperacao67Layout());
                setDirtyLayout(true);
                setSelectedId(null);
                setModalLimparOpen(false);
                window.setTimeout(fitAllSalon, 60);
              }}
              className="w-full p-3 rounded-xl bg-slate-950 hover:bg-emerald-500/10 border border-emerald-500/35 text-left cursor-pointer"
            >
              <div className="text-xs font-bold text-emerald-300">
                Carregar Grande Operação (67 Mesas / 276 Lugares)
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Aplica o mapa completo para restaurantes de grande capacidade.
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setLayout(DEFAULT_TAPIRI_LAYOUT);
                setDirtyLayout(true);
                setSelectedId(null);
                setModalLimparOpen(false);
                window.setTimeout(fitAllSalon, 60);
              }}
              className="w-full p-3 rounded-xl bg-slate-950 hover:bg-white/5 border border-white/15 text-left cursor-pointer"
            >
              <div className="text-xs font-bold text-slate-200">Restaurar Planta Compacta (13 Mesas)</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Retorna ao modelo compacto para casas menores.
              </div>
            </button>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalLimparOpen(false)}
                className="min-h-[38px] px-4 rounded-xl bg-white/10 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
