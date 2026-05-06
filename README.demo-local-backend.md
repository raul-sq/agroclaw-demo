# AgroClaw — demo-local-backend

> Rama recomendada para la demo local funcional de AgroClaw.

Esta rama contiene la versión de AgroClaw que funciona de forma controlada en local:

```text
Frontend Vite local
→ Backend Node/Express local
→ OpenClaw agent real
→ Workspace AgroClaw
→ Base de conocimiento de olivar
```

Esta rama **no representa todavía la arquitectura pública definitiva** sobre Netlify + Coolify + VPS. Su objetivo es ofrecer una demo reproducible, estable y segura en local.

---

## Estado de la rama

La rama objetivo es:

```text
demo-local-backend
```

Repositorio:

```text
https://github.com/raul-sq/agroclaw-demo/tree/demo-local-backend
```

Esta rama incluye:

- backend local Node/Express;
- compatibilidad del backend con `{ "message": "..." }` y `{ "prompt": "..." }`;
- plantilla portable de workspace OpenClaw/AgroClaw en `server/workspace-template/`;
- base de conocimiento de AgroClaw organizada en Markdown e imágenes;
- skills específicas de olivar.

El arreglo de compatibilidad evita el error:

```json
{ "error": "Missing prompt" }
```

cuando el frontend envía el campo `message`.

---

## Qué funciona

- Frontend Vite en local.
- Backend Node/Express en local.
- OpenClaw ejecutándose como agente real.
- Workspace AgroClaw reconstruible desde `server/workspace-template/`.
- Respuestas basadas en la base de conocimiento de AgroClaw.
- Referencias visuales `imagen + Markdown`.
- Sin respuestas preparadas.
- Sin caché como solución principal.
- Sin exponer credenciales.
- Demo funcional en `http://localhost:5173`.

---

## Puertos usados

```text
Frontend Vite:        http://localhost:5173
Backend Node/Express: http://localhost:3000
OpenClaw:             ejecución local/interna
```

El frontend debe llamar al backend mediante:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_AGROCLAW_ENDPOINT=/api/agroclaw/chat
```

---

## Workspace OpenClaw / AgroClaw

La rama incluye un workspace template en:

```text
server/workspace-template/
```

Este directorio es una versión portable del workspace AgroClaw. Contiene los elementos que definen la personalidad, herramientas, skills y conocimiento del agente:

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

El árbol local completo de OpenClaw puede incluir también elementos runtime como:

```text
.openclaw/workspace-state.json
state/
tools/
```

Esos elementos no deben tratarse como parte del template versionable salvo que haya una razón explícita. La rama debe contener la plantilla reproducible, no el estado privado de ejecución.

---

## Relación entre OpenClaw y AgroClaw

OpenClaw proporciona la estructura de agente y ejecución.

AgroClaw aporta el contenido específico:

```text
IDENTITY.md   → identidad del asistente AgTech
SOUL.md       → tono y carácter
AGENTS.md     → organización del agente
TOOLS.md      → herramientas declaradas
skills/       → capacidades específicas
knowledge/    → conocimiento del olivar
```

La separación es importante:

```text
OpenClaw = runtime / framework local
AgroClaw = workspace, personalidad, skills y conocimiento
```

Por eso la rama versiona `server/workspace-template/`: permite reconstruir AgroClaw sin subir credenciales ni estado privado.

---

## Preparar workspace local desde la plantilla

Para reconstruir el workspace local de OpenClaw/AgroClaw desde esta rama:

```bash
cd ~/Escritorio/agroclaw-demo
mkdir -p "$HOME/.openclaw/workspace"
rsync -a server/workspace-template/ "$HOME/.openclaw/workspace/"
```

Comprobación rápida:

```bash
find "$HOME/.openclaw/workspace" -maxdepth 3 -type f | sort
```

Comprobación específica de piezas clave:

```bash
test -f "$HOME/.openclaw/workspace/IDENTITY.md"
test -f "$HOME/.openclaw/workspace/AGENTS.md"
test -d "$HOME/.openclaw/workspace/knowledge/olivar"
test -d "$HOME/.openclaw/workspace/skills/agroclaw_clave_dicotomica_olivo"
```

---

## Archivo `.env.local`

Para ejecutar la demo local, debe existir un archivo `.env.local` en la raíz del repo con este contenido:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_AGROCLAW_ENDPOINT=/api/agroclaw/chat
```

Este archivo **no debe subirse al repositorio**.

Comprobación:

```bash
git status --short
```

Si aparece `.env.local`, no hacer commit todavía. Debe estar ignorado por Git.

---

## Arranque local

La demo local se arranca con dos terminales, después de haber preparado el workspace.

