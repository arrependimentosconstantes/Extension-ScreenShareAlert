# ScreenShare Alert — Vencord Plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vencord](https://img.shields.io/badge/Vencord-Plugin-5865F2)](https://github.com/Vendicated/Vencord)

Plugin de privacidade para Vencord que detecta quando alguém inicia screen share, liga a câmera ou possivelmente grava a call sem consentimento.

**Propósito:** alertar você quando outro participante da call inicia atividades que podem indicar gravação externa — screen share, ativação de câmera ou captura de tela/áudio.

---

## Funcionalidades

### Detecção (4 camadas)

| Camada | Tipo | Confiabilidade |
|--------|------|---------------|
| L1 | VoiceStateStore do Discord — screen share e câmera | Alta |
| L2 | Monitoramento WebRTC — anomalias em conexões peer | Média |
| L3 | Interceptação de `getDisplayMedia` / `getUserMedia` — captura local | Média |
| L4 | Indicadores visuais na UI do Discord — recording, clip | Heurística |

> **Limitação:** Softwares externos (OBS, Streamlabs) rodando em outra máquina não são detectáveis via navegador. As camadas L2-L4 usam sinais indiretos.

### Notificações

- **Screen Share** — gradiente vermelho, com avatar e nome
- **Câmera** — gradiente azul, com avatar e nome
- **Gravação Detectada** — gradiente vermelho escuro com efeito pulsante
- **Alerta sonoro** opcional (beep via Web Audio API)
- **7 posições** configuráveis + **drag & drop** livre
- **Largura/altura** ajustáveis
- **Duração** configurável (3-15 segundos)
- **Stack** de notificações (até 5 simultâneas)

### Configurações

| Setting | Descrição | Padrão |
|---------|-----------|--------|
| Notificação visual | Overlay de notificação | Ligado |
| Som de alerta | Beep ao detectar atividade | Ligado |
| Duração | Tempo na tela | 5s |
| Máx. notificações | Simultâneas | 3 |
| Ignorar próprio share | Não alerta quando você compartilha | Ligado |
| Detectar screen share | Screen share de outros | Ligado |
| Detectar câmera | Câmera de outros | Ligado |
| Detectar gravações | Heurísticas de gravação | Ligado |
| Detectar captura local | getDisplayMedia/getUserMedia | Ligado |
| Posição | 7 posições + drag & drop | Top-Right |
| Cores | Gradientes por tipo de alerta | — |
| Debug mode | Logs no F12 | Desligado |

---

## Instalação

### 1. Localize a pasta do Vencord

```
Vencord\src\plugins\
```

### 2. Crie a pasta do plugin

Crie `ScreenShareAlert` dentro de `plugins\`.

### 3. Copie o arquivo

Copie `index.tsx` para `Vencord\src\plugins\ScreenShareAlert\`.

```
Vencord\src\plugins\ScreenShareAlert\index.tsx
```

### 4. Compile

```bash
pnpm build
```

### 5. Reinicie o Discord completamente

### 6. Ative

Configurações do Vencord → Plugins → "ScreenShareAlert" → Ativar

---

## Desenvolvedor

- **GitHub:** [@arrependimentosconstantes](https://github.com/arrependimentosconstantes)
- **Discord:** arrependimentosconstantes

---

## Licença

MIT — veja [LICENSE](LICENSE).
