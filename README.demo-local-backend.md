# AgroClaw — demo-local-backend

> Rama recomendada para la demo local funcional de AgroClaw.

Esta rama contiene la versión de AgroClaw que funciona de forma controlada en local:

```text
Frontend Vite local
→ Backend Node/Express local
→ OpenClaw agent real
→ Base de conocimiento de AgroClaw
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

Esta rama incluye el arreglo para que el backend acepte tanto:

```json
{ "message": "..." }
```

como:

```json
{ "prompt": "..." }
```

Esto evita el error:

```json
{ "error": "Missing prompt" }
```

cuando el frontend envía el campo `message`.

---

## Qué funciona

- Frontend Vite en local.
- Backend Node/Express en local.
- OpenClaw ejecutándose como agente real.
- Respuestas basadas en la base de conocimiento de AgroClaw.
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

La demo local se arranca con dos terminales.

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
```

---

## Seguridad

No subir nunca al repositorio:

```text
.env.local
OPENAI_API_KEY
tokens
credenciales de OpenClaw
workspace privado
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

---

## Cómo integrar este MD en la rama

Guardar este archivo en la raíz del repo con un nombre como:

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
git add README.demo-local-backend.md
git commit -m "docs(demo): add local backend branch documentation"
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

Esta rama debe entenderse como la **demo local funcional** de AgroClaw.

No es todavía la versión final de despliegue público. La prioridad posterior será:

1. Reducir latencia.
2. Comparar modelos/configuraciones.
3. Mejorar experiencia de usuario durante la espera.
4. Retomar con calma la arquitectura pública VPS/Coolify.
