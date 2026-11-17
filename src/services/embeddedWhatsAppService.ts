import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type { WASocket } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.resolve(__dirname, '../../data/whatsapp_session');

export type WppConnectionStatus =
  | 'desconectado'
  | 'iniciando'
  | 'aguardando_leitura'
  | 'conectado'
  | 'reconectando'
  | 'erro';

export interface EmbeddedWhatsAppState {
  status: WppConnectionStatus;
  qrCodeRaw: string | null;
  qrCodeDataUrl: string | null;
  pairingCode: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  ultimoErro: string | null;
  atualizadoEm: string;
}

export type IncomingMessageHandler = (data: {
  remetenteTelefone: string;
  nomeContato: string;
  textoMensagem: string;
  horario: string;
}) => Promise<string | void>;

export class EmbeddedWhatsAppService {
  private socket: WASocket | null = null;
  private status: WppConnectionStatus = 'desconectado';
  private qrCodeRaw: string | null;
  private qrCodeDataUrl: string | null = null;
  private pairingCode: string | null = null;
  private connectedPhone: string | null = null;
  private connectedName: string | null = null;
  private ultimoErro: string | null = null;
  private onIncomingMessageCallback: IncomingMessageHandler | null = null;
  private onStatusChangeCallback: ((state: EmbeddedWhatsAppState) => void) | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isExplicitDisconnect: boolean = false;

  constructor() {
    this.qrCodeRaw = null;
    this.garantirDiretorioAuth();
  }

  private garantirDiretorioAuth(): void {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
  }

  public setIncomingMessageHandler(handler: IncomingMessageHandler): void {
    this.onIncomingMessageCallback = handler;
  }

  public setStatusChangeCallback(callback: (state: EmbeddedWhatsAppState) => void): void {
    this.onStatusChangeCallback = callback;
  }

  public getState(): EmbeddedWhatsAppState {
    return {
      status: this.status,
      qrCodeRaw: this.qrCodeRaw,
      qrCodeDataUrl: this.qrCodeDataUrl,
      pairingCode: this.pairingCode,
      connectedPhone: this.connectedPhone,
      connectedName: this.connectedName,
      ultimoErro: this.ultimoErro,
      atualizadoEm: new Date().toISOString()
    };
  }

  public isConectado(): boolean {
    return this.status === 'conectado' && Boolean(this.socket);
  }

