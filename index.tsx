/*
 * Vencord ScreenShare Alert Plugin
 * Detecta quando alguém inicia screen share, câmera ou possivelmente grava a call.
 * Foco: privacidade — alertar o usuário sobre possível gravação externa sem consentimento.
 *
 * Camadas de detecção (da mais confiável para a mais heurística):
 *   L1: VoiceStateStore do Discord (screen share, câmera) — alta confiança
 *   L2: Monitoramento de RTCPeerConnection (anomalias de stream)
 *   L3: Interceptação de getDisplayMedia / getUserMedia (captura local)
 *   L4: Indicadores visuais na UI do Discord (recording, clip)
 *   L5: Heurísticas de comportamento de stream
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

const settings = definePluginSettings({
    // ── Notificações ──────────────────────────────────────────────
    enableNotification: {
        type: OptionType.BOOLEAN,
        description: "Mostrar notificação visual quando algo for detectado",
        default: true
    },
    enableSound: {
        type: OptionType.BOOLEAN,
        description: "Tocar som de alerta ao detectar atividade",
        default: true
    },
    displayDuration: {
        type: OptionType.SLIDER,
        description: "Duração da notificação na tela (segundos)",
        markers: [3, 5, 7, 10, 15],
        default: 5,
        min: 3,
        max: 15
    },
    maxNotifications: {
        type: OptionType.SLIDER,
        description: "Máximo de notificações simultâneas (empilhadas)",
        markers: [1, 2, 3, 5],
        default: 3,
        min: 1,
        max: 5
    },

    // ── Filtros de detecção ───────────────────────────────────────
    ignoreOwnShare: {
        type: OptionType.BOOLEAN,
        description: "Ignorar quando VOCÊ está compartilhando tela",
        default: true
    },
    detectScreenShare: {
        type: OptionType.BOOLEAN,
        description: "Detectar screen share de outros participantes",
        default: true
    },
    detectVideo: {
        type: OptionType.BOOLEAN,
        description: "Detectar quando participantes ligam a câmera",
        default: true
    },
    detectRecording: {
        type: OptionType.BOOLEAN,
        description: "Detectar possíveis gravações externas (heurísticas)",
        default: true
    },
    detectLocalCapture: {
        type: OptionType.BOOLEAN,
        description: "Detectar quando APIs de captura de tela/áudio são usadas localmente",
        default: true
    },

    // ── Posição e layout ─────────────────────────────────────────
    enableDragAndDrop: {
        type: OptionType.BOOLEAN,
        description: "Permitir arrastar a notificação para reposicionar",
        default: true
    },
    position: {
        type: OptionType.SELECT,
        description: "Posição inicial da notificação",
        options: [
            { label: "Canto Superior Direito", value: "top-right" },
            { label: "Canto Superior Esquerdo", value: "top-left" },
            { label: "Canto Inferior Direito", value: "bottom-right" },
            { label: "Canto Inferior Esquerdo", value: "bottom-left" },
            { label: "Centro Superior", value: "top-center" },
            { label: "Centro Inferior", value: "bottom-center" },
            { label: "Centro (Meio da Tela)", value: "center" }
        ],
        default: "top-right"
    },
    notificationWidth: {
        type: OptionType.SLIDER,
        description: "Largura da notificação (px)",
        markers: [200, 300, 400, 500, 600],
        default: 350,
        min: 200,
        max: 600
    },
    notificationHeight: {
        type: OptionType.SLIDER,
        description: "Altura mínima da notificação (px)",
        markers: [50, 70, 90, 110, 130],
        default: 80,
        min: 50,
        max: 130
    },
    offsetX: {
        type: OptionType.SLIDER,
        description: "Distância horizontal das bordas (px)",
        markers: [0, 10, 20, 30, 40, 50],
        default: 20,
        min: 0,
        max: 50
    },
    offsetY: {
        type: OptionType.SLIDER,
        description: "Distância vertical das bordas (px)",
        markers: [0, 10, 20, 30, 40, 50],
        default: 20,
        min: 0,
        max: 50
    },

    // ── Cores ────────────────────────────────────────────────────
    screenShareColor: {
        type: OptionType.STRING,
        description: "Cor do gradiente Screen Share (esquerda) - #RRGGBB",
        default: "#FF5C5C"
    },
    screenShareColorEnd: {
        type: OptionType.STRING,
        description: "Cor do gradiente Screen Share (direita) - #RRGGBB",
        default: "#FF3B3B"
    },
    videoColor: {
        type: OptionType.STRING,
        description: "Cor do gradiente Câmera (esquerda) - #RRGGBB",
        default: "#5C9EFF"
    },
    videoColorEnd: {
        type: OptionType.STRING,
        description: "Cor do gradiente Câmera (direita) - #RRGGBB",
        default: "#3B7FFF"
    },
    recordingColor: {
        type: OptionType.STRING,
        description: "Cor do gradiente Gravação (esquerda) - #RRGGBB",
        default: "#FF1744"
    },
    recordingColorEnd: {
        type: OptionType.STRING,
        description: "Cor do gradiente Gravação (direita) - #RRGGBB",
        default: "#D50000"
    },

    // ── Debug ────────────────────────────────────────────────────
    debugMode: {
        type: OptionType.BOOLEAN,
        description: "Logs detalhados no console (F12) para debug",
        default: false
    }
});

/* ------------------------------------------------------------------ */
/*  Discord module finds                                               */
/* ------------------------------------------------------------------ */

