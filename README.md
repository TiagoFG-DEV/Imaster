<div align="center">

# IMaster

**Motor de RPG narrativo e procedural com inteligência artificial.**

[![Version](https://img.shields.io/badge/version-1.0.0-gold.svg?style=for-the-badge)](https://github.com/TiagoFG-DEV/Imaster)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-Backend-black?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Three.js](https://img.shields.io/badge/Three.js-3D%20Dice-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Groq AI](https://img.shields.io/badge/Groq%20AI-LPU%20Engine-f55036?style=for-the-badge)](https://groq.com/)

<p align="center">
  <em>Uma experiência imersiva de RPG de mesa guiada por IA, cartas arcanas, física de dados 3D e combate tático.</em>
</p>

---

</div>

## ✦ Visão Geral

O **IMaster** é um motor narrativo completo para sessões de RPG de investigação e mistério sobrenatural. Ele combina a criatividade de Modelos de Linguagem (LLMs via Groq) com mecânicas rígidas de ficha, turnos de combate, inventário tático e rolagens em tempo real.

> [!NOTE]
> O projeto foi desenvolvido com inspiração em sistemas de investigação de horror contemporâneo e no universo de *Ordem Paranormal*.

---

## ⸸ Funcionalidades Principais

| Recurso | Descrição |
| :--- | :--- |
| **Narrador IA Autônomo** | Respostas adaptativas, descrições vívidas e gerenciamento de consequências em tempo real. |
| **Baralho de Ações Táticas** | Interface dockada com cartas interativas para combate, investigação, itens e manobras. |
| **Rolagem 3D & Física Real** | Dados com simulação física via Three.js, detecção de sucessos, desastres e críticos. |
| **Arena de Iniciativa** | Sistema dinâmico de 2d20 com desempate suave para agentes e ameaças. |
| **Solo & Multiplayer Local** | Alterne entre dossiês de múltiplos agentes com controle de turnos individual. |
| **Hub de Criação Integrado** | Criação rápida de agentes, distribuição de atributos, trilhas, rituais e importação de documentos de missão. |

---

## 🚀 Como Executar

### 1. Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- Chave de API da [Groq Cloud](https://console.groq.com/)

### 2. Instalação

```bash
# Clone o repositório
git clone https://github.com/TiagoFG-DEV/Imaster.git

# Acesse a pasta do projeto
cd Imaster

# Instale as dependências
npm install
```

### 3. Configuração de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
GROQ_API_KEY=sua_chave_groq_aqui
PORT=3000
```

### 4. Iniciar o Servidor

```bash
npm start
```

Abra no navegador: `http://localhost:3000`

---

## 📁 Estrutura do Projeto

```text
IMaster/
├── engine/              # Motores narrativo, de regras e orquestração de IA
│   ├── aiOrchestrator.js
│   ├── gameEngine.js
│   └── sessionManager.js
├── library_of_rules/    # Tabelas, arquétipos, itens e codex de regras
├── public/              # Interface Web imersiva
│   ├── css/             # Design system e estilização
│   ├── js/              # Controladores de UI, 3D e websocket/SSE
│   └── *.html           # Telas de início, criação, loading e chat
├── routes.js            # Endpoints da API REST e Server-Sent Events
└── app.js               # Ponto de entrada do servidor Express
```

---

## 📜 Licença

Distribuído sob a licença ISC. Consulte `LICENSE` para mais informações.

<div align="center">
  <sub>Desenvolvido para entusiastas de RPG de mesa e investigação sobrenatural.</sub>
</div>