  private emitState(): void {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(this.getState());
    }
  }

  public async iniciarConexao(telefonePareamento?: string): Promise<EmbeddedWhatsAppState> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.isExplicitDisconnect = false;
    this.garantirDiretorioAuth();
    this.status = 'iniciando';
    this.ultimoErro = null;
    this.emitState();

    try {
      const baileysModule = await import('@whiskeysockets/baileys');
      const makeWASocket = baileysModule.default;
      const {
        DisconnectReason,
        useMultiFileAuthState,
        fetchLatestBaileysVersion,
        Browsers
      } = baileysModule;
      const pinoModule = await import('pino');
      const pino = pinoModule.default;

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 1015901307] as [number, number, number]
      }));

      const logger = pino({ level: 'silent' });

      this.socket = makeWASocket({
        version,
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: Browsers.appropriate('Urutau ERP'),
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        generateHighQualityLinkPreview: false
      });

      this.socket.ev.on('creds.update', saveCreds);

      this.socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrCodeRaw = qr;
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              scale: 6,
              color: { dark: '#04120C', light: '#FFFFFF' }
            });
          } catch (qrErr: any) {
            this.ultimoErro = qrErr?.message || 'Falha ao renderizar QR Code';
          }
          this.status = 'aguardando_leitura';
          this.emitState();
        }

        if (connection === 'open') {
          this.status = 'conectado';
          this.qrCodeRaw = null;
          this.qrCodeDataUrl = null;
          this.pairingCode = null;
          this.ultimoErro = null;

          const userJid = this.socket?.user?.id || '';
          this.connectedPhone = userJid.split(':')[0] || userJid.split('@')[0] || null;
          this.connectedName = this.socket?.user?.name || 'Urutau Bot';
          this.emitState();
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect =
            !this.isExplicitDisconnect &&
            statusCode !== DisconnectReason.loggedOut;

          this.qrCodeRaw = null;
          this.qrCodeDataUrl = null;
          this.pairingCode = null;

          if (statusCode === DisconnectReason.loggedOut) {
            this.status = 'desconectado';
            this.connectedPhone = null;
            this.connectedName = null;
            this.socket = null;
            this.limparCredenciais();
            this.emitState();
          } else if (shouldReconnect) {
            this.status = 'reconectando';
            this.emitState();
            this.reconnectTimeout = setTimeout(() => {
              this.iniciarConexao();
            }, 5000);
          } else {
            this.status = 'desconectado';
            this.socket = null;
            this.emitState();
          }
        }
      });

      this.socket.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        for (const msg of m.messages) {
          if (msg.key.fromMe) continue;
          const remoteJid = msg.key.remoteJid;
          if (!remoteJid || remoteJid.includes('@g.us')) continue;

          const texto =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            '';

          if (!texto.trim()) continue;

          const remetenteTel = remoteJid.replace('@s.whatsapp.net', '');
          const nomeContato = msg.pushName || `Colaborador ${remetenteTel.slice(-4)}`;
          const horario = new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
          });

          if (this.onIncomingMessageCallback) {
            try {
              const resposta = await this.onIncomingMessageCallback({
                remetenteTelefone: remetenteTel,
                nomeContato,
                textoMensagem: texto,
                horario
              });

              if (resposta && typeof resposta === 'string' && this.socket) {
                await this.socket.sendMessage(remoteJid, { text: resposta });
              }
            } catch (handlerErr: any) {
              console.error('Erro ao processar mensagem recebida no WhatsApp:', handlerErr?.message);
            }
          }
        }
      });

      if (telefonePareamento && !state.creds.registered) {
        const cleanTel = telefonePareamento.replace(/\D/g, '');
        if (cleanTel.length >= 10) {
          setTimeout(async () => {
            try {
              if (this.socket && !this.socket.authState.creds.registered) {
                const code = await this.socket.requestPairingCode(cleanTel);
                this.pairingCode = code;
                this.emitState();
              }
            } catch (pairErr: any) {
              this.ultimoErro = pairErr?.message || 'Falha ao solicitar código de pareamento';
              this.emitState();
            }
          }, 3000);
        }
      }

      return this.getState();
    } catch (err: any) {
      this.status = 'erro';
      this.ultimoErro = err?.message || 'Falha ao inicializar socket Baileys';
      this.emitState();
      return this.getState();
    }
  }

  public async enviarMensagem(
    telefone: string,
    texto: string
  ): Promise<{ ok: boolean; messageId?: string; erro?: string }> {
    if (!this.socket || this.status !== 'conectado') {
      return { ok: false, erro: 'WhatsApp não está conectado no momento.' };
    }

    const digits = telefone.replace(/\D/g, '');
    if (digits.length < 8) {
      return { ok: false, erro: 'Número de telefone inválido.' };
    }

    const fullDigits = digits.startsWith('55') ? digits : `55${digits}`;
    const jid = `${fullDigits}@s.whatsapp.net`;

    try {
      const sent = await this.socket.sendMessage(jid, { text: texto });
      return { ok: true, messageId: sent?.key?.id || undefined };
    } catch (err: any) {
      return { ok: false, erro: err?.message || 'Falha ao enviar mensagem pelo WhatsApp.' };
    }
  }

  public async desconectar(): Promise<EmbeddedWhatsAppState> {
    this.isExplicitDisconnect = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      if (this.socket) {
        await this.socket.logout().catch(() => {});
        this.socket.end(new Error('Desconexão solicitada pelo usuário'));
      }
    } catch {
    } finally {
      this.socket = null;
      this.status = 'desconectado';
      this.qrCodeRaw = null;
      this.qrCodeDataUrl = null;
      this.pairingCode = null;
      this.connectedPhone = null;
      this.connectedName = null;
      this.limparCredenciais();
      this.emitState();
    }

    return this.getState();
  }

  private limparCredenciais(): void {
    try {
      if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      }
    } catch {
    }
  }
}

export const embeddedWhatsApp = new EmbeddedWhatsAppService();
