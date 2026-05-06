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
- knowledge organizado en fichas Markdown e índices visuales;
- skills específicas para clave dicotómica y tratamientos orientativos;
- workspace OpenClaw/AgroClaw versionado como plantilla reproducible.

La demo no pretende demostrar cobertura total del dominio agrario. Su objetivo es demostrar que el patrón funciona y que puede escalar si se alimenta con conocimiento real de campo.

## Arquitectura local de la demo

En local, la demo requiere tres procesos principales y un workspace de conocimiento:

```text
Frontend Vite/React
        ↓
Puente HTTP local Express
        ↓
OpenClaw / AgroClaw
        ↓
Workspace AgroClaw
  ├── identidad, tono y agentes
  ├── skills
  └── knowledge olivar
```

Procesos:

```text
Vite frontend        → http://localhost:5173
Puente HTTP Express  → http://localhost:3000
OpenClaw Gateway     → ejecución local/interna
```

## Estructura del proyecto

```text
agroclaw-demo/
├── public/
├── server/
│   ├── server.js
│   └── workspace-template/
│       ├── AGENTS.md
│       ├── BOOTSTRAP.md
│       ├── HEARTBEAT.md
│       ├── IDENTITY.md
│       ├── SOUL.md
│       ├── TOOLS.md
│       ├── USER.md
│       ├── skills/
│       └── knowledge/
│           └── olivar/
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

## Workspace OpenClaw / AgroClaw

El proyecto incluye una plantilla portable del workspace de AgroClaw en:

```text
server/workspace-template/
```

Esta plantilla representa el árbol funcional de OpenClaw/AgroClaw necesario para la demo:

```text
server/workspace-template/
├── AGENTS.md
├── BOOTSTRAP.md
├── HEARTBEAT.md
├── IDENTITY.md
├── SOUL.md
├── TOOLS.md
├── USER.md
├── skills/
│   ├── agroclaw_clave_dicotomica_olivo/
│   │   └── SKILL.md
│   └── agroclaw_tratamientos_olivo/
│       └── SKILL.md
└── knowledge/
    └── olivar/
        ├── clave_dicotomica_olivar.md
        ├── principales_plagas_enfermedades_olivo.md
        ├── regadio_olivar_agroclaw.md
        ├── tratamientos_olivar.md
        └── images/
            ├── algodoncillo/
            ├── antracnosis/
            ├── barrenillo/
            ├── euzophera/
            ├── mosca/
            ├── otiorrinco/
            ├── prays/
            ├── repilo/
            ├── saissetia/
            ├── tuberculosis/
            ├── verticilosis/
            └── xylella/
```

El workspace real de OpenClaw vive normalmente fuera del repositorio, por ejemplo en:

```text
~/.openclaw/workspace/
```

La plantilla del repositorio no debe confundirse con el estado privado/runtime de OpenClaw. La carpeta versionada contiene identidad, skills y conocimiento reutilizable; no debe contener credenciales, tokens, `.env`, logs privados ni estado interno de ejecución.

## Relación entre workspace real y plantilla versionada

El árbol real generado del workspace local de OpenClaw incluye elementos runtime como:

```text
.openclaw/workspace-state.json
state/
tools/
```

Esos elementos pueden ser útiles para inspección local o desarrollo, pero no forman parte de la plantilla pública/reproducible de AgroClaw.

La parte versionable es:

```text
AGENTS.md
BOOTSTRAP.md
HEARTBEAT.md
IDENTITY.md
SOUL.md
TOOLS.md
USER.md
skills/
knowledge/
```

Esta separación permite reconstruir el conocimiento y personalidad de AgroClaw sin subir configuración privada.

## Preparar el workspace local desde la plantilla

Si se desea reconstruir el workspace local de AgroClaw a partir del repositorio:

```bash
cd ~/Escritorio/agroclaw-demo
mkdir -p "$HOME/.openclaw/workspace"
rsync -a server/workspace-template/ "$HOME/.openclaw/workspace/"
```

Después puede comprobarse el contenido:

```bash
find "$HOME/.openclaw/workspace" -maxdepth 3 -type f | sort
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

levanta un pequeño servidor Express que recibe las consultas del frontend y las envía al agente `main` de OpenClaw.

En la demo local, el backend actúa como puente controlado entre la interfaz web y OpenClaw/AgroClaw. La frontend no habla directamente con credenciales ni con servicios internos sensibles.

## Seguridad y credenciales

La frontend **no contiene credenciales de OpenAI**.

El archivo `.env.local` no debe subirse al repositorio. Solo debe versionarse `.env.example`.

Variables esperadas en frontend:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_AGROCLAW_ENDPOINT=/api/agroclaw/chat
```

La autenticación real se gestiona fuera de la frontend, mediante OpenClaw y su configuración local.

No subir nunca al repositorio:

```text
.env.local
OPENAI_API_KEY
tokens
credenciales
workspace privado completo
.openclaw/workspace-state.json
state/
logs privados
configuración privada
```

Antes de hacer commit, revisar:

```bash
git status --short
grep -RniI -E "OPENAI|API_KEY|SECRET|TOKEN|PASSWORD|sk-|PRIVATE KEY|Bearer|CREDENTIAL" server/workspace-template
grep -RniI -E "/home/|/Users/|C:\\|D:\\|Z:\\|rsantosq|rsant" server/workspace-template
```

## Arranque en local

### 1. Preparar el workspace

```bash
cd ~/Escritorio/agroclaw-demo
mkdir -p "$HOME/.openclaw/workspace"
rsync -a server/workspace-template/ "$HOME/.openclaw/workspace/"
```

### 2. OpenClaw

Arrancar OpenClaw según la instalación local disponible.

### 3. Puente HTTP

En otra terminal:

```bash
cd ~/Escritorio/agroclaw-demo
node server/server.js
```

### 4. Frontend Vite

En otra terminal:

```bash
cd ~/Escritorio/agroclaw-demo
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

En la instalación local actual, AgroClaw funciona mediante un modelo conectado a OpenClaw.

El objetivo para la demo final es utilizar la configuración más solvente disponible, manteniendo la prioridad en:

- precisión técnica;
- prudencia en diagnóstico;
- uso verificable de la base de conocimiento;
- seguridad de credenciales;
- estabilidad de la demo.

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

## Nota sobre imágenes y atribución

El workspace incluye referencias visuales acompañadas de fichas Markdown. Si el repositorio se mantiene público, conviene revisar que cada imagen tenga fuente/atribución adecuada y que su uso sea compatible con la finalidad de la demo.
