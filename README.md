Extension-ScreenShareAlert

ScreenShare Alert é um plugin para o Vencord que detecta automaticamente atividades em chamadas de voz do Discord em tempo real.

Ele identifica quando alguém inicia Screen Share, ativa a webcam ou quando há possível gravação externa, exibindo notificações modernas, leves e totalmente personalizáveis.

✨ Funcionalidades
🖥️ Detecção automática de Screen Share
📹 Detecção de webcam/vídeo em tempo real
🔴 Sistema experimental de detecção de gravação externa
📞 Ativo apenas durante chamadas de voz
🚫 Opção para ignorar seu próprio Screen Share
🎨 Totalmente personalizável (cores, tamanhos e posição)
📍 Sistema de posicionamento livre na tela
✋ Drag & Drop para mover notificações
⚡ Animações rápidas e leves
🧠 Anti-spam inteligente
🖼️ Exibe avatar e nome do usuário
🌈 Gradientes dinâmicos por tipo de alerta
🎨 Personalização

Você pode configurar diretamente nas opções do plugin:

Cores dos alertas (Screen Share, Webcam, Gravação)
Tamanho da notificação
Largura e altura
Distância das bordas
Posição na tela
Movimentação livre (Drag & Drop)
Estilo visual com gradientes
📥 Instalação
1. Pré-requisitos

Instale as ferramentas abaixo:

Git → https://git-scm.com/
Node.js (LTS) → https://nodejs.org/

Depois instale o pnpm:

npm install -g pnpm
2. Clonar o Vencord
cd Documents
git clone https://github.com/Vendicated/Vencord.git
cd Vencord
3. Instalar dependências
pnpm install --frozen-lockfile
4. Instalar o plugin

Crie a pasta:

src/plugins/ScreenShareAlert

Coloque o arquivo:

index.tsx

Caminho final:

Vencord/src/plugins/ScreenShareAlert/index.tsx
5. Compilar

Para Discord Desktop:

pnpm build

Para Web:

pnpm buildWeb
6. Reiniciar o Discord

Feche e abra o Discord novamente.

7. Ativar o plugin

Vá em:

Configurações do Vencord > Plugins

Procure:

ScreenShareAlert

Ative o plugin ✅

🚀 Objetivo

O objetivo do ScreenShare Alert é oferecer uma forma moderna e eficiente de monitorar atividades em chamadas de voz, trazendo alertas instantâneos sem interferir na experiência do usuário.

👨‍💻 Autor

Kenji da federal

GitHub: https://github.com/arrependimentosconstantes
Discord: arrependimentosconstantes
