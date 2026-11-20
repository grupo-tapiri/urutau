import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  Copy,
  Edit3,
  Eraser,
  Grid,
  Layers,
  Link2,
  Lock,
  Maximize2,
  Minimize2,
  Move,
  Palette,
  PenTool,
  Pin,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Square,
  StickyNote,
  Trash2,
  Unlock,
  User,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

export type WhiteboardPinStyle =
  | 'red'
  | 'gold'
  | 'emerald'
  | 'cyan'
  | 'purple'
  | 'star'
  | 'alert'
  | 'none';

export interface WhiteboardChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface WhiteboardPostIt {
  id: string;
  title: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  colorHex: string;
  textColorHex?: string;
  pinStyle: WhiteboardPinStyle;
  pinColorHex: string;
  tag: string;
  dueTime?: string;
  checklist: WhiteboardChecklistItem[];
  locked?: boolean;
  zIndex: number;
}

export interface WhiteboardPinMarker {
  id: string;
  label: string;
  numberBadge?: number;
  iconType: 'pin' | 'star' | 'alert' | 'check' | 'fire' | 'flag';
  x: number;
  y: number;
  colorHex: string;
  notes?: string;
  locked?: boolean;
  zIndex: number;
}

export interface WhiteboardZone {
  id: string;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  colorHex: string;
  borderStyle: 'solid' | 'dashed';
  rounded: boolean;
  locked?: boolean;
}

export interface WhiteboardConnection {
  id: string;
  fromId: string;
  toId: string;
  colorHex: string;
  label?: string;
  dashed?: boolean;
}

