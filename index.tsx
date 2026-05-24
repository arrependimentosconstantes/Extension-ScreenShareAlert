/*
 * Vencord ScreenShare Alert Plugin
 * Avisa quando alguém inicia screen share
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";

const settings = definePluginSettings({
    enableNotification: {
        type: OptionType.BOOLEAN,
        description: "Mostrar notificação quando alguém iniciar screen share",
        default: true
    },
    ignoreOwnShare: {
        type: OptionType.BOOLEAN,
        description: "Ignorar quando você está compartilhando",
        default: true
    },
    detectVideo: {
        type: OptionType.BOOLEAN,
        description: "Detectar também câmeras (não só tela)",
        default: true
    },
    detectRecording: {
        type: OptionType.BOOLEAN,
        description: "Detectar gravações externas",
        default: true
    },
    enableDragAndDrop: {
        type: OptionType.BOOLEAN,
        description: "Ativar arrastar e soltar para mover a notificação",
        default: true
    },
    position: {
        type: OptionType.SELECT,
        description: "Posição da notificação",
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
        description: "Altura da notificação (px)",
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
    screenShareColor: {
        type: OptionType.STRING,
        description: "Cor do gradiente Screen Share (esquerda) - Formato: #RRGGBB",
        default: "#FF5C5C"
    },
    screenShareColorEnd: {
        type: OptionType.STRING,
        description: "Cor do gradiente Screen Share (direita) - Formato: #RRGGBB",
        default: "#FF3B3B"
    },
    videoColor: {
        type: OptionType.STRING,
        description: "Cor do gradiente Vídeo (esquerda) - Formato: #RRGGBB",
        default: "#5C9EFF"
    },
    videoColorEnd: {
        type: OptionType.STRING,
        description: "Cor do gradiente Vídeo (direita) - Formato: #RRGGBB",
        default: "#3B7FFF"
    },
    recordingColor: {
        type: OptionType.STRING,
        description: "Cor do gradiente Gravação (esquerda) - Formato: #RRGGBB",
        default: "#FF1744"
    },
    recordingColorEnd: {
        type: OptionType.STRING,
        description: "Cor do gradiente Gravação (direita) - Formato: #RRGGBB",
        default: "#D50000"
    }
});

// Buscar módulos do Discord
const SelectedChannelStore = findByPropsLazy("getChannel", "getSelectedChannelId");
const VoiceStateStore = findByPropsLazy("getVoiceStateForUser", "getVoiceStates");

export default definePlugin({
    name: "ScreenShareAlert",
    description: "Avisa quando alguém inicia screen share ou gravação externa",
    tags: ["Screen", "Alert", "Recording", "Utility"],
    authors: [Devs.Neon],
    settings,

    start() {
        this.activeStreams = new Set();
        this.notificationTimeout = null;
        this.isUserSharing = false;
        this.isUserRecording = false;
        this.isInCall = false;
        this.customPosition = {
            x: null,
            y: null
        };
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.mouseDownListeners = null;
        this.mouseMoveListeners = null;
        this.mouseUpListeners = null;
        
        console.log("[ScreenShareAlert] ✅ Plugin iniciado");
        
        // Verificar status de call a cada 2 segundos
        this.callCheckInterval = setInterval(() => {
            this.checkCallStatus();
        }, 2000);
        
        // Detectar screen share a cada 1.5 segundos
        this.interval = setInterval(() => {
            if (this.isInCall) {
                this.detectScreenShare();
                this.detectExternalRecordings();
            }
        }, 1500);
    },

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        if (this.callCheckInterval) {
            clearInterval(this.callCheckInterval);
        }
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
        }
        this.removeIndicator();
    },

    // Verificar se está em uma call
    checkCallStatus() {
        try {
            // Verificar se tem elementos de call ativa
            const voiceElements = document.querySelectorAll('[class*="voiceConnected"]');
            const callContainer = document.querySelector('[class*="callContainer"]');
            const videoGrid = document.querySelector('[class*="videoGrid"]');
            
            const wasInCall = this.isInCall;
            this.isInCall = voiceElements.length > 0 || !!callContainer || !!videoGrid;
            
            if (this.isInCall && !wasInCall) {
                console.log("[ScreenShareAlert] 📞 Você entrou em uma call!");
            } else if (!this.isInCall && wasInCall) {
                console.log("[ScreenShareAlert] 📞 Você saiu da call!");
                this.activeStreams.clear();
            }
        } catch (e) {
            console.debug("[ScreenShareAlert] Erro ao verificar status da call:", e);
        }
    },

    // Detectar se VOCÊ está compartilhando a tela
    isYouSharing(): boolean {
        try {
            const shareButtons = document.querySelectorAll('button[aria-label*="Share"], button[aria-label*="share"], [class*="screenShare"][class*="active"]');
            
            if (shareButtons.length > 0) {
                for (const btn of shareButtons) {
                    const classes = btn.className;
                    if (classes.includes("active") || classes.includes("enabled")) {
                        return true;
                    }
                }
            }
            
            const activeIndicator = document.querySelector('[class*="screenShare"][class*="active"], [aria-label="Stop sharing"]');
            if (activeIndicator) {
                return true;
            }
            
            const callTitle = document.querySelector('[class*="title"]');
            if (callTitle?.textContent?.includes("Sharing your screen")) {
                return true;
            }
            
        } catch (e) {
            console.debug("[ScreenShareAlert] Erro ao verificar se está compartilhando:", e);
        }
        
        return false;
    },

    // Detectar gravações externas (OBS, Streamlabs, etc)
    detectExternalRecordings(): boolean {
        if (!this.settings.store.detectRecording) {
            return false;
        }

        try {
            // Procurar por indicadores de gravação no navegador
            const recordingIndicators = document.querySelectorAll(
                '[aria-label*="recording"], ' +
                '[aria-label*="Record"], ' +
                '[class*="recording"], ' +
                '[class*="recording-indicator"], ' +
                '[title*="recording"], ' +
                '[data-testid*="recording"]'
            );

            if (recordingIndicators.length > 0) {
                for (const indicator of recordingIndicators) {
                    const text = indicator.textContent?.toLowerCase() || "";
                    const ariaLabel = indicator.getAttribute("aria-label")?.toLowerCase() || "";
                    const className = indicator.className.toLowerCase();
                    
                    if (
                        text.includes("record") ||
                        ariaLabel.includes("record") ||
                        className.includes("recording")
                    ) {
                        console.debug("[ScreenShareAlert] 🔴 Indicador de gravação detectado");
                        return true;
                    }
                }
            }

            // Verificar por pontos vermelhos ou ícones de gravação
            const recordingDots = document.querySelectorAll('[class*="dot"][class*="record"], [class*="indicator"][class*="red"]');
            if (recordingDots.length > 0) {
                for (const dot of recordingDots) {
                    const color = window.getComputedStyle(dot).backgroundColor;
                    if (color.includes("rgb(255") || color.includes("rgb(200")) {
                        console.debug("[ScreenShareAlert] 🔴 Ponto de gravação detectado");
                        return true;
                    }
                }
            }

            // Procurar por áudio de gravação ou vídeos adicionais
            const allVideos = document.querySelectorAll('video');
            const allAudios = document.querySelectorAll('audio');
            
            console.debug("[ScreenShareAlert] Vídeos detectados:", allVideos.length, "| Áudios:", allAudios.length);

            // Se tem mais de 2 vídeos, pode ser gravação externa
            if (allVideos.length > 2) {
                console.debug("[ScreenShareAlert] 🔴 Múltiplos vídeos detectados - possível gravação");
            }

            // Verificar por janelas de gravação do OBS ou Streamlabs
            const obsPatterns = document.querySelectorAll(
                '[class*="obs"], ' +
                '[class*="streamlabs"], ' +
                '[class*="xsplit"], ' +
                '[class*="elgato"], ' +
                '[window*="obs"], ' +
                '[title*="OBS"], ' +
                '[title*="Streamlabs"]'
            );

            if (obsPatterns.length > 0) {
                console.log("[ScreenShareAlert] 🎥 Possível software de gravação detectado");
                return true;
            }

        } catch (e) {
            console.debug("[ScreenShareAlert] Erro ao detectar gravações externas:", e);
        }

        return false;
    },

    // Verificar se a notificação é sobre gravação
    isRecordingNotification(): boolean {
        try {
            const hasRecordingAPI = (navigator as any).mediaDevices?.getDisplayMedia;
            if (!hasRecordingAPI) {
                return false;
            }

            // Verificar por elementos indicadores de gravação na call
            const recordingElements = document.querySelectorAll(
                '[aria-label*="recording"], [class*="recording"], [data-testid*="recording"]'
            );

            if (recordingElements.length > 0) {
                for (const el of recordingElements) {
                    const isVisible = window.getComputedStyle(el).display !== "none";
                    if (isVisible) {
                        return true;
                    }
                }
            }
        } catch (e) {
            console.debug("[ScreenShareAlert] Erro ao verificar notificação de gravação:", e);
        }

        return false;
    },

    detectScreenShare() {
        // Verificar status de compartilhamento do usuário
        this.isUserSharing = this.isYouSharing();
        console.debug("[ScreenShareAlert] Você está compartilhando?", this.isUserSharing);
        
        // Buscar TODOS os vídeos na página
        const videos = document.querySelectorAll('video');
        console.debug("[ScreenShareAlert] Total de vídeos encontrados:", videos.length);
        
        if (videos.length === 0) {
            return;
        }
        
        videos.forEach((video, index) => {
            const width = (video as HTMLVideoElement).offsetWidth;
            const height = (video as HTMLVideoElement).offsetHeight;
            const isVisible = window.getComputedStyle(video).display !== "none";
            
            console.debug(`[ScreenShareAlert] Vídeo ${index}: ${width}x${height}, visível: ${isVisible}`);
            
            // Ignorar vídeos muito pequenos ou invisíveis
            if (width < 50 || height < 50 || !isVisible) {
                return;
            }
            
            // Detectar se é screen share ou câmera
            const isScreenShare = 
                width > 500 || 
                height > 400 ||
                (width > 300 && height > 300) ||
                width > height * 1.3;
            
            const isWebcam = width < 400 && height < 250;
            
            console.debug(`[ScreenShareAlert] Vídeo ${index} - Screen Share: ${isScreenShare}, Webcam: ${isWebcam}`);
            
            if (isScreenShare) {
                this.processStream(video, "screen", index);
            } else if (isWebcam && this.settings.store.detectVideo) {
                this.processStream(video, "video", index);
            }
        });
    },

    processStream(video: Element, type: "screen" | "video", index: number) {
        try {
            const width = (video as HTMLVideoElement).offsetWidth;
            const height = (video as HTMLVideoElement).offsetHeight;
            
            // Procurar o container do usuário
            let container: Element | null = null;
            let current = video.parentElement;
            
            for (let i = 0; i < 15; i++) {
                if (!current) break;
                
                const className = current.className;
                if (className && (
                    className.includes("participant") ||
                    className.includes("member") ||
                    className.includes("user") ||
                    className.includes("voice") ||
                    className.includes("layer")
                )) {
                    container = current;
                    break;
                }
                
                current = current.parentElement;
            }
            
            // Extrair nome do usuário
            let username = "";
            
            if (container) {
                const nameEl = container.querySelector('[class*="name"]');
                if (nameEl?.textContent) {
                    username = nameEl.textContent.trim();
                }
                
                if (!username) {
                    const dataEl = container.querySelector('[data-testid*="user"], [data-testid*="member"]');
                    if (dataEl?.textContent) {
                        username = dataEl.textContent.trim().split('\n')[0];
                    }
                }
                
                if (!username) {
                    const ariaEl = container.querySelector('[aria-label]');
                    if (ariaEl?.getAttribute('aria-label')) {
                        username = ariaEl.getAttribute('aria-label') || "";
                    }
                }
            }
            
            // Fallback
            if (!username) {
                username = `Usuário ${index}`;
            }
            
            console.log(`[ScreenShareAlert] 📺 ${type === "screen" ? "Screen Share" : "Vídeo"} detectado: ${username}`);
            
            const streamId = `${type}-${username}`;
            
            if (!this.activeStreams.has(streamId)) {
                this.activeStreams.add(streamId);
                
                const avatarUrl = this.getUserAvatar(container);
                this.onStreamDetected(username, avatarUrl, type);
            }
        } catch (e) {
            console.error("[ScreenShareAlert] Erro ao processar stream:", e);
        }
    },

    getUserAvatar(container: Element | null): string {
        try {
            if (!container) return "";
            
            const img = container.querySelector('img');
            if (img) {
                const src = (img as HTMLImageElement).src;
                if (src && src.includes("http")) {
                    return src;
                }
            }
        } catch (e) {
            console.debug("[ScreenShareAlert] Erro ao buscar avatar:", e);
        }
        
        return "";
    },

    onStreamDetected(username: string, avatarUrl: string, type: "screen" | "video") {
        // Verificar se deve ignorar próprio compartilhamento
        if (this.settings.store.ignoreOwnShare && this.isUserSharing) {
            console.log("[ScreenShareAlert] ⏭️ Ignorando - você está compartilhando");
            return;
        }
        
        const typeStr = type === "video" ? "📹 Vídeo" : "🖥️ Screen Share";
        console.log(`[ScreenShareAlert] 🚨 ALERTA: ${typeStr} de ${username}!`);
        
        if (this.settings.store.enableNotification) {
            this.showNotification(username, avatarUrl, type);
        }
        
        // Limpar após 30 segundos
        setTimeout(() => {
            const streamId = `${type}-${username}`;
            this.activeStreams.delete(streamId);
            console.debug("[ScreenShareAlert] Stream removido do cache:", streamId);
        }, 30000);
    },

    showNotification(username: string, avatarUrl: string, type: "screen" | "video", isRecording: boolean = false) {
        try {
            this.showCustomNotification(username, avatarUrl, type, isRecording);
        } catch (e) {
            console.error("[ScreenShareAlert] Erro ao mostrar notificação:", e);
        }
    },

    showCustomNotification(username: string, avatarUrl: string, type: "screen" | "video", isRecording: boolean = false) {
        try {
            // Remover notificação anterior
            const existingEl = document.getElementById("screenshare-alert-indicator");
            if (existingEl) {
                existingEl.remove();
            }
            
            if (this.notificationTimeout) {
                clearTimeout(this.notificationTimeout);
            }
            
            const notification = document.createElement("div");
            notification.id = "screenshare-alert-indicator";
            
            // Cores personalizáveis
            const colors = {
                screen: {
                    bg: `linear-gradient(135deg, ${this.settings.store.screenShareColor} 0%, ${this.settings.store.screenShareColorEnd} 100%)`
                },
                video: {
                    bg: `linear-gradient(135deg, ${this.settings.store.videoColor} 0%, ${this.settings.store.videoColorEnd} 100%)`
                },
                recording: {
                    bg: `linear-gradient(135deg, ${this.settings.store.recordingColor} 0%, ${this.settings.store.recordingColorEnd} 100%)`
                }
            };
            
            // Selecionar cor apropriada
            let colorScheme;
            if (isRecording) {
                colorScheme = colors.recording;
            } else {
                colorScheme = type === "screen" ? colors.screen : colors.video;
            }
            
            const icon = isRecording ? "🔴" : (type === "video" ? "📹" : "🖥️");
            const typeLabel = isRecording ? "Gravação Detectada" : (type === "screen" ? "Screen Share" : "Vídeo");
            
            // Avatar com melhor design
            let avatarHtml = "";
            if (avatarUrl && avatarUrl.length > 0) {
                avatarHtml = `
                    <div style="
                        width: 48px;
                        height: 48px;
                        border-radius: 10px;
                        overflow: hidden;
                        border: 2px solid rgba(255, 255, 255, 0.9);
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                        flex-shrink: 0;
                    ">
                        <img src="${avatarUrl}" alt="${username}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                `;
            } else {
                const initial = username.charAt(0).toUpperCase();
                avatarHtml = `
                    <div style="
                        width: 48px;
                        height: 48px;
                        border-radius: 10px;
                        background: linear-gradient(135deg, #7289DA 0%, #5865F2 100%);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 20px;
                        font-weight: 700;
                        border: 2px solid rgba(255, 255, 255, 0.9);
                        color: white;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                        flex-shrink: 0;
                    ">
                        ${initial}
                    </div>
                `;
            }
            
            const dragHint = this.settings.store.enableDragAndDrop ? `
                <div class="screenshare-drag-hint" style="
                    position: absolute;
                    top: -28px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.8);
                    font-weight: 500;
                    opacity: 0;
                    transition: opacity 0.2s;
                    pointer-events: none;
                    white-space: nowrap;
                    background: rgba(0, 0, 0, 0.5);
                    padding: 4px 8px;
                    border-radius: 6px;
                ">
                    ✋ Arraste para mover
                </div>
            ` : "";
            
            // Efeito pulsante para gravações
            const recordingAnimation = isRecording ? `
                <style>
                    @keyframes recordingPulse {
                        0%, 100% {
                            box-shadow: 0 12px 32px rgba(255, 23, 68, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
                        }
                        50% {
                            box-shadow: 0 12px 32px rgba(255, 23, 68, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.15);
                        }
                    }
                    #screenshare-alert-indicator .screenshare-content {
                        animation: recordingPulse 1.5s infinite;
                    }
                </style>
            ` : "";
            
            notification.innerHTML = `
                ${recordingAnimation}
                <div class="screenshare-content" style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    background: ${colorScheme.bg};
                    border-radius: 12px;
                    box-shadow: 
                        0 12px 32px rgba(0, 0, 0, 0.3),
                        0 0 0 1px rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    width: ${this.settings.store.notificationWidth}px;
                    min-height: ${this.settings.store.notificationHeight}px;
                    box-sizing: border-box;
                    position: relative;
                    cursor: ${this.settings.store.enableDragAndDrop ? "grab" : "default"};
                    transition: box-shadow 0.2s;
                    user-select: none;
                ">
                    ${dragHint}
                    ${avatarHtml}
                    <div style="
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                        color: white;
                        flex: 1;
                        min-width: 0;
                        justify-content: center;
                    ">
                        <div style="
                            font-size: 10px;
                            font-weight: 600;
                            letter-spacing: 0.5px;
                            opacity: 0.95;
                            text-transform: uppercase;
                            display: flex;
                            align-items: center;
                            gap: 4px;
                        ">
                            <span>${icon}</span>
                            <span>${typeLabel}</span>
                        </div>
                        <div style="
                            font-size: 13px;
                            font-weight: 700;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            letter-spacing: 0.3px;
                        ">
                            ${username}
                        </div>
                    </div>
                </div>
            `;
            
            // Posições configuráveis
            const positionConfig = this.getPositionStyle();
            
            notification.style.cssText = `
                position: fixed;
                ${this.customPosition.x !== null && this.customPosition.y !== null 
                    ? `left: ${this.customPosition.x}px; top: ${this.customPosition.y}px; right: auto; bottom: auto;` 
                    : positionConfig
                }
                z-index: 999999;
                animation: screenshareSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                pointer-events: auto;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            `;
            
            // Estilos e animações
            if (!document.getElementById("screenshare-alert-styles")) {
                const style = document.createElement("style");
                style.id = "screenshare-alert-styles";
                style.textContent = `
                    @keyframes screenshareSlideIn {
                        from {
                            opacity: 0;
                            transform: translateX(450px) translateY(-20px);
                        }
                        to {
                            opacity: 1;
                            transform: translateX(0) translateY(0);
                        }
                    }
                    @keyframes screenshareSlideOut {
                        from {
                            opacity: 1;
                            transform: translateX(0) translateY(0);
                        }
                        to {
                            opacity: 0;
                            transform: translateX(450px) translateY(-20px);
                        }
                    }
                    #screenshare-alert-indicator:hover .screenshare-content {
                        filter: brightness(1.1);
                        box-shadow: 0 14px 36px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.15) !important;
                    }
                    #screenshare-alert-indicator:hover .screenshare-drag-hint {
                        opacity: 1 !important;
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Adicionar ao DOM
            document.body.appendChild(notification);
            console.log("[ScreenShareAlert] ✅ Notificação exibida na tela!");
            
            // Eventos de mouse para arrastar
            if (this.settings.store.enableDragAndDrop) {
                this.setupDragListeners(notification);
            }
            
            // Auto-remover após 5 segundos
            this.notificationTimeout = setTimeout(() => {
                const el = document.getElementById("screenshare-alert-indicator");
                if (el) {
                    el.style.animation = "screenshareSlideOut 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards";
                    setTimeout(() => {
                        if (el && el.parentNode) {
                            el.remove();
                        }
                    }, 350);
                }
            }, 5000);
        } catch (e) {
            console.error("[ScreenShareAlert] Erro crítico ao criar notificação:", e);
        }
    },

    setupDragListeners(element: HTMLElement) {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let elementStartX = 0;
        let elementStartY = 0;
        
        const content = element.querySelector(".screenshare-content") as HTMLElement;
        if (!content) return;
        
        const onMouseDown = (e: MouseEvent) => {
            if (!this.settings.store.enableDragAndDrop) return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            elementStartX = element.offsetLeft;
            elementStartY = element.offsetTop;
            
            content.style.cursor = "grabbing";
            content.style.opacity = "0.9";
            
            console.log("[ScreenShareAlert] 🖱️ Iniciando arrasto...");
            
            e.preventDefault();
        };
        
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            let newX = elementStartX + deltaX;
            let newY = elementStartY + deltaY;
            
            // Limitar dentro da viewport
            const maxX = window.innerWidth - element.offsetWidth;
            const maxY = window.innerHeight - element.offsetHeight;
            
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));
            
            element.style.position = "fixed";
            element.style.left = newX + "px";
            element.style.top = newY + "px";
            element.style.right = "auto";
            element.style.bottom = "auto";
            element.style.animation = "none";
        };
        
        const onMouseUp = () => {
            if (!isDragging) return;
            
            isDragging = false;
            content.style.cursor = "grab";
            content.style.opacity = "1";
            
            // Salvar posição customizada
            this.customPosition.x = element.offsetLeft;
            this.customPosition.y = element.offsetTop;
            
            console.log(`[ScreenShareAlert] ✅ Nova posição: X=${this.customPosition.x}px, Y=${this.customPosition.y}px`);
        };
        
        content.addEventListener("mousedown", onMouseDown);
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    },

    getPositionStyle(): string {
        const position = this.settings.store.position || "top-right";
        const offsetX = this.settings.store.offsetX || 20;
        const offsetY = this.settings.store.offsetY || 20;
        
        const positionMap: { [key: string]: string } = {
            "top-right": `top: ${offsetY}px; right: ${offsetX}px; left: auto; bottom: auto;`,
            "top-left": `top: ${offsetY}px; left: ${offsetX}px; right: auto; bottom: auto;`,
            "bottom-right": `bottom: ${offsetY}px; right: ${offsetX}px; top: auto; left: auto;`,
            "bottom-left": `bottom: ${offsetY}px; left: ${offsetX}px; top: auto; right: auto;`,
            "top-center": `top: ${offsetY}px; left: 50%; transform: translateX(-50%); right: auto; bottom: auto;`,
            "bottom-center": `bottom: ${offsetY}px; left: 50%; transform: translateX(-50%); top: auto; right: auto;`,
            "center": `top: 50%; left: 50%; transform: translate(-50%, -50%); right: auto; bottom: auto;`
        };
        
        return positionMap[position] || positionMap["top-right"];
    },

    removeIndicator() {
        const el = document.getElementById("screenshare-alert-indicator");
        if (el && el.parentNode) {
            el.remove();
        }
    },

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.cssText = `
            padding: 20px;
            background: linear-gradient(135deg, rgba(88, 101, 242, 0.1) 0%, rgba(114, 137, 218, 0.1) 100%);
            border-radius: 10px;
            margin-top: 20px;
            border: 1px solid rgba(88, 101, 242, 0.2);
        `;
        
        panel.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3 style="color: #5865F2; margin-bottom: 10px; font-size: 16px; font-weight: 600;">👨‍💻 Criador do Plugin</h3>
                <div style="background: rgba(0, 0, 0, 0.2); padding: 12px; border-radius: 8px; border-left: 3px solid #5865F2;">
                    <p style="margin: 5px 0; color: white; font-size: 14px;">
                        <strong>GitHub:</strong> 
                        <a href="https://github.com/arrependimentosconstantes" target="_blank" style="color: #5865F2; text-decoration: none; cursor: pointer;">
                            @arrependimentosconstantes
                        </a>
                    </p>
                    <p style="margin: 5px 0; color: white; font-size: 14px;">
                        <strong>Discord:</strong> 
                        <span style="color: #5865F2; font-family: monospace;">arrependimentosconstantes</span>
                    </p>
                </div>
            </div>
            
            <div>
                <h3 style="color: #5865F2; margin-bottom: 10px; font-size: 16px; font-weight: 600;">🎨 Personalizações de Cores</h3>
                <p style="color: rgba(255, 255, 255, 0.7); font-size: 12px; margin-bottom: 15px;">
                    Ajuste as cores dos gradientes das notificações abaixo (formato: #RRGGBB)
                </p>
                
                <div style="background: rgba(0, 0, 0, 0.2); padding: 15px; border-radius: 8px; border-left: 3px solid #FF5C5C;">
                    <p style="color: #FF5C5C; font-weight: 600; margin-bottom: 8px;">🖥️ Screen Share</p>
                    <p style="color: rgba(255, 255, 255, 0.6); font-size: 12px; margin: 5px 0;">Configure as cores do gradiente (esquerda para direita)</p>
                </div>
                
                <div style="background: rgba(0, 0, 0, 0.2); padding: 15px; border-radius: 8px; border-left: 3px solid #5C9EFF; margin-top: 10px;">
                    <p style="color: #5C9EFF; font-weight: 600; margin-bottom: 8px;">📹 Vídeo</p>
                    <p style="color: rgba(255, 255, 255, 0.6); font-size: 12px; margin: 5px 0;">Configure as cores do gradiente (esquerda para direita)</p>
                </div>
                
                <div style="background: rgba(0, 0, 0, 0.2); padding: 15px; border-radius: 8px; border-left: 3px solid #FF1744; margin-top: 10px;">
                    <p style="color: #FF1744; font-weight: 600; margin-bottom: 8px;">🔴 Gravação</p>
                    <p style="color: rgba(255, 255, 255, 0.6); font-size: 12px; margin: 5px 0;">Configure as cores do gradiente (esquerda para direita)</p>
                </div>
            </div>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(88, 101, 242, 0.2);">
                <p style="color: rgba(255, 255, 255, 0.6); font-size: 12px;">
                    💡 <strong>Dica:</strong> Use hex colors como #FF5C5C, #5865F2, etc. para personalizar totalmente a aparência!
                </p>
            </div>
        `;
        
        return panel;
    }
});
