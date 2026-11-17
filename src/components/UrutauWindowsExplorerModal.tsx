import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  Layers,
  Maximize2,
  Monitor,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Terminal,
  Trash2,
  X
} from 'lucide-react';
import { URUTAU_BOTANICA_POSTURAS } from './UrutauShared';

export interface WindowsProgramItem {
  id: string;
  nome: string;
  caminhoExe: string;
  categoria: 'Sistema' | 'Operacional' | 'Escritório' | 'Personalizado';
  descricao: string;
  protocoloUri?: string;
}

export interface LaunchedPcProgram {
  id: string;
  nome: string;
  caminhoExe: string;
  protocoloUri?: string;
  launchedAt: string;
}

export interface ExplorerFileEntry {
  name: string;
  fullPath: string;
  isDir: boolean;
  ext: string;
  size: number;
  fileObj?: File;
}

export async function downloadUrutauWindowsInstaller(companyName = 'URUTAU') {
  const safeName =
    companyName
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 28) || 'URUTAU';

  try {
    const res = await fetch(
      `/api/desktop/urutau.exe?empresa=${encodeURIComponent(safeName)}`,
      { method: 'GET' }
    );
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Urutau.exe';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 600);
      return;
    }
  } catch {}

  const a = document.createElement('a');
  a.href = `/api/desktop/urutau.exe?empresa=${encodeURIComponent(safeName)}`;
  a.download = 'Urutau.exe';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body.contains(a)) document.body.removeChild(a);
  }, 500);
}

export async function downloadCompanyAutonomyBackup(companyName = 'URUTAU') {
  const safeName =
    companyName
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 28) || 'URUTAU';
  try {
    const res = await fetch('/api/erp/tudo');
    const data = await res.json();
    const payload = {
      exportado_em: new Date().toISOString(),
      empresa: companyName,
      garantia_autonomia:
        'Exportação integral de dados da empresa (Caixa, Estoque, Cadastros, RH, Unidades, Escalas e Histórico).',
      dados: data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_Dados_${safeName}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);
  } catch {}
}

interface UrutauPcProgramTakeoverScreenProps {
  activeProgram: LaunchedPcProgram;
  launchedPrograms: LaunchedPcProgram[];
  onResumeUrutau: () => void;
  onOpenExeExplorer: () => void;
  onSelectProgram: (prog: LaunchedPcProgram) => void;
  onCloseProgram: (progId: string) => void;
}

