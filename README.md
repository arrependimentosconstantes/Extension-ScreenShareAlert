# Extension-ScreenShareAlert

ScreenShare Alert é um plugin para o Vencord desenvolvido para monitorar em tempo real atividades dentro de chamadas de voz do Discord. Ele detecta automaticamente quando alguém inicia compartilhamento de tela, ativa a câmera ou quando há possíveis sinais de gravação externa, exibindo notificações visuais modernas e totalmente personalizáveis.

O plugin foi criado com foco em desempenho, leveza e uma interface limpa, funcionando apenas enquanto você está em uma call ativa.

---

# 📌 Sobre o plugin

O **ScreenShare Alert** analisa elementos da interface do Discord em tempo real para identificar mudanças de estado nos participantes da call. Quando detecta uma atividade, ele exibe um alerta na tela com o nome, avatar e tipo de evento (Screen Share, vídeo ou gravação).

---

## ✨ Recursos

* 🖥️ Detecta automaticamente Screen Share
* 📹 Detecta câmeras (webcam)
* 🔴 Detecta possíveis gravações externas (experimental)
* 📞 Funciona somente durante chamadas de voz ativas
* 🚫 Opção para ignorar seu próprio compartilhamento
* 🎨 Sistema de cores totalmente personalizável
* 📍 Escolha da posição da notificação na tela
* ✋ Sistema de arrastar e soltar (Drag & Drop)
* ⚡ Notificações leves, rápidas e animadas
* 🧠 Sistema anti-spam para evitar notificações repetidas
* 🖼️ Exibe nome e avatar do usuário detectado
* 🌈 Gradientes personalizados para cada tipo de alerta

---

## 🎨 Personalização

Você pode configurar completamente o visual do plugin:

* Cor do alerta de Screen Share (início e fim do gradiente)
* Cor do alerta de Vídeo (início e fim do gradiente)
* Cor do alerta de Gravação (início e fim do gradiente)
* Tamanho da notificação (largura e altura)
* Distância das bordas da tela (offset X e Y)
* Posição da notificação (cantos ou centro da tela)
* Ativar ou desativar arrastar e soltar

Tudo isso pode ser ajustado diretamente nas configurações do Vencord.

---

## 📥 Instalação COMPLETA (Passo a passo detalhado)

### 🔧 1. Abrir a pasta do Vencord

Abra o Explorador de Arquivos e vá até:

```txt id="p1v8aa"
C:\Users\SEU_USUARIO\Documents\Vencord
```

---

### 📁 2. Criar a estrutura do plugin

Dentro da pasta:

```
Vencord/src/plugins/
```

crie uma nova pasta chamada:

```txt id="p2v8bb"
ScreenShareAlert
```

---

### 📄 3. Adicionar o arquivo do plugin

Coloque o arquivo:

```txt id="p3v8cc"
index.tsx
```

dentro da pasta:

```
Vencord/src/plugins/ScreenShareAlert/
```

---

### 💻 4. Instalar o Vencord via Git (se ainda não tiver)

Abra o CMD ou PowerShell e execute:

```bash id="p4v8dd"
# Navegue até a pasta Documents
cd Documents

# Clone o repositório do Vencord
git clone https://github.com/Vendicated/Vencord

# Entre na pasta criada
cd Vencord

# Instale as dependências
pnpm install --frozen-lockfile
```

---

### ⚙️ 5. Compilar o Vencord

Agora compile o projeto:

```bash id="p5v8ee"
# Para Discord Desktop
pnpm build
```

ou

```bash id="p6v8ff"
# Para versão Web
pnpm buildWeb
```

---

### 🚀 6. Abrir o CMD corretamente (alternativo)

Se preferir, vá até:

```
Documentos > Vencord
```

Clique na barra de endereço, digite:

```txt id="p7v8gg"
cmd
```

e pressione ENTER.

Depois execute:

```bash id="p8v8hh"
pnpm build
```

---

### 🔄 7. Reiniciar o Discord

Feche completamente o Discord e abra novamente.

---

### 🔌 8. Ativar o plugin

No Discord:

```
Configurações > Vencord > Plugins
```

Pesquise por:

```
Screen
```

Ative o **ScreenShareAlert**.

---

## 🚀 Objetivo

O objetivo do ScreenShare Alert é fornecer alertas visuais rápidos e claros para qualquer atividade importante dentro da sua call, como compartilhamento de tela, câmera ou gravação, garantindo que você esteja sempre informado em tempo real sem precisar verificar manualmente.

---

## 👨‍💻 Desenvolvedor

**Criado por:** Kenjidafereral

### 🔗 GitHub

https://github.com/arrependimentosconstantes

### 💬 Discord

arrependimentosconstantes