export interface WhiteboardStroke {
  id: string;
  colorHex: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

export interface PersonalBoardSheet {
  id: string;
  name: string;
  bgMode: 'dots' | 'grid' | 'clean';
  snapToGrid: boolean;
  zones: WhiteboardZone[];
  postIts: WhiteboardPostIt[];
  pins: WhiteboardPinMarker[];
  connections: WhiteboardConnection[];
  strokes: WhiteboardStroke[];
  updatedAt: string;
}

export interface PersonalWhiteboardState {
  activeBoardId: string;
  boards: PersonalBoardSheet[];
}

const COLOR_PRESETS: Array<{ name: string; hex: string; textHex: string }> = [
  { name: 'Amarelo Solar', hex: '#FACC15', textHex: '#0F172A' },
  { name: 'Esmeralda Urutau', hex: '#10B981', textHex: '#052E16' },
  { name: 'Ciano Igapó', hex: '#06B6D4', textHex: '#083344' },
  { name: 'Laranja Tucumã', hex: '#F97316', textHex: '#270E03' },
  { name: 'Rosa Coral', hex: '#F43F5E', textHex: '#FFF1F2' },
  { name: 'Roxo Açaí', hex: '#8B5CF6', textHex: '#F5F3FF' },
  { name: 'Azul Noturno', hex: '#2563EB', textHex: '#EFF6FF' },
  { name: 'Grafite Brutal', hex: '#1E293B', textHex: '#F8FAFC' }
];

const PIN_STYLE_META: Record<
  WhiteboardPinStyle,
  { label: string; defaultColor: string; symbol: string }
> = {
  red: { label: 'Pino Vermelho', defaultColor: '#EF4444', symbol: '📌' },
  gold: { label: 'Pino Ouro', defaultColor: '#F59E0B', symbol: '📍' },
  emerald: { label: 'Pino Esmeralda', defaultColor: '#10B981', symbol: '🟢' },
  cyan: { label: 'Pino Ciano', defaultColor: '#06B6D4', symbol: '💎' },
  purple: { label: 'Pino Roxo', defaultColor: '#A855F7', symbol: '🟣' },
  star: { label: 'Estrela / Meta', defaultColor: '#FACC15', symbol: '⭐' },
  alert: { label: 'Alerta / Urgente', defaultColor: '#F43F5E', symbol: '🔥' },
  none: { label: 'Sem Pino', defaultColor: '#64748B', symbol: '—' }
};

const TAG_OPTIONS = ['HOJE', 'URGENTE', 'ROTINA', 'META', 'IDEIA', 'AGUARDANDO', 'CONCLUÍDO'];

function createDefaultBoard(userName: string): PersonalBoardSheet {
  return {
    id: 'board_principal',
    name: `Quadro de ${userName || 'Colaborador'}`,
    bgMode: 'dots',
    snapToGrid: false,
    updatedAt: new Date().toISOString(),
    zones: [
      {
        id: 'zone_todo',
        title: '1. PARA FAZER HOJE',
        subtitle: 'Prioridades e pendências do turno',
        x: 30,
        y: 30,
        width: 340,
        height: 470,
        colorHex: '#F59E0B',
        borderStyle: 'dashed',
        rounded: true
      },
      {
        id: 'zone_doing',
        title: '2. EM ANDAMENTO / FOCO',
        subtitle: 'O que estou executando agora',
        x: 395,
        y: 30,
        width: 340,
        height: 470,
        colorHex: '#06B6D4',
        borderStyle: 'solid',
        rounded: true
      },
      {
        id: 'zone_done',
        title: '3. CONCLUÍDO & IDEIAS',
        subtitle: 'Entregas finalizadas e anotações livres',
        x: 760,
        y: 30,
        width: 340,
        height: 470,
        colorHex: '#10B981',
        borderStyle: 'dashed',
        rounded: true
      }
    ],
    postIts: [
      {
        id: 'post_1',
        title: 'Rotina do Meu Turno',
        content: 'Organize aqui seus lembretes pessoais, checklists rápidos e prioridades do dia.',
        x: 55,
        y: 95,
        width: 280,
        height: 220,
        colorHex: '#FACC15',
        textColorHex: '#0F172A',
        pinStyle: 'red',
        pinColorHex: '#EF4444',
        tag: 'HOJE',
        dueTime: '18:00',
        checklist: [
          { id: 'chk_1', text: 'Conferir abertura da minha praça', done: true },
          { id: 'chk_2', text: 'Revisar pendências prioritárias', done: false }
        ],
        zIndex: 10
      },
      {
        id: 'post_2',
        title: 'Meta Pessoal da Semana',
        content: 'Arraste este post-it, mude a cor, adicione pinos ou conecte com outros cartões.',
        x: 425,
        y: 105,
        width: 275,
        height: 190,
        colorHex: '#10B981',
        textColorHex: '#052E16',
        pinStyle: 'star',
        pinColorHex: '#FACC15',
        tag: 'META',
        dueTime: '22:00',
        checklist: [],
        zIndex: 11
      }
    ],
    pins: [
      {
        id: 'pin_1',
        label: 'Atenção no Pico',
        numberBadge: 1,
        iconType: 'fire',
        x: 350,
        y: 55,
        colorHex: '#F43F5E',
        notes: 'Pino de destaque para horário de pico',
        zIndex: 25
      },
      {
        id: 'pin_2',
        label: 'Meta Batida',
        numberBadge: 2,
        iconType: 'star',
        x: 880,
        y: 120,
        colorHex: '#10B981',
        notes: 'Marcador de conquista pessoal',
        zIndex: 26
      }
    ],
    connections: [
      {
        id: 'conn_1',
        fromId: 'post_1',
        toId: 'post_2',
        colorHex: '#F59E0B',
        label: 'Fluxo do dia',
        dashed: true
      }
    ],
    strokes: []
  };
}

function getContrastText(hex: string): string {
  const clean = String(hex || '#FACC15').replace('#', '').trim();
  if (clean.length < 6) return '#0F172A';
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 145 ? '#0F172A' : '#F8FAFC';
}

export const PersonalWhiteboardCanvas: React.FC<{
  currentUser: any;
  usuarios?: any[];
  accentHex?: string;
}> = ({ currentUser, usuarios = [], accentHex = '#10B981' }) => {
  const isSuperOrGestor = useMemo(() => {
    const tipo = String(currentUser?.tipo || '').toLowerCase();
    const cargo = String(currentUser?.cargo || '').toLowerCase();
    return (
      Number(currentUser?.id) === 1 ||
      tipo.includes('super') ||
      tipo.includes('gestor') ||
      cargo.includes('propriet') ||
      cargo.includes('diretor') ||
      cargo.includes('gerente')
    );
  }, [currentUser]);

  const [viewedUserKey, setViewedUserKey] = useState<string>(() => {
    const idPart = currentUser?.id || 1;
    const namePart = String(currentUser?.nome || 'operador')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');
    return `${idPart}_${namePart}`;
  });

  useEffect(() => {
    const idPart = currentUser?.id || 1;
    const namePart = String(currentUser?.nome || 'operador')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');
    setViewedUserKey(`${idPart}_${namePart}`);
  }, [currentUser?.id, currentUser?.nome]);

  const storageKey = `urutau_whiteboard_v1_${viewedUserKey}`;

  const [state, setState] = useState<PersonalWhiteboardState>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.boards) && parsed.boards.length > 0) {
          return parsed;
        }
      }
    } catch {}
    const def = createDefaultBoard(currentUser?.nome || 'Colaborador');
    return {
      activeBoardId: def.id,
      boards: [def]
    };
  });

  const [saveStatus, setSaveStatus] = useState<'salvo' | 'salvando'>('salvo');
  const [zoom, setZoom] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<'select' | 'postit' | 'pin' | 'zone' | 'connect' | 'draw'>('select');
  const [activeColorHex, setActiveColorHex] = useState<string>('#FACC15');
  const [activePinStyle, setActivePinStyle] = useState<WhiteboardPinStyle>('red');
  const [selectedItemId, setSelectedItemId] = useState<string | null>('post_1');
  const [selectedItemKind, setSelectedItemKind] = useState<'postit' | 'pin' | 'zone' | null>('postit');
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newChecklistText, setNewChecklistText] = useState<string>('');
  const [newBoardNameInput, setNewBoardNameInput] = useState<string>('');
  const [showNewBoardModal, setShowNewBoardModal] = useState<boolean>(false);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    kind: 'postit' | 'pin' | 'zone' | 'resize_postit' | 'resize_zone';
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);
  const drawingStrokeRef = useRef<WhiteboardStroke | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const localRaw = localStorage.getItem(storageKey);
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (Array.isArray(parsed?.boards) && parsed.boards.length > 0) {
          setState(parsed);
        }
      } else {
        const def = createDefaultBoard(currentUser?.nome || 'Colaborador');
        setState({ activeBoardId: def.id, boards: [def] });
      }
    } catch {}

    fetch(`/api/v31/quadro-branco?usuario_key=${encodeURIComponent(viewedUserKey)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.ok && j?.dados && Array.isArray(j.dados.boards) && j.dados.boards.length > 0) {
          setState(j.dados);
          try {
            localStorage.setItem(storageKey, JSON.stringify(j.dados));
          } catch {}
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [viewedUserKey, storageKey, currentUser?.nome]);

  const persistWhiteboard = useCallback(
    (nextState: PersonalWhiteboardState) => {
      setSaveStatus('salvando');
      try {
        localStorage.setItem(storageKey, JSON.stringify(nextState));
      } catch {}
      fetch('/api/v31/quadro-branco', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_key: viewedUserKey,
          usuario_id: currentUser?.id || 1,
          dados: nextState
        })
      })
        .then(() => setSaveStatus('salvo'))
        .catch(() => setSaveStatus('salvo'));
    },
    [storageKey, viewedUserKey, currentUser?.id]
  );

  const activeBoard = useMemo(() => {
    return (
      state.boards.find((b) => b.id === state.activeBoardId) ||
      state.boards[0] ||
      createDefaultBoard(currentUser?.nome || 'Colaborador')
    );
  }, [state.boards, state.activeBoardId, currentUser?.nome]);

  const updateActiveBoard = useCallback(
    (updater: (board: PersonalBoardSheet) => PersonalBoardSheet) => {
      setState((prev) => {
        const current =
          prev.boards.find((b) => b.id === prev.activeBoardId) ||
          prev.boards[0] ||
          createDefaultBoard(currentUser?.nome || 'Colaborador');
        const updatedBoard = {
          ...updater(current),
          updatedAt: new Date().toISOString()
        };
        const exists = prev.boards.some((b) => b.id === updatedBoard.id);
        const nextBoards = exists
          ? prev.boards.map((b) => (b.id === updatedBoard.id ? updatedBoard : b))
          : [...prev.boards, updatedBoard];
        const nextState: PersonalWhiteboardState = {
          activeBoardId: updatedBoard.id,
          boards: nextBoards
        };
        persistWhiteboard(nextState);
        return nextState;
      });
    },
    [currentUser?.nome, persistWhiteboard]
  );

  const snapVal = useCallback(
    (v: number) => {
      if (!activeBoard.snapToGrid) return Math.round(v);
      return Math.round(v / 20) * 20;
    },
    [activeBoard.snapToGrid]
  );

  const handleAddPostIt = useCallback(
    (customX?: number, customY?: number) => {
      const id = `post_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const offset = (activeBoard.postIts.length % 6) * 24;
      const x = snapVal(customX ?? 80 + offset);
      const y = snapVal(customY ?? 90 + offset);
      const maxZ = activeBoard.postIts.reduce((m, p) => Math.max(m, p.zIndex || 10), 10);
      const newPost: WhiteboardPostIt = {
        id,
        title: 'Nova Nota / Tarefa',
        content: 'Clique para escrever suas anotações, lembretes ou tarefas deste cartão...',
        x,
        y,
        width: 270,
        height: 205,
        colorHex: activeColorHex,
        textColorHex: getContrastText(activeColorHex),
        pinStyle: activePinStyle,
        pinColorHex: PIN_STYLE_META[activePinStyle]?.defaultColor || '#EF4444',
        tag: 'HOJE',
        dueTime: '',
        checklist: [],
        zIndex: maxZ + 1
      };
      updateActiveBoard((b) => ({
        ...b,
        postIts: [...b.postIts, newPost]
      }));
      setSelectedItemId(id);
      setSelectedItemKind('postit');
      setActiveTool('select');
    },
    [activeBoard.postIts, activeColorHex, activePinStyle, snapVal, updateActiveBoard]
  );

  const handleAddPinMarker = useCallback(
    (customX?: number, customY?: number) => {
      const id = `pin_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const nextNum = activeBoard.pins.length + 1;
      const offset = (activeBoard.pins.length % 6) * 28;
      const x = snapVal(customX ?? 220 + offset);
      const y = snapVal(customY ?? 120 + offset);
      const newPin: WhiteboardPinMarker = {
        id,
        label: `Pino #${nextNum}`,
        numberBadge: nextNum,
        iconType: activePinStyle === 'star' ? 'star' : activePinStyle === 'alert' ? 'fire' : 'pin',
        x,
        y,
        colorHex:
          activePinStyle !== 'none'
            ? PIN_STYLE_META[activePinStyle].defaultColor
            : activeColorHex,
        notes: '',
        zIndex: 30 + nextNum
      };
      updateActiveBoard((b) => ({
        ...b,
        pins: [...b.pins, newPin]
      }));
      setSelectedItemId(id);
      setSelectedItemKind('pin');
      setActiveTool('select');
    },
    [activeBoard.pins.length, activePinStyle, activeColorHex, snapVal, updateActiveBoard]
  );

  const handleAddZone = useCallback(
    (customX?: number, customY?: number) => {
      const id = `zone_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const idx = activeBoard.zones.length + 1;
      const x = snapVal(customX ?? 60 + (idx % 3) * 350);
      const y = snapVal(customY ?? 40);
      const newZone: WhiteboardZone = {
        id,
        title: `${idx}. NOVA ÁREA / COLUNA`,
        subtitle: 'Arraste post-its e pinos para dentro desta área',
        x,
        y,
        width: 330,
        height: 440,
        colorHex: activeColorHex,
        borderStyle: 'dashed',
        rounded: true
      };
      updateActiveBoard((b) => ({
        ...b,
        zones: [...b.zones, newZone]
      }));
      setSelectedItemId(id);
      setSelectedItemKind('zone');
      setActiveTool('select');
    },
    [activeBoard.zones.length, activeColorHex, snapVal, updateActiveBoard]
  );

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    if (activeTool === 'draw') {
      e.preventDefault();
      const stroke: WhiteboardStroke = {
        id: `stroke_${Date.now()}`,
        colorHex: activeColorHex,
        width: 3,
        points: [{ x: Math.round(x), y: Math.round(y) }]
      };
      drawingStrokeRef.current = stroke;
      updateActiveBoard((b) => ({
        ...b,
        strokes: [...b.strokes, stroke]
      }));
      return;
    }

    if (e.target === canvasRef.current || (e.target as HTMLElement).dataset.canvasBg === 'true') {
      if (activeTool === 'postit') {
        handleAddPostIt(x - 120, y - 40);
      } else if (activeTool === 'pin') {
        handleAddPinMarker(x - 20, y - 20);
      } else if (activeTool === 'zone') {
        handleAddZone(x - 150, y - 40);
      } else {
        setSelectedItemId(null);
        setSelectedItemKind(null);
        setConnectSourceId(null);
      }
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    if (drawingStrokeRef.current && activeTool === 'draw') {
      const x = Math.round((e.clientX - rect.left) / zoom);
      const y = Math.round((e.clientY - rect.top) / zoom);
      const strokeId = drawingStrokeRef.current.id;
      updateActiveBoard((b) => ({
        ...b,
        strokes: b.strokes.map((s) =>
          s.id === strokeId ? { ...s, points: [...s.points, { x, y }] } : s
        )
      }));
      return;
    }

    if (!dragRef.current) return;
    const d = dragRef.current;
    const dx = (e.clientX - d.startX) / zoom;
    const dy = (e.clientY - d.startY) / zoom;

    if (d.kind === 'postit') {
      const nx = Math.max(0, snapVal(d.origX + dx));
      const ny = Math.max(0, snapVal(d.origY + dy));
      updateActiveBoard((b) => ({
        ...b,
        postIts: b.postIts.map((p) => (p.id === d.id ? { ...p, x: nx, y: ny } : p))
      }));
    } else if (d.kind === 'pin') {
      const nx = Math.max(0, snapVal(d.origX + dx));
      const ny = Math.max(0, snapVal(d.origY + dy));
      updateActiveBoard((b) => ({
        ...b,
        pins: b.pins.map((p) => (p.id === d.id ? { ...p, x: nx, y: ny } : p))
      }));
    } else if (d.kind === 'zone') {
      const nx = Math.max(0, snapVal(d.origX + dx));
      const ny = Math.max(0, snapVal(d.origY + dy));
      updateActiveBoard((b) => ({
        ...b,
        zones: b.zones.map((z) => (z.id === d.id ? { ...z, x: nx, y: ny } : z))
      }));
    } else if (d.kind === 'resize_postit') {
      const nw = Math.max(190, snapVal(d.origW + dx));
      const nh = Math.max(140, snapVal(d.origH + dy));
      updateActiveBoard((b) => ({
        ...b,
        postIts: b.postIts.map((p) => (p.id === d.id ? { ...p, width: nw, height: nh } : p))
      }));
    } else if (d.kind === 'resize_zone') {
      const nw = Math.max(220, snapVal(d.origW + dx));
      const nh = Math.max(180, snapVal(d.origH + dy));
      updateActiveBoard((b) => ({
        ...b,
        zones: b.zones.map((z) => (z.id === d.id ? { ...z, width: nw, height: nh } : z))
      }));
    }
  };

  const handleCanvasPointerUp = () => {
    dragRef.current = null;
    drawingStrokeRef.current = null;
  };

  const handleItemClickForConnect = (targetId: string) => {
    if (activeTool !== 'connect') return false;
    if (!connectSourceId) {
      setConnectSourceId(targetId);
      return true;
    }
    if (connectSourceId === targetId) {
      setConnectSourceId(null);
      return true;
    }
    const newConn: WhiteboardConnection = {
      id: `conn_${Date.now()}`,
      fromId: connectSourceId,
      toId: targetId,
      colorHex: activeColorHex,
      label: '',
      dashed: true
    };
    updateActiveBoard((b) => ({
      ...b,
      connections: [...b.connections, newConn]
    }));
    setConnectSourceId(null);
    setActiveTool('select');
    return true;
  };

  const selectedPostIt = useMemo(
    () =>
      selectedItemKind === 'postit'
        ? activeBoard.postIts.find((p) => p.id === selectedItemId) || null
        : null,
    [activeBoard.postIts, selectedItemId, selectedItemKind]
  );

  const selectedPin = useMemo(
    () =>
      selectedItemKind === 'pin'
        ? activeBoard.pins.find((p) => p.id === selectedItemId) || null
        : null,
    [activeBoard.pins, selectedItemId, selectedItemKind]
  );

  const selectedZone = useMemo(
    () =>
      selectedItemKind === 'zone'
        ? activeBoard.zones.find((z) => z.id === selectedItemId) || null
        : null,
    [activeBoard.zones, selectedItemId, selectedItemKind]
  );

  const applySelectedColor = (hex: string) => {
    setActiveColorHex(hex);
    if (selectedPostIt) {
      updateActiveBoard((b) => ({
        ...b,
        postIts: b.postIts.map((p) =>
          p.id === selectedPostIt.id
            ? { ...p, colorHex: hex, textColorHex: getContrastText(hex) }
            : p
        )
      }));
    } else if (selectedPin) {
      updateActiveBoard((b) => ({
        ...b,
        pins: b.pins.map((p) => (p.id === selectedPin.id ? { ...p, colorHex: hex } : p))
      }));
    } else if (selectedZone) {
      updateActiveBoard((b) => ({
        ...b,
        zones: b.zones.map((z) => (z.id === selectedZone.id ? { ...z, colorHex: hex } : z))
      }));
    }
  };

  const applySelectedPinStyle = (style: WhiteboardPinStyle) => {
    setActivePinStyle(style);
    if (selectedPostIt) {
      updateActiveBoard((b) => ({
        ...b,
        postIts: b.postIts.map((p) =>
          p.id === selectedPostIt.id
            ? {
                ...p,
                pinStyle: style,
                pinColorHex: PIN_STYLE_META[style]?.defaultColor || p.pinColorHex
              }
            : p
        )
      }));
    }
  };

  const handleDuplicateSelected = () => {
    if (selectedPostIt) {
      const copyId = `post_${Date.now()}`;
      const copy: WhiteboardPostIt = {
        ...selectedPostIt,
        id: copyId,
        title: `${selectedPostIt.title} (Cópia)`,
        x: selectedPostIt.x + 28,
        y: selectedPostIt.y + 28,
        zIndex: selectedPostIt.zIndex + 1
      };
      updateActiveBoard((b) => ({ ...b, postIts: [...b.postIts, copy] }));
      setSelectedItemId(copyId);
    } else if (selectedPin) {
      const copyId = `pin_${Date.now()}`;
      const copy: WhiteboardPinMarker = {
        ...selectedPin,
        id: copyId,
        x: selectedPin.x + 28,
        y: selectedPin.y + 28,
        numberBadge: activeBoard.pins.length + 1
      };
      updateActiveBoard((b) => ({ ...b, pins: [...b.pins, copy] }));
      setSelectedItemId(copyId);
    } else if (selectedZone) {
      const copyId = `zone_${Date.now()}`;
      const copy: WhiteboardZone = {
        ...selectedZone,
        id: copyId,
        title: `${selectedZone.title} (Cópia)`,
        x: selectedZone.x + 40,
        y: selectedZone.y + 40
      };
      updateActiveBoard((b) => ({ ...b, zones: [...b.zones, copy] }));
      setSelectedItemId(copyId);
    }
  };

  const handleDeleteSelected = () => {
    if (!selectedItemId) return;
    updateActiveBoard((b) => ({
      ...b,
      postIts: b.postIts.filter((p) => p.id !== selectedItemId),
      pins: b.pins.filter((p) => p.id !== selectedItemId),
      zones: b.zones.filter((z) => z.id !== selectedItemId),
      connections: b.connections.filter(
        (c) => c.fromId !== selectedItemId && c.toId !== selectedItemId
      )
    }));
    setSelectedItemId(null);
    setSelectedItemKind(null);
  };

  const handleClearAllBoard = () => {
    updateActiveBoard((b) => ({
      ...b,
      zones: [],
      postIts: [],
      pins: [],
      connections: [],
      strokes: []
    }));
    setSelectedItemId(null);
    setSelectedItemKind(null);
  };

  const handleLoadTemplate = (kind: 'kanban' | 'turno') => {
    if (kind === 'kanban') {
      const def = createDefaultBoard(currentUser?.nome || 'Colaborador');
      updateActiveBoard((b) => ({
        ...b,
        zones: def.zones,
        postIts: def.postIts,
        pins: def.pins,
        connections: def.connections,
        strokes: []
      }));
    } else {
      updateActiveBoard((b) => ({
        ...b,
        zones: [
          {
            id: `z_abertura_${Date.now()}`,
            title: '1. ABERTURA DE PRAÇA',
            subtitle: 'Checagem inicial e preparação',
            x: 25,
            y: 25,
            width: 350,
            height: 460,
            colorHex: '#10B981',
            borderStyle: 'solid',
            rounded: true
          },
          {
            id: `z_pico_${Date.now()}`,
            title: '2. PICO DE ATENDIMENTO',
            subtitle: 'Foco crítico durante o movimento',
            x: 395,
            y: 25,
            width: 350,
            height: 460,
            colorHex: '#F43F5E',
            borderStyle: 'dashed',
            rounded: true
          },
          {
            id: `z_fechamento_${Date.now()}`,
            title: '3. FECHAMENTO & PASSAGEM',
            subtitle: 'Organização final e recados para amanhã',
            x: 765,
            y: 25,
            width: 350,
            height: 460,
            colorHex: '#8B5CF6',
            borderStyle: 'solid',
            rounded: true
          }
        ],
        postIts: [
          {
            id: `p_t1_${Date.now()}`,
            title: 'Checklist de Entrada',
            content: 'Verificar insumos críticos e alinhar com a equipe da praça.',
            x: 50,
            y: 90,
            width: 295,
            height: 210,
            colorHex: '#10B981',
            textColorHex: '#052E16',
            pinStyle: 'emerald',
            pinColorHex: '#10B981',
            tag: 'ROTINA',
            dueTime: '17:30',
            checklist: [
              { id: 'c1', text: 'Equipamentos ligados e testados', done: true },
              { id: 'c2', text: 'Estoque da praça abastecido', done: false }
            ],
            zIndex: 12
          },
          {
            id: `p_t2_${Date.now()}`,
            title: 'Atenção no Atendimento',
            content: 'Priorizar mesas grandes e reservas VIP confirmadas.',
            x: 425,
            y: 95,
            width: 290,
            height: 185,
            colorHex: '#F43F5E',
            textColorHex: '#FFF1F2',
            pinStyle: 'alert',
            pinColorHex: '#FACC15',
            tag: 'URGENTE',
            dueTime: '20:30',
            checklist: [],
            zIndex: 13
          },
          {
            id: `p_t3_${Date.now()}`,
            title: 'Recado para o Próximo Turno',
            content: 'Anotar tudo que precisa de reposição antes de encerrar.',
            x: 790,
            y: 95,
            width: 295,
            height: 190,
            colorHex: '#8B5CF6',
            textColorHex: '#F5F3FF',
            pinStyle: 'purple',
            pinColorHex: '#A855F7',
            tag: 'HOJE',
            dueTime: '23:45',
            checklist: [],
            zIndex: 14
          }
        ],
        pins: [
          {
            id: `pin_turno_1_${Date.now()}`,
            label: 'Prioridade Máxima',
            numberBadge: 1,
            iconType: 'fire',
            x: 540,
            y: 315,
            colorHex: '#FACC15',
            zIndex: 35
          }
        ],
        connections: [],
        strokes: []
      }));
    }
  };

  const handleCreateNewBoard = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newBoardNameInput.trim() || `Quadro #${state.boards.length + 1}`;
    const newB: PersonalBoardSheet = {
      ...createDefaultBoard(currentUser?.nome || 'Colaborador'),
      id: `board_${Date.now()}`,
      name: title
    };
    setState((prev) => {
      const nextState: PersonalWhiteboardState = {
        activeBoardId: newB.id,
        boards: [...prev.boards, newB]
      };
      persistWhiteboard(nextState);
      return nextState;
    });
    setNewBoardNameInput('');
    setShowNewBoardModal(false);
  };

  const handleDeleteCurrentBoard = () => {
    if (state.boards.length <= 1) {
      handleClearAllBoard();
      return;
    }
    setState((prev) => {
      const remaining = prev.boards.filter((b) => b.id !== prev.activeBoardId);
      const nextState: PersonalWhiteboardState = {
        activeBoardId: remaining[0].id,
        boards: remaining
      };
      persistWhiteboard(nextState);
      return nextState;
    });
  };

  const getElementCenter = useCallback(
    (id: string): { x: number; y: number } | null => {
      const post = activeBoard.postIts.find((p) => p.id === id);
      if (post) {
        return { x: post.x + post.width / 2, y: post.y + post.height / 2 };
      }
      const pin = activeBoard.pins.find((p) => p.id === id);
      if (pin) {
        return { x: pin.x + 22, y: pin.y + 22 };
      }
      const zone = activeBoard.zones.find((z) => z.id === id);
      if (zone) {
        return { x: zone.x + zone.width / 2, y: zone.y + 24 };
      }
      return null;
    },
    [activeBoard.postIts, activeBoard.pins, activeBoard.zones]
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  return (
    <div
      className={`bg-[#0D1B22] border border-[#10B981]/35 rounded-xl overflow-hidden shadow-2xl flex flex-col ${
        isFullscreen ? 'fixed inset-2 z-[150] h-[calc(100vh-16px)]' : 'w-full'
      }`}
    >
      <div className="grafismo-amazonico-frieze opacity-85" />

      <div className="p-3 sm:p-4 bg-[#112229] border-b border-white/10 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                borderColor: accentHex,
                color: accentHex
              }}
            >
              <StickyNote className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
                  Meu Quadro Branco Pessoal • Auto-Administração
                </h3>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold uppercase">
                  {currentUser?.nome || 'Colaborador'}
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 text-[10px] font-mono">
                  {saveStatus === 'salvando' ? 'Salvando...' : 'Salvo no seu perfil'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                Espaço livre estilo Mapa de Mesas: arraste Post-its, fixe Pinos coloridos, crie Colunas/Áreas, conecte ideias e organize sua rotina.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {isSuperOrGestor && usuarios.length > 1 && (
              <div className="flex items-center gap-1.5 bg-[#081115] border border-white/15 rounded-lg px-2 py-1">
                <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <select
                  value={viewedUserKey}
                  onChange={(e) => setViewedUserKey(e.target.value)}
                  className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                  title="Alternar visualização de quadro por colaborador"
                >
                  {usuarios.map((u: any) => {
                    const k = `${u.id || 1}_${String(u.nome || 'user')
                      .trim()
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, '_')}`;
                    return (
                      <option key={k} value={k} className="bg-[#081115] text-white">
                        Quadro: {u.nome} ({u.cargo || u.tipo || 'Equipe'})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1 bg-[#081115] border border-white/10 rounded-lg p-1">
              {state.boards.map((b) => {
                const active = b.id === activeBoard.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() =>
                      setState((prev) => ({ ...prev, activeBoardId: b.id }))
                    }
                    className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-all ${
                      active
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {b.name}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowNewBoardModal((prev) => !prev)}
                className="px-2 py-1 rounded text-xs font-bold text-emerald-400 hover:bg-emerald-500/15 cursor-pointer inline-flex items-center gap-1"
                title="Criar novo quadro pessoal"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Quadro</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-2 rounded-lg bg-[#081115] hover:bg-white/10 border border-white/15 text-slate-200 cursor-pointer"
              title={isFullscreen ? 'Sair da Tela Cheia' : 'Expandir Quadro em Tela Cheia'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showNewBoardModal && (
          <form
            onSubmit={handleCreateNewBoard}
            className="p-2.5 rounded-lg bg-[#081115] border border-emerald-500/40 flex flex-wrap items-center gap-2"
          >
            <input
              type="text"
              value={newBoardNameInput}
              onChange={(e) => setNewBoardNameInput(e.target.value)}
              placeholder="Nome do novo quadro (ex: Metas do Mês, Compras da Praça...)"
              className="flex-1 min-w-[200px] px-3 py-1.5 rounded bg-[#112229] border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded bg-emerald-500 text-slate-950 text-xs font-black cursor-pointer"
            >
              Criar Quadro
            </button>
            <button
              type="button"
              onClick={() => setShowNewBoardModal(false)}
              className="px-2.5 py-1.5 rounded bg-white/5 text-slate-300 text-xs cursor-pointer"
            >
              Cancelar
            </button>
          </form>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTool('select')}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                activeTool === 'select'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                  : 'bg-[#081115] text-slate-200 border-white/15 hover:bg-white/5'
              }`}
            >
              <Move className="w-3.5 h-3.5" />
              <span>Mover / Selecionar</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddPostIt()}
              className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-300 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-transform active:scale-95"
            >
              <StickyNote className="w-3.5 h-3.5" />
              <span>+ Post-it</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddPinMarker()}
              className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white border border-rose-400 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-transform active:scale-95"
            >
              <Pin className="w-3.5 h-3.5" />
              <span>+ Pino / Marcador</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddZone()}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>+ Área / Coluna</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setConnectSourceId(null);
                setActiveTool((prev) => (prev === 'connect' ? 'select' : 'connect'));
              }}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                activeTool === 'connect'
                  ? 'bg-purple-500 text-white border-purple-300 font-black'
                  : 'bg-[#081115] text-slate-200 border-white/15 hover:bg-white/5'
              }`}
              title="Clique em um Post-it ou Pino e depois em outro para ligar com uma linha"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>
                {activeTool === 'connect'
                  ? connectSourceId
                    ? 'Clique no destino...'
                    : 'Clique na origem...'
                  : 'Conectar Itens'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTool((prev) => (prev === 'draw' ? 'select' : 'draw'))
              }
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                activeTool === 'draw'
                  ? 'bg-pink-500 text-white border-pink-300 font-black'
                  : 'bg-[#081115] text-slate-200 border-white/15 hover:bg-white/5'
              }`}
              title="Desenhar livremente no quadro"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Caneta Livre</span>
            </button>

            {activeBoard.strokes.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  updateActiveBoard((b) => ({ ...b, strokes: [] }))
                }
                className="px-2 py-1.5 rounded-lg bg-[#081115] hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                title="Apagar traços de caneta livre"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Limpar Traços</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 bg-[#081115] border border-white/10 rounded-lg px-2 py-1">
              <Palette className="w-3.5 h-3.5 text-slate-300 mr-0.5" />
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => applySelectedColor(c.hex)}
                  title={`Cor: ${c.name}`}
                  className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                    activeColorHex.toLowerCase() === c.hex.toLowerCase()
                      ? 'scale-125 border-white ring-2 ring-white/40'
                      : 'border-black/40 hover:scale-110'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              <label
                className="ml-1 w-6 h-5 rounded border border-white/25 overflow-hidden cursor-pointer flex items-center justify-center"
                title="Escolher qualquer cor personalizada RGB"
              >
                <input
                  type="color"
                  value={activeColorHex}
                  onChange={(e) => applySelectedColor(e.target.value)}
                  className="w-8 h-8 cursor-pointer border-0 p-0 bg-transparent"
                />
              </label>
            </div>

            <div className="flex items-center gap-1 bg-[#081115] border border-white/10 rounded-lg px-2 py-1">
              <Pin className="w-3.5 h-3.5 text-rose-400" />
              {(Object.keys(PIN_STYLE_META) as WhiteboardPinStyle[]).map((pKey) => {
                const meta = PIN_STYLE_META[pKey];
                const isSel = activePinStyle === pKey;
                return (
                  <button
                    key={pKey}
                    type="button"
                    onClick={() => applySelectedPinStyle(pKey)}
                    title={meta.label}
                    className={`px-1.5 py-0.5 rounded text-xs cursor-pointer transition-all ${
                      isSel
                        ? 'bg-white/20 text-white font-bold ring-1 ring-white/50'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {meta.symbol}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar post-its ou pinos..."
                className="pl-8 pr-2.5 py-1 rounded-lg bg-[#081115] border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 w-48"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                updateActiveBoard((b) => ({
                  ...b,
                  bgMode:
                    b.bgMode === 'dots'
                      ? 'grid'
                      : b.bgMode === 'grid'
                      ? 'clean'
                      : 'dots'
                }))
              }
              className="px-2.5 py-1 rounded-lg bg-[#081115] hover:bg-white/5 border border-white/10 text-slate-200 inline-flex items-center gap-1 cursor-pointer"
            >
              <Grid className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Fundo:{' '}
                {activeBoard.bgMode === 'dots'
                  ? 'Pontilhado'
                  : activeBoard.bgMode === 'grid'
                  ? 'Quadriculado'
                  : 'Lousa Lisa'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                updateActiveBoard((b) => ({ ...b, snapToGrid: !b.snapToGrid }))
              }
              className={`px-2.5 py-1 rounded-lg border inline-flex items-center gap-1 cursor-pointer ${
                activeBoard.snapToGrid
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                  : 'bg-[#081115] border-white/10 text-slate-300'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Ímã de Grade: {activeBoard.snapToGrid ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleLoadTemplate('kanban')}
              className="px-2.5 py-1 rounded-lg bg-[#081115] hover:bg-white/5 border border-white/10 text-amber-300 inline-flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Modelo Kanban</span>
            </button>

            <button
              type="button"
              onClick={() => handleLoadTemplate('turno')}
              className="px-2.5 py-1 rounded-lg bg-[#081115] hover:bg-white/5 border border-white/10 text-cyan-300 inline-flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Modelo Meu Turno</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center bg-[#081115] border border-white/10 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.55, Number((z - 0.1).toFixed(2))))}
                className="px-2 py-1 text-slate-300 hover:bg-white/5 cursor-pointer"
                title="Reduzir Zoom"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="px-2 py-1 font-mono text-[11px] font-bold text-white hover:bg-white/5 cursor-pointer"
                title="Resetar Zoom 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(2))))}
                className="px-2 py-1 text-slate-300 hover:bg-white/5 cursor-pointer"
                title="Aumentar Zoom"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleClearAllBoard}
              className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-bold inline-flex items-center gap-1 cursor-pointer"
              title="Zerar todos os post-its, pinos e áreas deste quadro"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Zerar Quadro</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-[540px]">
        <div className="flex-1 overflow-auto relative bg-[#071014] select-none">
          <div
            ref={canvasRef}
            data-canvas-bg="true"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            className="relative min-w-[1150px] min-h-[560px]"
            style={{
              width: '1200px',
              height: isFullscreen ? '820px' : '560px',
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              backgroundImage:
                activeBoard.bgMode === 'dots'
                  ? 'radial-gradient(rgba(148, 163, 184, 0.22) 1.5px, transparent 1.5px)'
                  : activeBoard.bgMode === 'grid'
                  ? 'linear-gradient(to right, rgba(148,163,184,0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.09) 1px, transparent 1px)'
                  : 'none',
              backgroundSize:
                activeBoard.bgMode === 'dots' ? '22px 22px' : '28px 28px'
            }}
          >
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-[15]"
              viewBox="0 0 1200 820"
            >
              {activeBoard.connections.map((conn) => {
                const from = getElementCenter(conn.fromId);
                const to = getElementCenter(conn.toId);
                if (!from || !to) return null;
                const midX = (from.x + to.x) / 2;
                const midY = (from.y + to.y) / 2 - 22;
                return (
                  <g key={conn.id}>
                    <path
                      d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`}
                      fill="none"
                      stroke={conn.colorHex || '#F59E0B'}
                      strokeWidth={3}
                      strokeDasharray={conn.dashed ? '7 5' : undefined}
                    />
                    <circle cx={from.x} cy={from.y} r={5} fill={conn.colorHex || '#F59E0B'} />
                    <circle cx={to.x} cy={to.y} r={5} fill={conn.colorHex || '#F59E0B'} />
                    {conn.label && (
                      <text
                        x={midX}
                        y={midY - 4}
                        textAnchor="middle"
                        fill="#F8FAFC"
                        fontSize="11"
                        fontWeight="bold"
                      >
                        {conn.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {activeBoard.strokes.map((st) => {
                if (st.points.length < 2) return null;
                const d = st.points
                  .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
                  .join(' ');
                return (
                  <path
                    key={st.id}
                    d={d}
                    fill="none"
                    stroke={st.colorHex}
                    strokeWidth={st.width || 3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}
            </svg>

            {activeBoard.zones.map((zone) => {
              const isSelected =
                selectedItemKind === 'zone' && selectedItemId === zone.id;
              return (
                <div
                  key={zone.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (handleItemClickForConnect(zone.id)) return;
                    setSelectedItemId(zone.id);
                    setSelectedItemKind('zone');
                    if (zone.locked || activeTool === 'draw') return;
                    dragRef.current = {
                      kind: 'zone',
                      id: zone.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: zone.x,
                      origY: zone.y,
                      origW: zone.width,
                      origH: zone.height
                    };
                  }}
                  style={{
                    left: `${zone.x}px`,
                    top: `${zone.y}px`,
                    width: `${zone.width}px`,
                    height: `${zone.height}px`,
                    borderColor: zone.colorHex,
                    borderStyle: zone.borderStyle,
                    backgroundColor: `${zone.colorHex}12`
                  }}
                  className={`absolute z-[5] border-2 p-3 flex flex-col justify-between transition-shadow ${
                    zone.rounded ? 'rounded-2xl' : 'rounded-none'
                  } ${
                    isSelected
                      ? 'ring-2 ring-white shadow-xl'
                      : 'hover:brightness-110'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div
                        className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded inline-block"
                        style={{
                          backgroundColor: `${zone.colorHex}30`,
                          color: '#FFFFFF',
                          border: `1px solid ${zone.colorHex}`
                        }}
                      >
                        {zone.title}
                      </div>
                      {zone.subtitle && (
                        <div className="text-[11px] text-slate-300 mt-1">
                          {zone.subtitle}
                        </div>
                      )}
                    </div>
                    {zone.locked && (
                      <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </div>

                  {!zone.locked && (
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelectedItemId(zone.id);
                        setSelectedItemKind('zone');
                        dragRef.current = {
                          kind: 'resize_zone',
                          id: zone.id,
                          startX: e.clientX,
                          startY: e.clientY,
                          origX: zone.x,
                          origY: zone.y,
                          origW: zone.width,
                          origH: zone.height
                        };
                      }}
                      className="w-4 h-4 self-end cursor-nwse-resize rounded-sm border-r-2 border-b-2 border-white/60"
                      title="Arraste para redimensionar esta área"
                    />
                  )}
                </div>
              );
            })}

            {activeBoard.postIts
              .filter((p) => {
                if (!normalizedSearch) return true;
                const hay = `${p.title} ${p.content} ${p.tag}`.toLowerCase();
                return hay.includes(normalizedSearch);
              })
              .map((post) => {
                const isSelected =
                  selectedItemKind === 'postit' && selectedItemId === post.id;
                const isConnectSource = connectSourceId === post.id;
                const textHex = post.textColorHex || getContrastText(post.colorHex);
                const pinMeta = PIN_STYLE_META[post.pinStyle || 'red'];
                const doneCount = post.checklist.filter((c) => c.done).length;

                return (
                  <div
                    key={post.id}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (handleItemClickForConnect(post.id)) return;
                      setSelectedItemId(post.id);
                      setSelectedItemKind('postit');
                      if (post.locked || activeTool === 'draw') return;
                      dragRef.current = {
                        kind: 'postit',
                        id: post.id,
                        startX: e.clientX,
                        startY: e.clientY,
                        origX: post.x,
                        origY: post.y,
                        origW: post.width,
                        origH: post.height
                      };
                    }}
                    style={{
                      left: `${post.x}px`,
                      top: `${post.y}px`,
                      width: `${post.width}px`,
                      height: `${post.height}px`,
                      backgroundColor: post.colorHex,
                      color: textHex,
                      zIndex: isSelected ? 90 : post.zIndex || 20
                    }}
                    className={`absolute rounded-xl p-3 shadow-2xl flex flex-col justify-between cursor-grab active:cursor-grabbing transition-shadow ${
                      isSelected
                        ? 'ring-3 ring-white shadow-[0_14px_34px_rgba(0,0,0,0.65)]'
                        : ''
                    } ${isConnectSource ? 'ring-3 ring-purple-400 animate-pulse' : ''}`}
                  >
                    {post.pinStyle !== 'none' && (
                      <div
                        className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full shadow-lg border-2 border-white flex items-center justify-center text-sm select-none"
                        style={{
                          backgroundColor: post.pinColorHex || pinMeta.defaultColor
                        }}
                        title={pinMeta.label}
                      >
                        <span>{pinMeta.symbol}</span>
                      </div>
                    )}

                    <div className="space-y-1.5 overflow-hidden flex-1 flex flex-col">
                      <div className="flex items-center justify-between gap-1.5 pt-1">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase tracking-wider"
                          style={{
                            backgroundColor: 'rgba(0,0,0,0.18)',
                            color: textHex
                          }}
                        >
                          {post.tag || 'NOTA'}
                        </span>
                        <div className="flex items-center gap-1">
                          {post.dueTime && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                              style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
                            >
                              ⏰ {post.dueTime}
                            </span>
                          )}
                          {post.locked && <Lock className="w-3 h-3 opacity-75" />}
                        </div>
                      </div>

                      <input
                        type="text"
                        value={post.title}
                        onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateActiveBoard((b) => ({
                            ...b,
                            postIts: b.postIts.map((item) =>
                              item.id === post.id ? { ...item, title: val } : item
                            )
                          }));
                        }}
                        className="w-full bg-transparent font-black text-sm focus:outline-none border-b border-black/15 pb-0.5"
                        style={{ color: textHex }}
                      />

                      <textarea
                        value={post.content}
                        onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateActiveBoard((b) => ({
                            ...b,
                            postIts: b.postIts.map((item) =>
                              item.id === post.id ? { ...item, content: val } : item
                            )
                          }));
                        }}
                        className="w-full flex-1 bg-transparent text-xs leading-snug resize-none focus:outline-none"
                        style={{ color: textHex }}
                      />

                      {post.checklist.length > 0 && (
                        <div
                          className="space-y-1 pt-1 border-t border-black/15 max-h-24 overflow-y-auto"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          {post.checklist.map((chk) => (
                            <label
                              key={chk.id}
                              className="flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={chk.done}
                                onChange={() => {
                                  updateActiveBoard((b) => ({
                                    ...b,
                                    postIts: b.postIts.map((item) =>
                                      item.id === post.id
                                        ? {
                                            ...item,
                                            checklist: item.checklist.map((c) =>
                                              c.id === chk.id ? { ...c, done: !c.done } : c
                                            )
                                          }
                                        : item
                                    )
                                  }));
                                }}
                                className="rounded cursor-pointer"
                              />
                              <span className={chk.done ? 'line-through opacity-65' : ''}>
                                {chk.text}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[10px] font-mono opacity-80">
                      <span>
                        {post.checklist.length > 0
                          ? `Checklist: ${doneCount}/${post.checklist.length}`
                          : 'Arraste para mover'}
                      </span>
                      {!post.locked && (
                        <div
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setSelectedItemId(post.id);
                            setSelectedItemKind('postit');
                            dragRef.current = {
                              kind: 'resize_postit',
                              id: post.id,
                              startX: e.clientX,
                              startY: e.clientY,
                              origX: post.x,
                              origY: post.y,
                              origW: post.width,
                              origH: post.height
                            };
                          }}
                          className="w-3.5 h-3.5 cursor-nwse-resize border-r-2 border-b-2 border-current"
                          title="Arraste para redimensionar o Post-it"
                        />
                      )}
                    </div>
                  </div>
                );
              })}

            {activeBoard.pins
              .filter((p) => {
                if (!normalizedSearch) return true;
                return `${p.label} ${p.notes || ''}`
                  .toLowerCase()
                  .includes(normalizedSearch);
              })
              .map((pin) => {
                const isSelected =
                  selectedItemKind === 'pin' && selectedItemId === pin.id;
                const isConnectSource = connectSourceId === pin.id;
                const iconEmoji =
                  pin.iconType === 'star'
                    ? '⭐'
                    : pin.iconType === 'fire'
                    ? '🔥'
                    : pin.iconType === 'alert'
                    ? '⚠️'
                    : pin.iconType === 'check'
                    ? '✅'
                    : pin.iconType === 'flag'
                    ? '🚩'
                    : '📌';

                return (
                  <div
                    key={pin.id}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (handleItemClickForConnect(pin.id)) return;
                      setSelectedItemId(pin.id);
                      setSelectedItemKind('pin');
                      if (pin.locked || activeTool === 'draw') return;
                      dragRef.current = {
                        kind: 'pin',
                        id: pin.id,
                        startX: e.clientX,
                        startY: e.clientY,
                        origX: pin.x,
                        origY: pin.y,
                        origW: 44,
                        origH: 44
                      };
                    }}
                    style={{
                      left: `${pin.x}px`,
                      top: `${pin.y}px`,
                      zIndex: isSelected ? 95 : pin.zIndex || 40
                    }}
                    className={`absolute flex items-center gap-2 px-2.5 py-1.5 rounded-full shadow-xl border-2 border-white cursor-grab active:cursor-grabbing transition-transform ${
                      isSelected ? 'scale-110 ring-3 ring-amber-300' : 'hover:scale-105'
                    } ${isConnectSource ? 'ring-3 ring-purple-400 animate-pulse' : ''}`}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-inner shrink-0"
                      style={{
                        backgroundColor: pin.colorHex,
                        color: getContrastText(pin.colorHex)
                      }}
                    >
                      {pin.numberBadge ? `#${pin.numberBadge}` : iconEmoji}
                    </div>
                    <span className="text-xs font-black text-white bg-[#081115]/90 px-2 py-0.5 rounded-full border border-white/15 whitespace-nowrap">
                      {iconEmoji} {pin.label}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="w-full lg:w-80 bg-[#112229] border-t lg:border-t-0 lg:border-l border-white/10 p-3.5 flex flex-col justify-between gap-4">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-400">
                <Edit3 className="w-3.5 h-3.5" />
                <span>Propriedades do Item</span>
              </div>
              {selectedItemId && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleDuplicateSelected}
                    className="p-1.5 rounded bg-[#081115] hover:bg-white/10 text-slate-200 border border-white/10 cursor-pointer"
                    title="Duplicar item selecionado"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="p-1.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 cursor-pointer"
                    title="Excluir item selecionado"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {selectedPostIt && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Título do Post-it
                  </label>
                  <input
                    type="text"
                    value={selectedPostIt.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateActiveBoard((b) => ({
                        ...b,
                        postIts: b.postIts.map((p) =>
                          p.id === selectedPostIt.id ? { ...p, title: val } : p
                        )
                      }));
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#081115] border border-white/15 text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Etiqueta / Status
                    </label>
                    <select
                      value={selectedPostIt.tag}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateActiveBoard((b) => ({
                          ...b,
                          postIts: b.postIts.map((p) =>
                            p.id === selectedPostIt.id ? { ...p, tag: val } : p
                          )
                        }));
                      }}
                      className="w-full px-2 py-1.5 rounded-lg bg-[#081115] border border-white/15 text-white focus:outline-none"
                    >
                      {TAG_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Horário / Prazo
                    </label>
                    <input
                      type="text"
                      value={selectedPostIt.dueTime || ''}
                      placeholder="Ex: 19:30"
                      onChange={(e) => {
                        const val = e.target.value;
                        updateActiveBoard((b) => ({
                          ...b,
                          postIts: b.postIts.map((p) =>
                            p.id === selectedPostIt.id ? { ...p, dueTime: val } : p
                          )
                        }));
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#081115] border border-white/15 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Pino Fixado no Topo
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {(Object.keys(PIN_STYLE_META) as WhiteboardPinStyle[]).map((pk) => {
                      const meta = PIN_STYLE_META[pk];
                      const active = selectedPostIt.pinStyle === pk;
                      return (
                        <button
                          key={pk}
                          type="button"
                          onClick={() => applySelectedPinStyle(pk)}
                          className={`px-2 py-1 rounded border text-[11px] font-bold cursor-pointer ${
                            active
                              ? 'bg-emerald-500/25 border-emerald-400 text-white'
                              : 'bg-[#081115] border-white/10 text-slate-300'
                          }`}
                        >
                          {meta.symbol}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Adicionar Tarefa / Checklist no Post-it
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newChecklistText}
                      onChange={(e) => setNewChecklistText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newChecklistText.trim()) {
                          e.preventDefault();
                          const txt = newChecklistText.trim();
                          updateActiveBoard((b) => ({
                            ...b,
                            postIts: b.postIts.map((p) =>
                              p.id === selectedPostIt.id
                                ? {
                                    ...p,
                                    checklist: [
                                      ...p.checklist,
                                      { id: `chk_${Date.now()}`, text: txt, done: false }
                                    ]
                                  }
                                : p
                            )
                          }));
                          setNewChecklistText('');
                        }
                      }}
                      placeholder="Nova subtarefa..."
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#081115] border border-white/15 text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newChecklistText.trim()) return;
                        const txt = newChecklistText.trim();
                        updateActiveBoard((b) => ({
                          ...b,
                          postIts: b.postIts.map((p) =>
                            p.id === selectedPostIt.id
                              ? {
                                  ...p,
                                  checklist: [
                                    ...p.checklist,
                                    { id: `chk_${Date.now()}`, text: txt, done: false }
                                  ]
                                }
                              : p
                          )
                        }));
                        setNewChecklistText('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateActiveBoard((b) => ({
                      ...b,
                      postIts: b.postIts.map((p) =>
                        p.id === selectedPostIt.id ? { ...p, locked: !p.locked } : p
                      )
                    }))
                  }
                  className="w-full py-1.5 px-3 rounded-lg bg-[#081115] hover:bg-white/5 border border-white/15 text-slate-200 font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {selectedPostIt.locked ? (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Destravar Posição</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Travar Posição no Quadro</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {selectedPin && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Texto do Pino / Marcador
                  </label>
                  <input
                    type="text"
                    value={selectedPin.label}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateActiveBoard((b) => ({
                        ...b,
                        pins: b.pins.map((p) =>
                          p.id === selectedPin.id ? { ...p, label: val } : p
                        )
                      }));
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#081115] border border-white/15 text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Número do Pino
                    </label>
                    <input
                      type="number"
                      value={selectedPin.numberBadge || 1}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 1;
                        updateActiveBoard((b) => ({
                          ...b,
                          pins: b.pins.map((p) =>
                            p.id === selectedPin.id ? { ...p, numberBadge: val } : p
                          )
                        }));
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#081115] border border-white/15 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Ícone
                    </label>
                    <select
                      value={selectedPin.iconType}
                      onChange={(e) => {
                        const val = e.target.value as WhiteboardPinMarker['iconType'];
                        updateActiveBoard((b) => ({
                          ...b,
                          pins: b.pins.map((p) =>
                            p.id === selectedPin.id ? { ...p, iconType: val } : p
                          )
                        }));
                      }}
                      className="w-full px-2 py-1.5 rounded-lg bg-[#081115] border border-white/15 text-white focus:outline-none"
                    >
                      <option value="pin">📌 Alfinete</option>
                      <option value="fire">🔥 Urgente</option>
                      <option value="star">⭐ Meta</option>
                      <option value="alert">⚠️ Alerta</option>
                      <option value="check">✅ Concluído</option>
                      <option value="flag">🚩 Bandeira</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {selectedZone && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Nome da Área / Coluna
                  </label>
                  <input
                    type="text"
                    value={selectedZone.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateActiveBoard((b) => ({
                        ...b,
                        zones: b.zones.map((z) =>
                          z.id === selectedZone.id ? { ...z, title: val } : z
                        )
                      }));
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#081115] border border-white/15 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Subtítulo / Descrição da Área
                  </label>
                  <input
                    type="text"
                    value={selectedZone.subtitle || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateActiveBoard((b) => ({
                        ...b,
                        zones: b.zones.map((z) =>
                          z.id === selectedZone.id ? { ...z, subtitle: val } : z
                        )
                      }));
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#081115] border border-white/15 text-white focus:outline-none"
                  />
                </div>
              </div>
            )}

            {!selectedPostIt && !selectedPin && !selectedZone && (
              <div className="p-3 rounded-xl bg-[#081115] border border-white/10 text-xs text-slate-300 space-y-2">
                <p className="font-bold text-white">Como usar seu Quadro Branco:</p>
                <ul className="space-y-1 text-[11px] text-slate-300 list-disc pl-4">
                  <li>
                    Clique em <strong>+ Post-it</strong> para criar notas adesivas com texto, prazo e checklist.
                  </li>
                  <li>
                    Clique em <strong>+ Pino / Marcador</strong> para fixar pinos numerados ou alertas de prioridade.
                  </li>
                  <li>
                    Use a <strong>Paleta de Cores</strong> no topo para pintar qualquer Post-it, Pino ou Coluna.
                  </li>
                  <li>
                    Use <strong>Conectar Itens</strong> para ligar dois cartões com uma linha de fluxo.
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/10 space-y-2">
            <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[11px]">
              <div className="p-2 rounded-lg bg-[#081115] border border-white/5">
                <div className="font-black text-amber-400">{activeBoard.postIts.length}</div>
                <div className="text-[10px] text-slate-400">Post-its</div>
              </div>
              <div className="p-2 rounded-lg bg-[#081115] border border-white/5">
                <div className="font-black text-rose-400">{activeBoard.pins.length}</div>
                <div className="text-[10px] text-slate-400">Pinos</div>
              </div>
              <div className="p-2 rounded-lg bg-[#081115] border border-white/5">
                <div className="font-black text-cyan-400">{activeBoard.zones.length}</div>
                <div className="text-[10px] text-slate-400">Áreas</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => persistWhiteboard(state)}
                className="flex-1 py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Meu Quadro</span>
              </button>
              {state.boards.length > 1 && (
                <button
                  type="button"
                  onClick={handleDeleteCurrentBoard}
                  className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 cursor-pointer"
                  title="Excluir este quadro"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
