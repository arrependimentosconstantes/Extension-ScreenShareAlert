Extension-ScreenShareAlert

ScreenShare Alert é um plugin moderno para Vencord desenvolvido para monitorar atividades em chamadas de voz do Discord em tempo real.

O plugin detecta automaticamente quando alguém inicia um compartilhamento de tela, ativa a webcam ou quando uma possível gravação externa é identificada durante a call, exibindo notificações modernas, rápidas e totalmente personalizáveis na tela.

Projetado com foco em desempenho, praticidade e visual moderno, o ScreenShare Alert oferece uma experiência limpa, intuitiva e leve, sem atrapalhar sua conversa ou consumir recursos desnecessários.

✨ Recursos
🖥️ Detecção automática de Screen Share
📹 Detecção de webcam e transmissões de vídeo
🔴 Sistema experimental de detecção de gravações externas
📞 Funciona apenas enquanto você estiver em uma call
🚫 Opção para ignorar seu próprio compartilhamento
🎨 Personalização completa das notificações
🌈 Gradientes únicos para cada tipo de alerta
📍 Escolha da posição da notificação na tela
✋ Sistema Drag & Drop para mover os alertas livremente
⚡ Notificações rápidas, leves e animadas
🧠 Sistema anti-spam inteligente
🖼️ Exibição do avatar e nome do usuário detectado
🛠️ Interface moderna e fácil de configurar
🎨 Personalização

O plugin permite alterar completamente a aparência dos alertas diretamente nas configurações do plugin.

Você pode personalizar:

Cor dos alertas de Screen Share
Cor dos alertas de Webcam
Cor dos alertas de Gravação
Gradientes personalizados
Tamanho da notificação
Altura e largura
Distância das bordas
Posição na tela
Movimentação livre via arrastar e soltar

Tudo isso em tempo real e sem precisar reiniciar o Discord.

📥 Tutorial Completo de Instalação
1. Instale o Git

Caso ainda não tenha o Git instalado:

Git Oficial

Baixe e instale normalmente.

2. Instale o Node.js

Baixe a versão LTS:

Node.js Oficial

3. Instale o PNPM

Abra o CMD e execute:

npm install -g pnpm
📦 Baixando o Vencord
4. Abra o CMD

Pressione:

Win + R

Digite:

cmd

e pressione ENTER.

5. Vá até a pasta Documents
cd Documents
6. Clone o repositório do Vencord
git clone https://github.com/Vendicated/Vencord
7. Entre na pasta do Vencord
cd Vencord
8. Instale as dependências
pnpm install --frozen-lockfile
📁 Instalando o Plugin
9. Entre na pasta de plugins

Abra:

src/plugins
10. Crie uma pasta chamada:
ScreenShareAlert
11. Coloque o arquivo index.tsx

O caminho final deve ficar assim:

Vencord/src/plugins/ScreenShareAlert/index.tsx
⚙️ Compilando
12. Compile o Vencord
Para Discord Desktop:
pnpm build
Para Navegador Web:
pnpm buildWeb
🔄 Reinicie o Discord

Após compilar:

Feche completamente o Discord
Abra novamente
✅ Ativando o Plugin

Abra:

Configurações do Vencord > Plugins

Pesquise por:

Screen

Ative o plugin e pronto ✅

🚀 Objetivo

O objetivo do ScreenShare Alert é fornecer um sistema visual moderno, rápido e eficiente para alertar atividades importantes dentro da call em tempo real.

O plugin foi criado para melhorar a experiência do usuário durante chamadas de voz, oferecendo monitoramento automático e notificações elegantes sem precisar ficar observando manualmente a interface do Discord.

👨‍💻 Desenvolvedor

Criado por: Kenji da federal

GitHub

GitHub do Desenvolvedor

Discord
arrependimentosconstantes
