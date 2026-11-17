import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    const dismissed = localStorage.getItem('urutau_pwa_banner_dismissed');
    if (dismissed === 'true') return;

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIOS(ios);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('urutau_pwa_banner_dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-amber-500/30 bg-zinc-900/95 p-4 text-zinc-100 shadow-2xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <Download className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Instalar Urutau ERP</h4>
            <p className="text-xs text-zinc-400">
              {isIOS
                ? 'Toque em Compartilhar e depois em "Adicionar à Tela de Início".'
                : 'Instale o aplicativo para acesso rápido e operação offline.'}
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          title="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {!isIOS && deferredPrompt && (
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={handleDismiss}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Agora não
          </button>
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
          >
            <Download className="h-3.5 w-3.5" />
            Instalar App
          </button>
        </div>
      )}
      {isIOS && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
          <Share className="h-3.5 w-3.5" />
          <span>Use o menu do Safari para instalar</span>
        </div>
      )}
    </div>
  );
};