export function UrutauPcProgramTakeoverScreen({
  activeProgram,
  launchedPrograms,
  onResumeUrutau,
  onOpenExeExplorer,
  onSelectProgram,
  onCloseProgram
}: UrutauPcProgramTakeoverScreenProps) {
  const [menuLeftExpanded, setMenuLeftExpanded] = useState<boolean>(false);
  const [filaConsumer, setFilaConsumer] = useState<any[]>([]);
  const [indiceFila, setIndiceFila] = useState<number>(0);
  const [checkCautela, setCheckCautela] = useState<boolean>(false);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [processandoItem, setProcessandoItem] = useState<boolean>(false);

  const carregarFilaConsumer = useCallback(async () => {
    try {
      const res = await fetch('/api/integracoes/consumer/status/1');
      const json = await res.json();
      if (json.ok && Array.isArray(json.fila_cautelosa)) {
        setFilaConsumer(json.fila_cautelosa);
      }
    } catch {}
  }, []);

  useEffect(() => {
    carregarFilaConsumer();
    const timer = setInterval(carregarFilaConsumer, 5000);
    return () => clearInterval(timer);
  }, [carregarFilaConsumer]);

  useEffect(() => {
    setCheckCautela(false);
    if (indiceFila >= filaConsumer.length) {
      setIndiceFila(0);
    }
  }, [indiceFila, filaConsumer.length]);

  const itemAtual = filaConsumer[indiceFila] || filaConsumer[0] || null;

  const handleCopiarItem = (item: any) => {
    if (!item) return;
    const texto = `${item.resumo} | R$ ${Number(item.valor_referencia || 0)
      .toFixed(2)
      .replace('.', ',')}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).catch(() => {});
    }
    setCopiadoId(item.id);
    setTimeout(() => setCopiadoId(null), 2500);
  };

  const handleProcessarItemFila = async (acao: 'APROVAR_E_LANCAR' | 'REJEITAR_DESCARTAR') => {
    if (!itemAtual?.id) return;
    if (acao === 'APROVAR_E_LANCAR' && !checkCautela) return;
    setProcessandoItem(true);
    try {
      await fetch('/api/integracoes/consumer/conferir-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: 1,
          protocolo_id: itemAtual.id,
          acao,
          operador: 'Menu Lateral Urutau.exe'
        })
      });
      setCheckCautela(false);
      await carregarFilaConsumer();
    } catch {
    } finally {
      setProcessandoItem(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9990] bg-[#06090B] text-slate-100 flex select-none overflow-hidden">
      <aside
        className={`h-full bg-[#041114] border-r border-[#10B981]/40 flex flex-col shrink-0 transition-all duration-200 ${
          menuLeftExpanded ? 'w-80 sm:w-96' : 'w-12'
        }`}
      >
        {!menuLeftExpanded ? (
          <button
            type="button"
            onClick={() => setMenuLeftExpanded(true)}
            className="w-full h-full flex flex-col items-center justify-between py-4 px-1 hover:bg-[#10B981]/10 transition-colors cursor-pointer"
            title="Clique para ampliar o menu lateral do Urutau.exe"
          >
            <div className="flex flex-col items-center gap-3">
              <img
                src={URUTAU_BOTANICA_POSTURAS.sentinela}
                alt="Urutau"
                className="w-8 h-8 rounded-xl object-cover border border-[#10B981]/60"
              />
              <div className="w-7 h-7 rounded-lg bg-[#10B981]/20 border border-[#10B981]/50 flex items-center justify-center text-[#10B981]">
                <ChevronRight className="w-4 h-4" />
              </div>
              {filaConsumer.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-mono text-[10px] font-black">
                  {filaConsumer.length}
                </span>
              )}
            </div>

            <div className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-mono font-bold uppercase tracking-widest text-[#6EE7B7]">
              URUTAU.EXE • CLIQUE PARA AMPLIAR MENU
            </div>

            <div className="w-2 h-2 rounded-full bg-[#10B981]" />
          </button>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-3.5 bg-[#071A1E] border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={URUTAU_BOTANICA_POSTURAS.sentinela}
                  alt="Urutau"
                  className="w-8 h-8 rounded-xl object-cover border border-[#10B981]/60 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-black text-white uppercase tracking-wider truncate">
                    Menu Lateral Urutau.exe
                  </div>
                  <div className="text-[10px] text-[#6EE7B7] truncate">
                    Recolhe na esquerda e amplia ao clicar
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuLeftExpanded(false)}
                className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                title="Recolher menu na esquerda"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Recolher</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onResumeUrutau}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#04120C] font-black text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Voltar ao Painel Principal Urutau</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenExeExplorer}
                  className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Abrir Explorer de Programas (.exe)</span>
                </button>
              </div>

              {launchedPrograms.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Programas em Execução ({launchedPrograms.length})
                  </div>
                  <div className="space-y-1">
                    {launchedPrograms.map((prog) => {
                      const isCurrent = prog.id === activeProgram.id;
                      return (
                        <div
                          key={prog.id}
                          className={`px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-xs ${
                            isCurrent
                              ? 'bg-[#10B981]/20 border border-[#10B981]/50 text-white font-bold'
                              : 'bg-black/40 text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectProgram(prog)}
                            className="flex-1 text-left truncate cursor-pointer"
                          >
                            {prog.nome}
                          </button>
                          <button
                            type="button"
                            onClick={() => onCloseProgram(prog.id)}
                            className="text-rose-400 hover:text-rose-300 p-0.5 cursor-pointer"
                            title="Encerrar este programa"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-white/10 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono font-bold text-emerald-300 uppercase">
                    Fila Cautelosa PDV Consumer (1 a 1)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-bold">
                    {filaConsumer.length} pendente(s)
                  </span>
                </div>

                {!itemAtual ? (
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs text-slate-400 text-center">
                    Nenhum lançamento pendente na fila cautelosa do Consumer no momento.
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[#07191E] border border-cyan-500/40 space-y-2.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-cyan-300 border-b border-white/10 pb-1.5">
                      <span>
                        ITEM {indiceFila + 1} DE {filaConsumer.length} • {itemAtual.modulo}
                      </span>
                      <span>{itemAtual.id}</span>
                    </div>

                    <div className="text-xs font-bold text-white leading-snug">
                      {itemAtual.resumo}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Valor para Conferência:</span>
                      <span className="font-mono font-black text-emerald-400">
                        R$ {Number(itemAtual.valor_referencia || 0).toFixed(2).replace('.', ',')}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopiarItem(itemAtual)}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>
                        {copiadoId === itemAtual.id
                          ? 'Dados Copiados para Colar!'
                          : '1. Copiar Valor/Descrição'}
                      </span>
                    </button>

                    <label className="flex items-start gap-2 p-2 rounded-lg bg-black/40 border border-emerald-500/30 text-[11px] text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checkCautela}
                        onChange={(e) => setCheckCautela(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>Confirmo que conferi este lançamento individualmente.</span>
                    </label>

                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        disabled={processandoItem || !checkCautela}
                        onClick={() => handleProcessarItemFila('APROVAR_E_LANCAR')}
                        className="col-span-2 py-2 px-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-[#04120C] text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>2. Confirmar (1 a 1)</span>
                      </button>
                      <button
                        type="button"
                        disabled={processandoItem}
                        onClick={() => handleProcessarItemFila('REJEITAR_DESCARTAR')}
                        className="py-2 px-2 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-[11px] font-semibold cursor-pointer"
                      >
                        Rejeitar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="h-10 bg-[#0D1318] border-b border-white/10 px-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Monitor className="w-4 h-4 text-[#10B981] shrink-0" />
            <span className="text-xs font-bold text-white truncate">{activeProgram.nome}</span>
            <span className="text-[11px] font-mono text-slate-400 truncate hidden sm:inline">
              — {activeProgram.caminhoExe}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onCloseProgram(activeProgram.id)}
              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Encerrar Sessão Externa</span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#06090B] text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
            <Monitor className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md">
            <div className="text-base font-bold text-slate-100">
              {activeProgram.nome} em execução no Windows
            </div>
            <div className="text-xs font-mono text-slate-400 break-all">
              {activeProgram.caminhoExe}
            </div>
            <p className="text-xs text-slate-400 pt-2 leading-relaxed">
              O menu do Urutau.exe permanece recolhido na lateral esquerda. Clique na barra lateral esquerda a qualquer momento para ampliar o menu, conferir a fila cautelosa ou alternar entre programas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface UrutauWindowsExplorerModalProps {
  open: boolean;
  onClose: () => void;
  companyName?: string;
  onLaunchPcProgram?: (prog: LaunchedPcProgram) => void;
}

export function UrutauWindowsExplorerModal({
  open,
  onClose,
  companyName = 'URUTAU',
  onLaunchPcProgram
}: UrutauWindowsExplorerModalProps) {
  const [activeView, setActiveView] = useState<'explorer' | 'programas'>('explorer');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bridgeConnected, setBridgeConnected] = useState<boolean>(false);
  const [bridgeUser, setBridgeUser] = useState<string>('');
  const [filesList, setFilesList] = useState<ExplorerFileEntry[]>([]);
  const [localPickedFolderName, setLocalPickedFolderName] = useState<string>('');
  const [localPickedFiles, setLocalPickedFiles] = useState<ExplorerFileEntry[]>([]);
  const [statusFeedback, setStatusFeedback] = useState<string>('');
  const [programs, setPrograms] = useState<WindowsProgramItem[]>(() => {
    try {
      const saved = localStorage.getItem('urutau_windows_programs_real_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [showAddProgramForm, setShowAddProgramForm] = useState<boolean>(false);
  const [newProgNome, setNewProgNome] = useState<string>('');
  const [newProgPath, setNewProgPath] = useState<string>('');
  const [newProgDesc, setNewProgDesc] = useState<string>('');

  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const exeInputRef = useRef<HTMLInputElement | null>(null);

  const checkLocalWindowsBridge = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 900);
      const res = await fetch('http://127.0.0.1:3847/status', { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json();
        if (json?.ok) {
          setBridgeConnected(true);
          setBridgeUser(json.user || 'Windows');
          return true;
        }
      }
    } catch {}
    setBridgeConnected(false);
    return false;
  }, []);

  const loadDirectoryContents = useCallback(
    async (targetDir: string) => {
      setCurrentPath(targetDir);
      if (targetDir === 'LOCAL_PICKED_FOLDER') {
        setFilesList(localPickedFiles);
        return;
      }

      const isBridgeAlive = await checkLocalWindowsBridge();
      if (isBridgeAlive) {
        try {
          const res = await fetch(
            `http://127.0.0.1:3847/list?dir=${encodeURIComponent(targetDir || 'C:\\')}`
          );
          if (res.ok) {
            const json = await res.json();
            if (json?.ok && Array.isArray(json.items)) {
              setCurrentPath(json.currentDir || targetDir);
              setFilesList(json.items);
              return;
            }
          }
        } catch {}
      }

      setFilesList(localPickedFiles);
    },
    [checkLocalWindowsBridge, localPickedFiles]
  );

  useEffect(() => {
    if (open) {
      loadDirectoryContents(currentPath);
    }
  }, [open, currentPath, loadDirectoryContents]);

  if (!open) return null;

  const navigateToFolder = (nextDir: string) => {
    setPathHistory((prev) => [...prev, nextDir]);
    loadDirectoryContents(nextDir);
  };

  const handleGoBack = () => {
    if (pathHistory.length <= 1) return;
    const clone = [...pathHistory];
    clone.pop();
    const prevDir = clone[clone.length - 1];
    setPathHistory(clone);
    loadDirectoryContents(prevDir);
  };

  const handleGoUp = () => {
    if (!currentPath || currentPath === 'LOCAL_PICKED_FOLDER' || currentPath === 'C:\\') {
      return;
    }
    const parts = currentPath.replace(/\\+$/, '').split('\\');
    if (parts.length <= 1) {
      navigateToFolder('C:\\');
      return;
    }
    parts.pop();
    const parent = parts.length === 1 ? `${parts[0]}\\` : parts.join('\\');
    navigateToFolder(parent);
  };

  const handleExecuteProgramOrFile = async (
    label: string,
    targetExePath: string,
    protocoloUri?: string,
    fileObj?: File
  ) => {
    const isBridgeAlive = await checkLocalWindowsBridge();
    if (isBridgeAlive) {
      try {
        await fetch(
          `http://127.0.0.1:3847/exec?target=${encodeURIComponent(targetExePath)}&hide_urutau=1`
        );
      } catch {}
    } else if (protocoloUri) {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = protocoloUri;
        document.body.appendChild(iframe);
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }, 1500);
      } catch {}
    }

    if (fileObj && !targetExePath.toLowerCase().endsWith('.exe')) {
      const blobUrl = URL.createObjectURL(fileObj);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileObj.name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 400);
    }

    if (onLaunchPcProgram) {
      onLaunchPcProgram({
        id: `pc_prog_${targetExePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
        nome: label,
        caminhoExe: targetExePath,
        protocoloUri,
        launchedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      });
      onClose();
      return;
    }
  };

  const handlePickRealComputerFolder = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker();
        const entries: ExplorerFileEntry[] = [];
        for await (const [name, handle] of dirHandle.entries()) {
          const isDir = handle.kind === 'directory';
          let size = 0;
          let fileObj: File | undefined;
          if (!isDir) {
            try {
              fileObj = await handle.getFile();
              size = fileObj?.size || 0;
            } catch {}
          }
          const extMatch = name.includes('.') ? `.${name.split('.').pop()}` : '';
          entries.push({
            name,
            fullPath: `${dirHandle.name}\\${name}`,
            isDir,
            ext: extMatch,
            size,
            fileObj
          });
        }
        setLocalPickedFolderName(dirHandle.name);
        setLocalPickedFiles(entries);
        setCurrentPath('LOCAL_PICKED_FOLDER');
        setFilesList(entries);
        setActiveView('explorer');
        setStatusFeedback(
          `Pasta "${dirHandle.name}" carregada com ${entries.length} itens reais do computador.`
        );
        return;
      }
    } catch {}
    folderInputRef.current?.click();
  };

  const handleFolderInputFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const entries: ExplorerFileEntry[] = [];
    let folderName = 'Pasta_Selecionada';
    Array.from(fileList)
      .slice(0, 200)
      .forEach((f: any) => {
        const rel = f.webkitRelativePath || f.name;
        if (rel.includes('/')) {
          folderName = rel.split('/')[0];
        }
        const ext = f.name.includes('.') ? `.${f.name.split('.').pop()}` : '';
        entries.push({
          name: f.name,
          fullPath: rel.replace(/\//g, '\\'),
          isDir: false,
          ext,
          size: f.size,
          fileObj: f
        });
      });
    setLocalPickedFolderName(folderName);
    setLocalPickedFiles(entries);
    setCurrentPath('LOCAL_PICKED_FOLDER');
    setFilesList(entries);
    setActiveView('explorer');
    setStatusFeedback(`Pasta "${folderName}" carregada com ${entries.length} arquivos reais.`);
  };

  const handleSaveNewCustomProgram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgNome.trim() || !newProgPath.trim()) return;
    const item: WindowsProgramItem = {
      id: `custom_${Date.now()}`,
      nome: newProgNome.trim(),
      caminhoExe: newProgPath.trim(),
      categoria: 'Personalizado',
      descricao: newProgDesc.trim() || 'Executável do computador'
    };
    const next = [item, ...programs];
    setPrograms(next);
    try {
      localStorage.setItem('urutau_windows_programs_real_v2', JSON.stringify(next));
    } catch {}
    setNewProgNome('');
    setNewProgPath('');
    setNewProgDesc('');
    setShowAddProgramForm(false);
  };

  const handleExeFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const baseName = f.name.replace(/\.(exe|bat|cmd|msi)$/i, '');
    const customPath = f.name;
    const novo: WindowsProgramItem = {
      id: `picked_${Date.now()}`,
      nome: baseName,
      caminhoExe: customPath,
      categoria: 'Personalizado',
      descricao: `Selecionado do computador (${Math.max(1, Math.round(f.size / 1024))} KB)`
    };
    const next = [novo, ...programs];
    setPrograms(next);
    try {
      localStorage.setItem('urutau_windows_programs_real_v2', JSON.stringify(next));
    } catch {}
    handleExecuteProgramOrFile(baseName, customPath, undefined, f);
  };

  const handleDeleteProgram = (id: string) => {
    const next = programs.filter((p) => p.id !== id);
    setPrograms(next);
    try {
      localStorage.setItem('urutau_windows_programs_real_v2', JSON.stringify(next));
    } catch {}
  };

  const filteredFiles = filesList.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[190] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-5xl bg-[#041418] border-2 border-[#10B981]/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-4 py-3 bg-[#020B0D] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-center text-[#10B981]">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white tracking-wide">
                  URUTAU.EXE — EXPLORER NATIVO WINDOWS
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#10B981]/20 text-[#6EE7B7] border border-[#10B981]/40">
                  {bridgeConnected ? `Ponte Nativa (${bridgeUser})` : 'Arquivos Locais'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Navegação em pastas reais selecionadas do computador no ambiente desktop
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => downloadCompanyAutonomyBackup(companyName)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Dados da Empresa</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-200 border border-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-4 py-2.5 bg-[#061C21] border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-[240px]">
            <button
              type="button"
              onClick={handleGoBack}
              disabled={pathHistory.length <= 1}
              className="p-2 rounded-lg bg-black/40 hover:bg-black/60 disabled:opacity-40 text-slate-200 border border-white/10 cursor-pointer"
              title="Voltar pasta"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleGoUp}
              className="p-2 rounded-lg bg-black/40 hover:bg-black/60 text-slate-200 border border-white/10 cursor-pointer"
              title="Subir um nível"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => loadDirectoryContents(currentPath)}
              className="p-2 rounded-lg bg-black/40 hover:bg-black/60 text-slate-200 border border-white/10 cursor-pointer"
              title="Atualizar pasta"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#020C0E] border border-[#10B981]/35 font-mono text-xs text-[#6EE7B7]">
              <HardDrive className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
              <span className="truncate">
                {currentPath === 'LOCAL_PICKED_FOLDER'
                  ? `Pasta Real Selecionada: ${localPickedFolderName}`
                  : currentPath || 'Nenhuma pasta selecionada'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar arquivo..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#020C0E] border border-white/15 text-xs text-white focus:outline-none focus:border-[#10B981]"
              />
            </div>

            <button
              type="button"
              onClick={handlePickRealComputerFolder}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Abrir Pasta Real do PC</span>
            </button>

            <input
              ref={folderInputRef}
              type="file"
              multiple
              {...({ webkitdirectory: '', directory: '' } as any)}
              onChange={handleFolderInputFallback}
              className="hidden"
            />
            <input
              ref={exeInputRef}
              type="file"
              accept=".exe,.msi"
              onChange={handleExeFilePicked}
              className="hidden"
            />
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-[380px] overflow-hidden">
          <div className="md:col-span-3 bg-[#030F12] border-r border-white/10 p-3 flex flex-col justify-between gap-4 overflow-y-auto">
            <div className="space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
                Navegação Local
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveView('explorer')}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    activeView === 'explorer'
                      ? 'bg-[#10B981] text-[#04120C]'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Folder className="w-4 h-4 shrink-0" />
                  <span>Explorer de Arquivos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('programas')}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    activeView === 'programas'
                      ? 'bg-[#10B981] text-[#04120C]'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Play className="w-4 h-4 shrink-0" />
                  <span>Atalhos de Programas</span>
                </button>
              </div>
            </div>
          </div>

          <div className="md:col-span-9 p-4 overflow-y-auto flex flex-col justify-between gap-4 bg-[#06181C]">
            <div className="space-y-3">
              {statusFeedback && (
                <div className="p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/45 text-xs text-[#6EE7B7] font-semibold flex items-center justify-between gap-2">
                  <span>{statusFeedback}</span>
                  <button
                    type="button"
                    onClick={() => setStatusFeedback('')}
                    className="text-slate-300 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {activeView === 'explorer' ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-white/10">
                    <span className="text-xs font-bold text-slate-200">
                      Conteúdo da Pasta ({filteredFiles.length} itens)
                    </span>
                  </div>

                  {filteredFiles.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[#041215] border border-white/10 text-center space-y-3">
                      <FolderOpen className="w-8 h-8 text-[#10B981] mx-auto" />
                      <div className="text-xs font-bold text-white">
                        Nenhuma pasta local carregada
                      </div>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Clique em &ldquo;Abrir Pasta Real do PC&rdquo; para listar os arquivos reais de uma pasta do seu computador.
                      </p>
                      <button
                        type="button"
                        onClick={handlePickRealComputerFolder}
                        className="px-4 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#04120C] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Selecionar Pasta do Computador</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {filteredFiles.map((item) => {
                        const isExe =
                          item.ext.toLowerCase() === '.exe' ||
                          item.ext.toLowerCase() === '.msi';
                        return (
                          <div
                            key={item.fullPath + item.name}
                            className="p-3 rounded-xl bg-[#041215] hover:bg-[#09252B] border border-white/10 hover:border-[#10B981]/50 flex flex-col justify-between gap-2.5 transition-all"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                  item.isDir
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                                    : isExe
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                    : 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/30'
                                }`}
                              >
                                {item.isDir ? (
                                  <Folder className="w-4 h-4" />
                                ) : isExe ? (
                                  <Terminal className="w-4 h-4" />
                                ) : item.ext === '.xlsx' ? (
                                  <FileSpreadsheet className="w-4 h-4" />
                                ) : (
                                  <FileText className="w-4 h-4" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-white truncate" title={item.name}>
                                  {item.name}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono truncate">
                                  {item.isDir
                                    ? 'Pasta de Arquivos'
                                    : isExe
                                    ? 'Aplicativo Executável'
                                    : `${Math.max(1, Math.round(item.size / 1024))} KB`}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-white/5">
                              {item.isDir ? (
                                <button
                                  type="button"
                                  onClick={() => navigateToFolder(item.fullPath)}
                                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-xs font-bold text-amber-300 cursor-pointer"
                                >
                                  Abrir Pasta
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleExecuteProgramOrFile(
                                      item.name,
                                      item.fullPath,
                                      undefined,
                                      item.fileObj
                                    )
                                  }
                                  className="px-3 py-1 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#04120C] text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Maximize2 className="w-3 h-3" />
                                  <span>Abrir</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-white">
                        Atalhos de Programas do Computador (.exe)
                      </h3>
                      <p className="text-xs text-slate-300">
                        Cadastre caminhos de executáveis reais do Windows para acionamento rápido via ponte local:
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddProgramForm((v) => !v)}
                        className="px-3 py-1.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#04120C] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar Caminho (.exe)</span>
                      </button>
                    </div>
                  </div>

                  {showAddProgramForm && (
                    <form
                      onSubmit={handleSaveNewCustomProgram}
                      className="p-4 rounded-xl bg-[#041215] border border-[#10B981]/50 space-y-3"
                    >
                      <div className="text-xs font-bold text-[#6EE7B7]">
                        Cadastrar Caminho de Executável Real do Windows
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            Nome do Programa *
                          </label>
                          <input
                            type="text"
                            required
                            value={newProgNome}
                            onChange={(e) => setNewProgNome(e.target.value)}
                            placeholder="Ex: Emissor Fiscal / Balança"
                            className="w-full px-3 py-2 rounded-lg bg-[#020C0E] border border-white/15 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            Caminho do Executável (.exe) no Windows *
                          </label>
                          <input
                            type="text"
                            required
                            value={newProgPath}
                            onChange={(e) => setNewProgPath(e.target.value)}
                            placeholder="Ex: C:\Program Files\App\app.exe"
                            className="w-full px-3 py-2 rounded-lg bg-[#020C0E] border border-white/15 text-xs font-mono text-white"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddProgramForm(false)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-slate-300 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg bg-[#10B981] text-[#04120C] text-xs font-black cursor-pointer"
                        >
                          Salvar Atalho
                        </button>
                      </div>
                    </form>
                  )}

                  {programs.length === 0 ? (
                    <div className="p-6 rounded-xl bg-[#041215] border border-white/10 text-center text-xs text-slate-400">
                      Nenhum atalho personalizado cadastrado.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {programs.map((prog) => (
                        <div
                          key={prog.id}
                          className="p-3.5 rounded-xl bg-[#041215] border border-white/10 hover:border-[#10B981]/50 flex flex-col justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                                {prog.categoria}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteProgram(prog.id)}
                                className="text-rose-400 hover:text-rose-300 cursor-pointer"
                                title="Remover atalho"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="text-sm font-bold text-white">{prog.nome}</div>
                            <div className="text-[11px] text-slate-400">{prog.descricao}</div>
                            <div className="text-[10px] font-mono text-[#6EE7B7] truncate pt-0.5">
                              {prog.caminhoExe}
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                            <button
                              type="button"
                              onClick={() =>
                                handleExecuteProgramOrFile(
                                  prog.nome,
                                  prog.caminhoExe,
                                  prog.protocoloUri
                                )
                              }
                              className="px-3.5 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#04120C] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Executar no Windows</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