// VoiceStateStore — fonte primária e confiável de detecção
const VoiceStateStore: {
    getVoiceStateForUser: (userId: string) => VoiceState | undefined;
    getVoiceStates: () => Record<string, VoiceState>;
    getVoiceStatesForChannel: (channelId: string) => VoiceState[];
} = findByPropsLazy("getVoiceStateForUser", "getVoiceStates");

// UserStore — para obter nome, avatar etc.
const UserStore: {
    getUser: (userId: string) => User | undefined;
    getCurrentUser: () => User;
} = findByPropsLazy("getUser", "getCurrentUser");

// SelectedChannelStore — canal atual
const SelectedChannelStore: {
    getChannelId: () => string;
    getCurrentlySelectedChannelId: () => string;
} = findByPropsLazy("getChannelId", "getCurrentlySelectedChannelId");

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface VoiceState {
    userId: string;
    channelId: string;
    sessionId: string;
    selfVideo: boolean;
    selfStream: boolean;
    selfMute: boolean;
    selfDeaf: boolean;
    suppress: boolean;
}

interface User {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    globalName?: string;
}

interface ActiveStream {
    userId: string;
    username: string;
    avatarUrl: string;
    type: "screen" | "video" | "recording";
    detectedAt: number;
}

interface NotificationEntry {
    id: string;
    element: HTMLDivElement;
    stream: ActiveStream;
    timeoutId: ReturnType<typeof setTimeout>;
    dragCleanup: (() => void) | null;
}

/* ------------------------------------------------------------------ */
/*  Plugin                                                             */
/* ------------------------------------------------------------------ */