### Terminal 1 — backend Node/Express

```bash
cd ~/Escritorio/agroclaw-demo

ALLOWED_ORIGINS="http://localhost:5173,http://localhost:3000" \
PORT=3000 \
node server/server.js
```

Comprobación:

```bash
curl -i http://localhost:3000/health
```

Respuesta esperada:

```text
HTTP/1.1 200 OK
```

---

### Terminal 2 — frontend Vite

```bash
cd ~/Escritorio/agroclaw-demo
npm run dev
```

Abrir en navegador:

```text
http://localhost:5173
```

---

## Prueba rápida del backend

Con el backend levantado:

```bash
curl -s -X POST http://localhost:3000/api/agroclaw/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Responde únicamente: AgroClaw listo."}' | jq .
```

Respuesta esperada aproximada:

```json
{
  "answer": "AgroClaw listo.",
  "raw": "AgroClaw listo.\n"
}
```

---

## Latencia medida

Mediciones actuales realizadas en la demo local:

```text
Consultas manuales cortas: 40–45 s aproximadamente.
Consultas de tarjetas:     50–55 s aproximadamente.
```

La latencia no parece estar principalmente en Vite ni en Node/Express. El cuello de botella más probable está en:

```text
OpenClaw agent
+ modelo
+ preparación/uso de la base de conocimiento
+ generación de respuesta
```

Por tanto, la demo funciona, pero el siguiente trabajo técnico es optimizar la latencia.

---

## Arquitectura pública pendiente

Se ha probado la idea:

```text
Frontend Netlify
→ Backend Coolify en VPS
→ OpenClaw
```

pero todavía no está cerrada como arquitectura pública final.

Problemas pendientes detectados:

- Netlify puede dar problemas con peticiones largas si actúa como proxy.
- Coolify requiere ajuste fino del contenedor, workspace y ejecución de OpenClaw.
- La parte HTTPS/dominio complica la comunicación limpia entre frontend y backend.
- Exponer directamente servicios internos de OpenClaw no es deseable por seguridad.
- El puerto interno/gateway de OpenClaw no debe quedar expuesto públicamente.

La arquitectura pública debería evolucionar hacia:

```text
Frontend público
→ Backend API controlado
→ OpenClaw interno
→ Workspace AgroClaw montado como recurso controlado
```

---

## Seguridad

No subir nunca al repositorio:

```text
.env.local
OPENAI_API_KEY
tokens
credenciales de OpenClaw
workspace privado completo
.openclaw/workspace-state.json
state/
logs privados
configuración privada
```

Antes de hacer commit:

```bash
git status --short
```

Asegurarse de que no aparece:

```text
.env.local
```

Antes de subir cambios en `server/workspace-template/`, revisar secretos y rutas personales:

```bash
grep -RniI -E "OPENAI|API_KEY|SECRET|TOKEN|PASSWORD|sk-|PRIVATE KEY|Bearer|CREDENTIAL" server/workspace-template
grep -RniI -E "/home/|/Users/|C:\\|D:\\|Z:\\|rsantosq|rsant" server/workspace-template
```

Si se crea una copia de seguridad temporal, no subirla:

```text
server/workspace-template.bak/
```

---

## Comprobar el árbol del workspace

Para generar una vista del workspace local:

```bash
tree "$HOME/.openclaw/workspace"
```

Si `tree` no está disponible:

```bash
find "$HOME/.openclaw/workspace" -print | sort
```

El árbol real puede mostrar elementos runtime que no deben versionarse. La plantilla de Git debe limitarse a los elementos reproducibles de AgroClaw.

---

## Cómo integrar este MD en la rama

Guardar este archivo en la raíz del repo con el nombre:

```text
README.demo-local-backend.md
```

Después:

```bash
cd ~/Escritorio/agroclaw-demo
git checkout demo-local-backend
git status --short
```

Si todo está correcto:

```bash
git add README.demo-local-backend.md README.md
git commit -m "docs: document AgroClaw workspace template"
git push origin demo-local-backend
```

Comprobar:

```bash
git log --oneline --decorate -3
```

Debería aparecer el nuevo commit en:

```text
HEAD -> demo-local-backend, origin/demo-local-backend
```

---

## Nota para Saturdays.AI

Esta rama debe entenderse como la **demo local funcional** de AgroClaw con workspace reproducible.

No es todavía la versión final de despliegue público. La prioridad posterior será:

1. Reducir latencia.
2. Comparar modelos/configuraciones.
3. Mejorar experiencia de usuario durante la espera.
4. Mantener `server/workspace-template/` como fuente portable del conocimiento AgroClaw.
5. Retomar con calma la arquitectura pública VPS/Coolify.
