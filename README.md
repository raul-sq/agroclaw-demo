# AgroClaw Demo

Frontend de demostración para **AgroClaw**, un asistente AgTech en español construido sobre OpenClaw, con foco inicial en olivar.

Esta demo está diseñada para presentar AgroClaw como una **memoria técnica visual-documental asistida por IA**, no como un chatbot agrícola genérico.

## Objetivo de la demo

La demo muestra un flujo controlado basado en un tarjetero de prompts. Cada tarjeta lanza una consulta preparada contra AgroClaw para demostrar:

- recuperación de conocimiento documentado;
- uso de referencias visuales `imagen + Markdown`;
- diagnóstico orientativo prudente;
- comparación entre problemas confundibles;
- uso de índices visuales;
- valor potencial para cooperativas agrícolas y equipos técnicos.

## Alcance actual

La base de conocimiento actual está deliberadamente acotada:

- cultivo principal: olivar;
- referencias visuales documentadas;
- plagas y enfermedades seleccionadas;
- knowledge organizado en fichas Markdown e índices visuales.

La demo no pretende demostrar cobertura total del dominio agrario. Su objetivo es demostrar que el patrón funciona y que puede escalar si se alimenta con conocimiento real de campo.

## Arquitectura local de la demo

En local, la demo requiere tres procesos:

```text
Frontend Vite/React
        ↓
Puente HTTP local Express
        ↓
OpenClaw Gateway / AgroClaw
```

Procesos:

```text
Vite frontend        → http://localhost:5173
Puente HTTP Express  → http://localhost:3000
OpenClaw Gateway     → http://localhost:18789
```

## Estructura del proyecto

```text
agroclaw-demo/
├── public/
├── server/
│   └── server.js
├── src/
│   ├── api/
│   ├── assets/
│   ├── components/
│   ├── data/
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── .env.example
├── package.json
└── vite.config.ts
```

## Frontend

El frontend está construido con:

- React
- TypeScript
- Vite

Incluye:

- cabecera de demo;
- tarjetero de prompts;
- panel de respuesta;
- consulta libre acotada;
- renderizado Markdown de las respuestas.

## Backend puente local

El archivo:

```text
server/server.js
```

levanta un pequeño servidor Express que recibe las consultas de la frontend y las envía al agente `main` de OpenClaw mediante CLI:

```bash
openclaw agent --agent main --message "..."
```

Este puente es local y sirve para la demo en desarrollo.

## Seguridad y credenciales

La frontend **no contiene credenciales de OpenAI**.

El archivo `.env.local` no debe subirse al repositorio. Solo debe versionarse `.env.example`.

Variables esperadas en frontend:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_AGROCLAW_ENDPOINT=/api/agroclaw/chat
```

La autenticación real se gestiona fuera de la frontend, mediante OpenClaw y su configuración local.

## Arranque en local

### 1. OpenClaw Gateway

En una terminal:

```bash
openclaw gateway --force
```

### 2. Puente HTTP

En otra terminal:

```bash
cd /home/rsantosq/Escritorio/agroclaw-demo
node server/server.js
```

### 3. Frontend Vite

En otra terminal:

```bash
cd /home/rsantosq/Escritorio/agroclaw-demo
npm run dev
```

Abrir:

```text
http://localhost:5173/
```

## Build

```bash
npm run build
```

La salida se genera en:

```text
dist/
```

## Deployment en Netlify

Netlify puede desplegar la frontend estática.

Configuración recomendada:

```text
Build command: npm run build
Publish directory: dist
```

Importante: el deployment en Netlify solo publica la frontend. Para que la demo funcione públicamente, el puente HTTP/OpenClaw debe estar disponible como backend accesible y seguro.

## Modelo actual y objetivo

En la instalación local actual, AgroClaw funciona mediante:

```text
openai-codex/gpt-5.4
```

El objetivo para la demo final es usar GPT-5.5 cuando esté disponible en OpenClaw o mediante credenciales corporativas de Saturdays.AI.

## Posicionamiento

AgroClaw no sustituye al técnico agrícola.

Su valor está en actuar como:

```text
memoria técnica visual-documental asistida por IA
```

Puede ayudar a:

- organizar conocimiento de campo;
- recuperar casos y referencias;
- apoyar diagnóstico orientativo;
- formar a agricultores y técnicos;
- conservar experiencia acumulada;
- mejorar la conversación técnica dentro de una cooperativa.