export default definePlugin({
    name: "ScreenShareAlert",
    description: "Detecta screen share, câmera e possíveis gravações em calls — alertas visuais e sonoros",
    tags: ["Screen", "Alert", "Recording", "Privacy", "Utility"],
    authors: [
        {
            name: "arrependimentosconstantes",
            id: "0n",
            github: "https://github.com/arrependimentosconstantes"
        }
    ],
    settings,
    homepage: "https://github.com/arrependimentosconstantes/Extension-ScreenShareAlert/tree/main",
    supportURL: "https://github.com/arrependimentosconstantes/Extension-ScreenShareAlert/issues",

    /* -------------------------------------------------------------- */
    /*  Lifecycle                                                      */
    /* -------------------------------------------------------------- */

    start() {
        // Estado de streams ativos
        this.activeStreams = new Map<string, ActiveStream>();

        // Notificações ativas na tela (stack)
        this.activeNotifications = new Map<string, NotificationEntry>();

        // Estado local
        this.isInCall = false;
        this.wasInCall = false;
        this.isUserSharing = false;
        this.currentChannelId = "";

        // Posição customizada (definida via drag & drop)
        this.customPosition = { x: null as number | null, y: null as number | null };

        // WebRTC monitor
        this.rtcMonitorActive = false;
        this.originalGetDisplayMedia = null;
        this.originalGetUserMedia = null;
        this.rtcConnectionCount = 0;

        // Contador para IDs de notificação
        this.notificationCounter = 0;

        this.log("Plugin iniciado - monitorando calls");

        // Injetar estilos CSS globais (uma única vez)
        this.injectGlobalStyles();

        // Iniciar loop unificado de monitoramento
        this.monitorInterval = setInterval(() => {
            this.unifiedMonitor();
        }, 1500);

        // Setup inicial de interceptação de APIs
        if (this.settings.store.detectLocalCapture) {
            this.setupLocalCaptureDetection();
        }

        // Setup de monitoramento WebRTC
        if (this.settings.store.detectRecording) {
            this.setupWebRTCMonitor();
        }
    },

    stop() {
        // Limpar intervalo de monitoramento
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }

        // Remover TODAS as notificações ativas
        for (const [, entry] of this.activeNotifications) {
            this.destroyNotification(entry);
        }
        this.activeNotifications.clear();

        // Remover estilos globais
        const globalStyles = document.getElementById("screenshare-alert-global-styles");
        if (globalStyles) {
            globalStyles.remove();
        }

        // Remover interceptações de API
        this.teardownLocalCaptureDetection();

        // Limpar estado
        this.activeStreams.clear();
        this.rtcMonitorActive = false;
        this.customPosition = { x: null, y: null };

        this.log("Plugin parado - todos recursos liberados");
    },

    /* -------------------------------------------------------------- */
    /*  Unified monitor                                                */
    /* -------------------------------------------------------------- */

    unifiedMonitor() {
        try {
            // 1. Verificar se estamos em uma call
            this.checkCallStatus();
            if (!this.isInCall) {
                // Se saiu da call, limpar tudo
                if (this.wasInCall) {
                    this.clearAllNotifications();
                    this.activeStreams.clear();
                }
                this.wasInCall = false;
                return;
            }
            this.wasInCall = true;

            // 2. Detectar via VoiceStateStore (confiável)
            const detectedStreams = this.detectViaVoiceStateStore();

            // 3. Detectar gravações via heurísticas (experimental)
            if (this.settings.store.detectRecording) {
                const recordingStreams = this.detectRecordings();
                detectedStreams.push(...recordingStreams);
            }

            // 4. Processar streams detectados
            for (const stream of detectedStreams) {
                this.processDetectedStream(stream);
            }

        } catch (e) {
            this.debug("Erro no monitor unificado:", e);
        }
    },

    /* -------------------------------------------------------------- */
    /*  Call status detection (Discord stores)                         */
    /* -------------------------------------------------------------- */

    checkCallStatus() {
        try {
            this.currentChannelId = SelectedChannelStore.getCurrentlySelectedChannelId?.()
                ?? SelectedChannelStore.getChannelId?.()
                ?? "";

            if (!this.currentChannelId) {
                this.isInCall = false;
                return;
            }

            // Verificar se há voice states ativos no canal atual
            const voiceStates = VoiceStateStore.getVoiceStatesForChannel?.(this.currentChannelId);
            if (voiceStates && voiceStates.length > 0) {
                this.isInCall = true;
            } else {
                // Fallback: verificar todos os voice states
                const allStates = VoiceStateStore.getVoiceStates?.();
                this.isInCall = allStates ? Object.keys(allStates).length > 0 : false;
            }

            // Atualizar status de compartilhamento próprio
            this.isUserSharing = this.checkIfUserIsSharing();
        } catch (e) {
            // Se as stores não estão disponíveis, usar fallback DOM
            this.checkCallStatusFallback();
        }
    },

    /** Fallback DOM-based quando os stores não respondem */
    checkCallStatusFallback() {
        try {
            const voiceElements = document.querySelectorAll(
                '[class*="voiceConnected"], [class*="callContainer"], [class*="videoGrid"]'
            );
            const wasInCall = this.isInCall;
            this.isInCall = voiceElements.length > 0;

            if (this.isInCall && !wasInCall) {
                this.log("Call detectada (fallback DOM)");
            } else if (!this.isInCall && wasInCall) {
                this.log("Saida de call detectada (fallback DOM)");
            }
        } catch (e) {
            this.debug("Erro no fallback de call:", e);
        }
    },

    checkIfUserIsSharing(): boolean {
        try {
            // Método confiável: VoiceStateStore
            const currentUser = UserStore.getCurrentUser?.();
            if (currentUser) {
                const myState = VoiceStateStore.getVoiceStateForUser?.(currentUser.id);
                if (myState) {
                    return myState.selfStream || false;
                }
            }
        } catch (e) {
            // Fallback para DOM
        }

        // Fallback DOM
        try {
            const indicators = document.querySelectorAll(
                '[class*="screenShare"][class*="active"], ' +
                '[aria-label="Stop sharing"], ' +
                '[aria-label*="Stop sharing"]'
            );
            return indicators.length > 0;
        } catch (e) {
            return false;
        }
    },

    /* -------------------------------------------------------------- */
    /*  L1: VoiceStateStore detection (reliable)                       */
    /* -------------------------------------------------------------- */

    detectViaVoiceStateStore(): ActiveStream[] {
        const streams: ActiveStream[] = [];

        try {
            const currentUser = UserStore.getCurrentUser?.();
            const currentUserId = currentUser?.id ?? "";

            // Obter voice states do canal atual
            let voiceStates: VoiceState[] = [];
            try {
                if (this.currentChannelId) {
                    voiceStates = VoiceStateStore.getVoiceStatesForChannel?.(this.currentChannelId) ?? [];
                }
                if (voiceStates.length === 0) {
                    const allStates = VoiceStateStore.getVoiceStates?.();
                    if (allStates) {
                        voiceStates = Object.values(allStates);
                    }
                }
            } catch (e) {
                this.debug("VoiceStateStore indisponivel, usando fallback DOM");
                return this.detectViaDOM();
            }

            for (const vs of voiceStates) {
                // Pular self se configurado
                if (this.settings.store.ignoreOwnShare && vs.userId === currentUserId) {
                    continue;
                }

                // Screen share
                if (vs.selfStream && this.settings.store.detectScreenShare) {
                    const user = UserStore.getUser?.(vs.userId);
                    if (user) {
                        streams.push({
                            userId: user.id,
                            username: user.globalName || user.username,
                            avatarUrl: this.buildAvatarUrl(user),
                            type: "screen",
                            detectedAt: Date.now()
                        });
                    }
                }

                // Camera / Video
                if (vs.selfVideo && this.settings.store.detectVideo) {
                    const user = UserStore.getUser?.(vs.userId);
                    if (user) {
                        streams.push({
                            userId: user.id,
                            username: user.globalName || user.username,
                            avatarUrl: this.buildAvatarUrl(user),
                            type: "video",
                            detectedAt: Date.now()
                        });
                    }
                }
            }
        } catch (e) {
            this.debug("Erro no VoiceStateStore, usando fallback DOM:", e);
            return this.detectViaDOM();
        }

        return streams;
    },

    /** Fallback DOM-based detection */
    detectViaDOM(): ActiveStream[] {
        const streams: ActiveStream[] = [];
        try {
            const videos = document.querySelectorAll("video");
            for (let i = 0; i < videos.length; i++) {
                const video = videos[i] as HTMLVideoElement;
                const width = video.offsetWidth;
                const height = video.offsetHeight;
                const visible = window.getComputedStyle(video).display !== "none";

                if (width < 50 || height < 50 || !visible) continue;

                const isScreenShare = width > 500 || height > 400 || (width > 300 && height > 300);
                const isWebcam = width < 400 && height < 250;

                let type: "screen" | "video" | null = null;
                if (isScreenShare && this.settings.store.detectScreenShare) {
                    type = "screen";
                } else if (isWebcam && this.settings.store.detectVideo) {
                    type = "video";
                }

                if (type) {
                    const username = this.extractUsernameFromDOM(video, i);
                    streams.push({
                        userId: `dom-${i}`,
                        username,
                        avatarUrl: "",
                        type,
                        detectedAt: Date.now()
                    });
                }
            }
        } catch (e) {
            this.debug("Erro na deteccao DOM:", e);
        }
        return streams;
    },

    extractUsernameFromDOM(video: Element, fallbackIndex: number): string {
        try {
            let el: Element | null = video.parentElement;
            for (let i = 0; i < 15 && el; i++) {
                const cls = el.className?.toString() ?? "";
                if (cls && /participant|member|user|voice|layer/i.test(cls)) {
                    const nameEl = el.querySelector(
                        '[class*="name"], [data-testid*="user"], [aria-label]'
                    );
                    if (nameEl?.textContent?.trim()) {
                        return nameEl.textContent.trim().split("\n")[0].slice(0, 32);
                    }
                    if (nameEl?.getAttribute?.("aria-label")?.trim()) {
                        return nameEl.getAttribute("aria-label")!.trim().slice(0, 32);
                    }
                    const text = el.textContent?.trim();
                    if (text && text.length < 40) return text.split("\n")[0];
                }
                el = el.parentElement;
            }
        } catch (e) { /* fall through */ }
        return `User ${fallbackIndex + 1}`;
    },

    /* -------------------------------------------------------------- */
    /*  L2-L5: Recording detection                                     */
    /* -------------------------------------------------------------- */

    detectRecordings(): ActiveStream[] {
        const streams: ActiveStream[] = [];

        try {
            // Heurística 1: Indicadores visuais de gravação/clip na UI do Discord
            const recordingSelectors = [
                '[aria-label*="recording" i]',
                '[aria-label*="Record" i]',
                '[class*="recording-indicator"]',
                '[class*="clipEnabled"]',
                '[class*="recordingBadge"]',
                '[data-testid*="recording"]'
            ];

            for (const sel of recordingSelectors) {
                try {
                    const elements = document.querySelectorAll(sel);
                    for (const el of elements) {
                        const visible = window.getComputedStyle(el).display !== "none";
                        if (visible) {
                            this.debug("Indicador visual de gravacao encontrado:", sel);
                            streams.push({
                                userId: "recording-detected",
                                username: "Possivel Gravacao",
                                avatarUrl: "",
                                type: "recording",
                                detectedAt: Date.now()
                            });
                            break;
                        }
                    }
                } catch (e) { /* seletor pode ser invalido */ }
                if (streams.length > 0) break;
            }

            // Heurística 2: WebRTC stats anômalos (múltiplas connections)
            if (this.rtcConnectionCount > 3) {
                this.debug(`WebRTC anomalo: ${this.rtcConnectionCount} conexoes`);
                streams.push({
                    userId: "webrtc-anomaly",
                    username: "Atividade de Rede Anomala",
                    avatarUrl: "",
                    type: "recording",
                    detectedAt: Date.now()
                });
            }

        } catch (e) {
            this.debug("Erro na deteccao de gravacao:", e);
        }

        return streams;
    },

    /* -------------------------------------------------------------- */
    /*  Local capture detection (getDisplayMedia / getUserMedia)       */
    /* -------------------------------------------------------------- */

    setupLocalCaptureDetection() {
        try {
            // Interceptar getDisplayMedia (screen capture)
            if (navigator.mediaDevices?.getDisplayMedia) {
                this.originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(
                    navigator.mediaDevices
                );
                navigator.mediaDevices.getDisplayMedia = async (constraints?: any) => {
                    this.log("getDisplayMedia chamado - possivel captura de tela local");
                    this.onLocalCaptureDetected("screen");
                    return this.originalGetDisplayMedia(constraints);
                };
            }

            // Interceptar getUserMedia (camera/audio capture)
            if (navigator.mediaDevices?.getUserMedia) {
                this.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
                    navigator.mediaDevices
                );
                navigator.mediaDevices.getUserMedia = async (constraints?: any) => {
                    if (constraints?.audio) {
                        this.log("getUserMedia (audio) chamado - possivel captura de audio local");
                        this.onLocalCaptureDetected("audio");
                    }
                    return this.originalGetUserMedia(constraints);
                };
            }
        } catch (e) {
            this.debug("Erro ao interceptar APIs de captura:", e);
        }
    },

    teardownLocalCaptureDetection() {
        try {
            if (this.originalGetDisplayMedia && navigator.mediaDevices) {
                navigator.mediaDevices.getDisplayMedia = this.originalGetDisplayMedia;
                this.originalGetDisplayMedia = null;
            }
            if (this.originalGetUserMedia && navigator.mediaDevices) {
                navigator.mediaDevices.getUserMedia = this.originalGetUserMedia;
                this.originalGetUserMedia = null;
            }
        } catch (e) {
            this.debug("Erro ao restaurar APIs de captura:", e);
        }
    },

    onLocalCaptureDetected(captureType: "screen" | "audio") {
        const label = captureType === "screen" ? "Captura de Tela Local" : "Captura de Audio Local";
        this.processDetectedStream({
            userId: "local-capture",
            username: label,
            avatarUrl: "",
            type: "recording",
            detectedAt: Date.now()
        });
    },

    /* -------------------------------------------------------------- */
    /*  WebRTC monitor (track peer connections)                        */
    /* -------------------------------------------------------------- */

    setupWebRTCMonitor() {
        if (this.rtcMonitorActive) return;

        try {
            const OrigRTCPeerConnection =
                (window as any).RTCPeerConnection || (window as any).webkitRTCPeerConnection;
            if (!OrigRTCPeerConnection) return;

            const self = this;
            (window as any).RTCPeerConnection = function (...args: any[]) {
                self.rtcConnectionCount++;
                self.debug(`RTCPeerConnection criada (total: ${self.rtcConnectionCount})`);

                const pc = new OrigRTCPeerConnection(...args);

                const origClose = pc.close.bind(pc);
                pc.close = function () {
                    self.rtcConnectionCount = Math.max(0, self.rtcConnectionCount - 1);
                    self.debug(`RTCPeerConnection fechada (total: ${self.rtcConnectionCount})`);
                    return origClose();
                };

                return pc;
            };
            (window as any).RTCPeerConnection.prototype = OrigRTCPeerConnection.prototype;

            if ((window as any).webkitRTCPeerConnection) {
                (window as any).webkitRTCPeerConnection = (window as any).RTCPeerConnection;
            }

            this.rtcMonitorActive = true;
        } catch (e) {
            this.debug("Erro ao setup WebRTC monitor:", e);
        }
    },

    /* -------------------------------------------------------------- */
    /*  Stream processing (dedup + notify)                             */
    /* -------------------------------------------------------------- */

    processDetectedStream(stream: ActiveStream) {
        // Dedup key
        const key = `${stream.type}-${stream.userId}`;

        // Verificar se já notificamos este stream recentemente (anti-spam: 30s)
        const existing = this.activeStreams.get(key);
        if (existing && (Date.now() - existing.detectedAt) < 30000) {
            return;
        }

        // Registrar
        this.activeStreams.set(key, stream);

        // Notificar
        if (this.settings.store.enableNotification) {
            this.showNotification(stream);
        }

        // Alerta sonoro
        if (this.settings.store.enableSound) {
            this.playAlertSound();
        }

        // Limpar do cache após timeout
        setTimeout(() => {
            const cached = this.activeStreams.get(key);
            if (cached && (Date.now() - cached.detectedAt) > 30000) {
                this.activeStreams.delete(key);
            }
        }, 45000);
    },

    /* -------------------------------------------------------------- */
    /*  Sound alert                                                    */
    /* -------------------------------------------------------------- */

    playAlertSound() {
        try {
            const AudioContext =
                (window as any).AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = "sine";
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.05);
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);

            osc.onended = () => {
                ctx.close().catch(() => {});
            };
        } catch (e) {
            this.debug("Erro ao tocar som:", e);
        }
    },

    /* -------------------------------------------------------------- */
    /*  Notification system (stack-based)                              */
    /* -------------------------------------------------------------- */

    showNotification(stream: ActiveStream) {
        try {
            // Limitar número de notificações simultâneas
            const max = this.settings.store.maxNotifications;
            if (this.activeNotifications.size >= max) {
                const oldest = this.activeNotifications.entries().next();
                if (oldest.value) {
                    this.destroyNotification(oldest.value[1]);
                    this.activeNotifications.delete(oldest.value[0]);
                }
            }

            const id = `ssa-${++this.notificationCounter}-${stream.type}`;
            const element = this.createNotificationElement(stream, id);

            if (!element) return;

            const stackOffset = this.activeNotifications.size * 10;
            document.body.appendChild(element);

            const durationMs = (this.settings.store.displayDuration || 5) * 1000;
            const timeoutId = setTimeout(() => {
                this.animateOutAndRemove(id);
            }, durationMs);

            let dragCleanup: (() => void) | null = null;
            if (this.settings.store.enableDragAndDrop) {
                dragCleanup = this.setupDrag(element, id);
            }

            this.activeNotifications.set(id, {
                id,
                element,
                stream,
                timeoutId,
                dragCleanup
            });

            this.applyNotificationPosition(element, stackOffset);
        } catch (e) {
            this.debug("Erro ao criar notificacao:", e);
        }
    },

    createNotificationElement(
        stream: ActiveStream,
        id: string
    ): HTMLDivElement | null {
        try {
            const colorSchemes = {
                screen: {
                    gradient: `linear-gradient(135deg, ${this.settings.store.screenShareColor} 0%, ${this.settings.store.screenShareColorEnd} 100%)`,
                    icon: "\u{1F5A5}\u{FE0F}",
                    label: "Screen Share"
                },
                video: {
                    gradient: `linear-gradient(135deg, ${this.settings.store.videoColor} 0%, ${this.settings.store.videoColorEnd} 100%)`,
                    icon: "\u{1F4F9}",
                    label: "Camera"
                },
                recording: {
                    gradient: `linear-gradient(135deg, ${this.settings.store.recordingColor} 0%, ${this.settings.store.recordingColorEnd} 100%)`,
                    icon: "\u{1F534}",
                    label: "Gravacao Detectada"
                }
            };

            const scheme = colorSchemes[stream.type] || colorSchemes.screen;
            const isRecording = stream.type === "recording";
            const w = this.settings.store.notificationWidth;
            const h = this.settings.store.notificationHeight;
            const draggable = this.settings.store.enableDragAndDrop;

            const avatarHtml = this.buildAvatarHTML(stream);

            const wrapper = document.createElement("div");
            wrapper.id = id;
            wrapper.className = "screenshare-alert-notification";
            wrapper.setAttribute("data-ssa-type", stream.type);

            wrapper.innerHTML = `
                ${isRecording ? `<style>@keyframes ssa-pulse-${id}{0%,100%{box-shadow:0 12px 32px rgba(255,23,68,.3),0 0 0 1px rgba(255,255,255,.1)}50%{box-shadow:0 12px 32px rgba(255,23,68,.6),0 0 0 1px rgba(255,255,255,.15)}}.ssa-content-${id}{animation:ssa-pulse-${id} 1.5s infinite}</style>` : ""}
                <div class="ssa-content-${id}" style="
                    display:flex;align-items:center;gap:12px;
                    padding:12px 16px;
                    background:${scheme.gradient};
                    border-radius:12px;
                    box-shadow:0 12px 32px rgba(0,0,0,.3),0 0 0 1px rgba(255,255,255,.1);
                    backdrop-filter:blur(10px);
                    width:${w}px;min-height:${h}px;
                    box-sizing:border-box;position:relative;
                    cursor:${draggable ? "grab" : "default"};
                    transition:box-shadow .2s,filter .2s;
                    user-select:none;
                ">
                    ${draggable ? `<div class="ssa-drag-hint" style="position:absolute;top:-28px;left:50%;transform:translateX(-50%);font-size:11px;color:rgba(255,255,255,.8);font-weight:500;opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap;background:rgba(0,0,0,.5);padding:4px 8px;border-radius:6px;">Arraste para mover</div>` : ""}
                    ${avatarHtml}
                    <div style="display:flex;flex-direction:column;gap:2px;color:white;flex:1;min-width:0;justify-content:center;">
                        <div style="font-size:10px;font-weight:600;letter-spacing:.5px;opacity:.95;text-transform:uppercase;display:flex;align-items:center;gap:4px;">
                            <span>${scheme.icon}</span><span>${scheme.label}</span>
                        </div>
                        <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.3px;">
                            ${this.escapeHtml(stream.username)}
                        </div>
                    </div>
                    <button class="ssa-close-btn" style="position:absolute;top:6px;right:8px;background:rgba(255,255,255,.15);border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;color:white;font-size:12px;line-height:22px;text-align:center;opacity:0;transition:opacity .2s;padding:0;" title="Fechar">✕</button>
                </div>
            `;

            const closeBtn = wrapper.querySelector(".ssa-close-btn") as HTMLButtonElement;
            if (closeBtn) {
                closeBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.animateOutAndRemove(id);
                });
                wrapper.addEventListener("mouseenter", () => {
                    closeBtn.style.opacity = "1";
                });
                wrapper.addEventListener("mouseleave", () => {
                    closeBtn.style.opacity = "0";
                });
            }

            const content = wrapper.querySelector(
                `.ssa-content-${id}`
            ) as HTMLDivElement;
            if (content) {
                content.addEventListener("click", (e) => {
                    if ((e.target as HTMLElement).closest(".ssa-close-btn")) return;
                    window.focus();
                });
            }

            return wrapper;
        } catch (e) {
            this.debug("Erro ao criar elemento de notificacao:", e);
            return null;
        }
    },

    buildAvatarHTML(stream: ActiveStream): string {
        if (stream.avatarUrl) {
            return `
                <div style="width:48px;height:48px;border-radius:10px;overflow:hidden;border:2px solid rgba(255,255,255,.9);box-shadow:0 4px 12px rgba(0,0,0,.2);flex-shrink:0;">
                    <img src="${this.escapeHtml(stream.avatarUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;">
                </div>`;
        }
        const initial = (stream.username || "?")[0].toUpperCase();
        return `
            <div style="width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,#7289DA,#5865F2);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;border:2px solid rgba(255,255,255,.9);color:white;box-shadow:0 4px 12px rgba(0,0,0,.2);flex-shrink:0;">
                ${this.escapeHtml(initial)}
            </div>`;
    },

    applyNotificationPosition(element: HTMLDivElement, stackOffset: number) {
        if (this.customPosition.x !== null && this.customPosition.y !== null) {
            element.style.position = "fixed";
            element.style.left = `${this.customPosition.x}px`;
            element.style.top = `${this.customPosition.y + stackOffset}px`;
            element.style.right = "auto";
            element.style.bottom = "auto";
            element.style.transform = "none";
            return;
        }

        const pos = this.settings.store.position || "top-right";
        const ox = (this.settings.store.offsetX || 20) + stackOffset;
        const oy = (this.settings.store.offsetY || 20) + stackOffset;

        element.style.position = "fixed";
        element.style.zIndex = "99999";

        const positionStyles: Record<string, Partial<CSSStyleDeclaration>> = {
            "top-right": {
                top: `${oy}px`, right: `${ox}px`, left: "auto", bottom: "auto", transform: "none"
            },
            "top-left": {
                top: `${oy}px`, left: `${ox}px`, right: "auto", bottom: "auto", transform: "none"
            },
            "bottom-right": {
                bottom: `${oy}px`, right: `${ox}px`, top: "auto", left: "auto", transform: "none"
            },
            "bottom-left": {
                bottom: `${oy}px`, left: `${ox}px`, top: "auto", right: "auto", transform: "none"
            },
            "top-center": {
                top: `${oy}px`, left: "50%", right: "auto", bottom: "auto", transform: "translateX(-50%)"
            },
            "bottom-center": {
                bottom: `${oy}px`, left: "50%", top: "auto", right: "auto", transform: "translateX(-50%)"
            },
            "center": {
                top: "50%", left: "50%", right: "auto", bottom: "auto", transform: "translate(-50%, -50%)"
            }
        };

        const style = positionStyles[pos] || positionStyles["top-right"];
        Object.assign(element.style, style);

        this.applyEntryAnimation(element, pos);
    },

    applyEntryAnimation(element: HTMLDivElement, position: string) {
        const fromRight = ["top-right", "bottom-right"].includes(position);
        const fromLeft = ["top-left", "bottom-left"].includes(position);
        const fromBottom = ["bottom-center", "bottom-left", "bottom-right"].includes(position);
        const fromTop = ["top-center", "top-left", "top-right"].includes(position);

        let translateFrom = "";
        if (fromRight) translateFrom = "translateX(100px)";
        else if (fromLeft) translateFrom = "translateX(-100px)";
        else translateFrom = "translateY(-20px)";

        if (fromBottom) translateFrom += " translateY(20px)";
        else if (fromTop) translateFrom += " translateY(-20px)";

        const animName = `ssa-slidein-${position.replace(/[^a-z]/g, "")}`;

        if (!document.getElementById(`ssa-keyframe-${animName}`)) {
            const style = document.createElement("style");
            style.id = `ssa-keyframe-${animName}`;
            style.textContent = `
                @keyframes ${animName} {
                    from { opacity: 0; transform: ${translateFrom} scale(0.9); }
                    to   { opacity: 1; transform: translate(0, 0) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }

        element.style.animation = `${animName} 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`;
    },

    /* -------------------------------------------------------------- */
    /*  Drag & drop (with proper cleanup)                              */
    /* -------------------------------------------------------------- */

    setupDrag(element: HTMLDivElement, id: string): () => void {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let elemStartX = 0;
        let elemStartY = 0;
        const self = this;

        const content = element.querySelector(
            "[class*='ssa-content']"
        ) as HTMLDivElement;
        if (!content) return () => {};

        function onMouseDown(e: MouseEvent) {
            if (!self.settings.store.enableDragAndDrop) return;
            if ((e.target as HTMLElement).closest(".ssa-close-btn")) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            elemStartX = element.offsetLeft;
            elemStartY = element.offsetTop;

            content.style.cursor = "grabbing";
            content.style.opacity = "0.85";
            content.style.transition = "none";
            e.preventDefault();
        }

        function onMouseMove(e: MouseEvent) {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            let nx = elemStartX + dx;
            let ny = elemStartY + dy;
            nx = Math.max(0, Math.min(nx, window.innerWidth - element.offsetWidth));
            ny = Math.max(0, Math.min(ny, window.innerHeight - element.offsetHeight));
            element.style.position = "fixed";
            element.style.left = `${nx}px`;
            element.style.top = `${ny}px`;
            element.style.right = "auto";
            element.style.bottom = "auto";
            element.style.transform = "none";
            element.style.animation = "none";
        }

        function onMouseUp() {
            if (!isDragging) return;
            isDragging = false;
            content.style.cursor = "grab";
            content.style.opacity = "1";
            self.customPosition.x = element.offsetLeft;
            self.customPosition.y = element.offsetTop;
        }

        content.addEventListener("mousedown", onMouseDown);
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);

        return () => {
            content.removeEventListener("mousedown", onMouseDown);
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };
    },

    /* -------------------------------------------------------------- */
    /*  Notification cleanup                                           */
    /* -------------------------------------------------------------- */

    animateOutAndRemove(id: string) {
        const entry = this.activeNotifications.get(id);
        if (!entry) return;
        this.destroyNotification(entry);
        this.activeNotifications.delete(id);
    },

    destroyNotification(entry: NotificationEntry) {
        const { element, timeoutId, dragCleanup } = entry;

        if (timeoutId) clearTimeout(timeoutId);

        if (dragCleanup) {
            try {
                dragCleanup();
            } catch (e) { /* ignore */ }
        }

        try {
            element.style.animation =
                "ssa-slideout 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards";
            element.style.pointerEvents = "none";
            const removeTimer = setTimeout(() => {
                if (element.parentNode) element.remove();
            }, 300);
            (element as any).__ssaRemoveTimer = removeTimer;
        } catch (e) {
            if (element.parentNode) element.remove();
        }
    },

    clearAllNotifications() {
        for (const [, entry] of this.activeNotifications) {
            this.destroyNotification(entry);
        }
        this.activeNotifications.clear();
    },

    /* -------------------------------------------------------------- */
    /*  Global styles                                                  */
    /* -------------------------------------------------------------- */

    injectGlobalStyles() {
        if (document.getElementById("screenshare-alert-global-styles")) return;

        const style = document.createElement("style");
        style.id = "screenshare-alert-global-styles";
        style.textContent = `
            @keyframes ssa-slideout {
                from { opacity: 1; transform: translate(0, 0) scale(1); }
                to   { opacity: 0; transform: translate(0, -20px) scale(0.9); }
            }
            .screenshare-alert-notification {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
                pointer-events: auto;
            }
            .screenshare-alert-notification:hover .ssa-drag-hint {
                opacity: 1 !important;
            }
            .screenshare-alert-notification:hover [class*="ssa-content"] {
                filter: brightness(1.1);
            }
        `;
        document.head.appendChild(style);
    },

    /* -------------------------------------------------------------- */
    /*  Utilities                                                      */
    /* -------------------------------------------------------------- */

    buildAvatarUrl(user: User): string {
        if (!user.avatar) return "";
        const ext = user.avatar.startsWith("a_") ? "gif" : "png";
        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
    },

    escapeHtml(str: string): string {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    },

    log(...args: any[]) {
        console.log("[ScreenShareAlert]", ...args);
    },

    debug(...args: any[]) {
        if (this.settings.store.debugMode) {
            console.debug("[ScreenShareAlert]", ...args);
        }
    },

    /* -------------------------------------------------------------- */
    /*  Settings panel                                                 */
    /* -------------------------------------------------------------- */

    getSettingsPanel() {
        return (
            <div style={{
                padding: "20px",
                background: "linear-gradient(135deg, rgba(88, 101, 242, 0.1) 0%, rgba(114, 137, 218, 0.1) 100%)",
                borderRadius: "10px",
                marginTop: "20px",
                border: "1px solid rgba(88, 101, 242, 0.2)",
                color: "white",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif"
            }}>
                <div style={{ marginBottom: "20px" }}>
                    <h2 style={{ color: "#5865F2", marginBottom: "10px", fontSize: "18px", fontWeight: "700", textAlign: "center" }}>
                        ScreenShareAlert
                    </h2>
                    <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "15px", borderRadius: "8px", borderLeft: "3px solid #5865F2", textAlign: "center" }}>
                        <p style={{ margin: "5px 0", color: "rgba(255, 255, 255, 0.7)", fontSize: "13px" }}>
                            Detecta screen share, cameras e possiveis gravacoes externas durante calls do Discord.
                            Alertas visuais e sonoros para voce saber quando algo acontece.
                        </p>
                    </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                    <h3 style={{ color: "#5865F2", marginBottom: "10px", fontSize: "16px", fontWeight: "600" }}>
                        Camadas de Deteccao
                    </h3>
                    <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "12px", borderRadius: "8px", fontSize: "12px", lineHeight: "1.6" }}>
                        <p style={{ margin: "4px 0", color: "#4CAF50" }}>
                            L1: VoiceStateStore do Discord - deteccao confiavel de screen share e camera
                        </p>
                        <p style={{ margin: "4px 0", color: "#FFC107" }}>
                            L2: Monitoramento WebRTC - anomalias em conexoes peer
                        </p>
                        <p style={{ margin: "4px 0", color: "#FFC107" }}>
                            L3: Interceptacao de getDisplayMedia / getUserMedia - captura local
                        </p>
                        <p style={{ margin: "4px 0", color: "#FF9800" }}>
                            L4: Indicadores visuais na UI do Discord - recording, clip
                        </p>
                        <p style={{ margin: "4px 0", color: "rgba(255,255,255,0.5)" }}>
                            Nota: Softwares externos (OBS, Streamlabs) rodando em outra maquina
                            nao podem ser detectados diretamente pelo navegador. As heuristicas buscam sinais
                            indiretos de atividade suspeita.
                        </p>
                    </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                    <h3 style={{ color: "#5865F2", marginBottom: "10px", fontSize: "16px", fontWeight: "600" }}>
                        Desenvolvedor
                    </h3>
                    <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "12px", borderRadius: "8px", borderLeft: "3px solid #5865F2" }}>
                        <p style={{ margin: "5px 0", color: "white", fontSize: "14px" }}>
                            <strong>GitHub:</strong>{" "}
                            <a href="https://github.com/arrependimentosconstantes" target="_blank" rel="noopener noreferrer"
                                style={{ color: "#5865F2", textDecoration: "none" }}>
                                @arrependimentosconstantes
                            </a>
                        </p>
                        <p style={{ margin: "5px 0", color: "white", fontSize: "14px" }}>
                            <strong>Discord:</strong>{" "}
                            <span style={{ color: "#5865F2", fontFamily: "monospace" }}>arrependimentosconstantes</span>
                        </p>
                    </div>
                </div>

                <div>
                    <h3 style={{ color: "#5865F2", marginBottom: "10px", fontSize: "16px", fontWeight: "600" }}>
                        Cores das Notificacoes
                    </h3>
                    <p style={{ color: "rgba(255, 255, 255, 0.7)", fontSize: "12px", marginBottom: "15px" }}>
                        Configure os gradientes nas opcoes acima. Cores padrao:
                    </p>
                    <div style={{ background: "rgba(0,0,0,0.2)", padding: "15px", borderRadius: "8px", borderLeft: "3px solid #FF5C5C", marginBottom: "10px" }}>
                        <p style={{ color: "#FF5C5C", fontWeight: "600", margin: 0 }}>Screen Share</p>
                        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", margin: "4px 0 0" }}>#FF5C5C a #FF3B3B</p>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.2)", padding: "15px", borderRadius: "8px", borderLeft: "3px solid #5C9EFF", marginBottom: "10px" }}>
                        <p style={{ color: "#5C9EFF", fontWeight: "600", margin: 0 }}>Camera</p>
                        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", margin: "4px 0 0" }}>#5C9EFF a #3B7FFF</p>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.2)", padding: "15px", borderRadius: "8px", borderLeft: "3px solid #FF1744", marginBottom: "10px" }}>
                        <p style={{ color: "#FF1744", fontWeight: "600", margin: 0 }}>Gravacao</p>
                        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", margin: "4px 0 0" }}>#FF1744 a #D50000</p>
                    </div>
                </div>

                <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid rgba(88, 101, 242, 0.2)" }}>
                    <p style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "12px" }}>
                        Dica: Ative o Debug Mode nas configuracoes e abra o Console (F12) para ver logs detalhados de deteccao.
                    </p>
                </div>
            </div>
        );
    }
});
