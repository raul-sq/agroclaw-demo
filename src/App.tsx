import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type DemoPrompt = {
  id: string;
  title: string;
  goal: string;
  prompt: string;
};

type BackendStatus = "checking" | "ready" | "error";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "";

const AGROCLAW_ENDPOINT =
  import.meta.env.VITE_AGROCLAW_ENDPOINT ?? "/api/agroclaw/chat";

const demoPrompts: DemoPrompt[] = [
  {
    id: "inventario-algodoncillo",
    title: "Inventario visual documentado",
    goal: "Demuestra que AgroClaw recupera su base visual documentada.",
    prompt: `¿Qué referencias visuales tienes actualmente sobre algodoncillo del olivo en tu base de conocimiento?

Indica para cada una:
- nombre del archivo MD;
- imagen asociada;
- ruta local;
- qué muestra;
- valor diagnóstico orientativo.

Responde solo con información documentada en tu knowledge.`,
  },
  {
    id: "diagnostico-algodoncillo",
    title: "Diagnóstico orientativo de campo",
    goal: "Simula una consulta real de agricultor.",
    prompt: `Un agricultor observa en olivo masas blancas algodonosas sobre brotes tiernos e inflorescencias.

Usa tu base visual documentada para responder:
- qué diagnóstico orientativo sugiere;
- qué referencias visuales se parecen más;
- qué síntomas apoyan esa hipótesis;
- con qué podría confundirse;
- qué información adicional pedirías antes de recomendar tratamiento.

No propongas tratamiento todavía.`,
  },
  {
    id: "comparacion-xylella-verticilosis",
    title: "Comparación prudente",
    goal: "Muestra razonamiento técnico y límites diagnósticos.",
    prompt: `Compara visualmente verticilosis y Xylella en olivo usando las referencias documentadas disponibles en tu knowledge.

Indica:
- síntomas visuales que pueden parecerse;
- diferencias orientativas;
- límites de una comparación basada solo en imagen;
- qué datos adicionales serían necesarios para elevar la confianza diagnóstica.`,
  },
  {
    id: "indice-visual-algodoncillo",
    title: "Uso del índice visual",
    goal: "Demuestra que AgroClaw usa índices internos de conocimiento.",
    prompt: `Usa el índice visual diagnóstico del algodoncillo del olivo para explicar cómo están organizadas las referencias visuales de esa carpeta.

Distingue:
- referencias útiles para diagnóstico rápido en campo;
- referencias útiles para confirmar visualmente el insecto;
- referencias con posible melaza o negrilla asociada;
- límites de uso del índice.

No inventes referencias nuevas.`,
  },
  {
    id: "valor-cooperativa",
    title: "Valor para cooperativa agrícola",
    goal: "Cierra la demo con visión de producto.",
    prompt: `Explica cómo podría usar una cooperativa agrícola AgroClaw como memoria técnica visual-documental.

Enfoca la respuesta en:
- agricultores;
- técnicos agrícolas;
- formación interna;
- conservación de conocimiento de campo;
- comparación de casos;
- límites profesionales: AgroClaw no sustituye al técnico.

No lo vendas como un chatbot genérico, sino como una infraestructura de conocimiento agrario asistida por IA.`,
  },
];

function normalizeAnswer(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    const possibleAnswer =
      obj.answer ??
      obj.response ??
      obj.message ??
      obj.output ??
      obj.output_text ??
      obj.text;

    if (typeof possibleAnswer === "string") {
      return possibleAnswer;
    }
  }

  return JSON.stringify(data, null, 2);
}

async function checkAgroClawHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function askAgroClaw(prompt: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}${AGROCLAW_ENDPOINT}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      mode: "demo",
      source: "agroclaw-demo-frontend",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Error del backend ${response.status}: ${errorText || response.statusText}`
    );
  }

  const data = await response.json();
  return normalizeAnswer(data);
}

function getBackendBadgeText(status: BackendStatus): string {
  if (status === "checking") {
    return "Comprobando backend AgroClaw";
  }

  if (status === "ready") {
    return "Backend listo · Codex GPT-5.4";
  }

  return "Backend no disponible";
}

function App() {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [lastPromptTitle, setLastPromptTitle] = useState("");
  const [freePrompt, setFreePrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [backendStatus, setBackendStatus] =
    useState<BackendStatus>("checking");

  const backendReady = backendStatus === "ready";

  useEffect(() => {
    let cancelled = false;

    async function warmBackend() {
      setBackendStatus("checking");

      const isReady = await checkAgroClawHealth();

      if (!cancelled) {
        setBackendStatus(isReady ? "ready" : "error");
      }
    }

    void warmBackend();

    return () => {
      cancelled = true;
    };
  }, []);

  async function retryBackendHealth() {
    setBackendStatus("checking");

    const isReady = await checkAgroClawHealth();

    setBackendStatus(isReady ? "ready" : "error");
  }

  async function runPrompt(prompt: string, title: string, id: string | null) {
    if (!backendReady) {
      setError(
        "El backend de AgroClaw todavía no está listo. Espera a que el indicador de cabecera muestre “Backend listo” o pulsa “Reintentar conexión”."
      );
      return;
    }

    setIsLoading(true);
    setError("");
    setAnswer("");
    setActivePromptId(id);
    setLastPromptTitle(title);

    try {
      const result = await askAgroClaw(prompt);
      setAnswer(result);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Error desconocido al consultar AgroClaw.";

      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function clearResponse() {
    setAnswer("");
    setError("");
    setActivePromptId(null);
    setLastPromptTitle("");
  }

  return (
    <main className="app-shell">
      <header className="header">
        <div>
          <p className="eyebrow">AgroClaw</p>
          <h1>Memoria técnica AgTech asistida por IA</h1>
          <p className="subtitle">
            Demo controlada para olivar: knowledge curado, referencias visuales
            documentadas y respuestas prudentes en lenguaje natural.
          </p>

          {backendStatus === "checking" && (
            <p className="backend-header-notice">
              La demo está comprobando el backend AgroClaw antes de habilitar las tarjetas.
            </p>
          )}

          {backendStatus === "error" && (
            <div className="backend-header-warning">
              <span>
                El backend no está disponible ahora mismo. Comprueba el backend Coolify/Hetzner o
                reintenta la conexión.
              </span>

              <button
                type="button"
                className="ghost"
                onClick={() => void retryBackendHealth()}
              >
                Reintentar conexión
              </button>
            </div>
          )}
        </div>

        <div className={`badge badge--${backendStatus}`}>
          <span className="badge-dot" />
          {getBackendBadgeText(backendStatus)}
        </div>
      </header>

      <section className="intro">
        <h2>Demo guiada</h2>
        <p>
          Esta interfaz no pretende demostrar que AgroClaw sabe todo sobre
          agricultura. Demuestra un patrón funcional: agente especializado,
          knowledge curado, referencias visuales documentadas y respuestas
          prudentes.
        </p>
      </section>

      <div className="layout">
        <section className="panel">
          <div className="panel-header">
            <h2>Tarjetero de prompts</h2>
            <p>Consultas preparadas para ejecutar AgroClaw en directo.</p>
          </div>

          <div className="prompt-grid">
            {demoPrompts.map((demoPrompt) => (
              <article
                key={demoPrompt.id}
                className={
                  activePromptId === demoPrompt.id
                    ? "prompt-card prompt-card-active"
                    : "prompt-card"
                }
              >
                <div>
                  <h3>{demoPrompt.title}</h3>
                  <p>{demoPrompt.goal}</p>

                  <blockquote className="prompt-quote">
                    “{demoPrompt.prompt}”
                  </blockquote>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void runPrompt(
                      demoPrompt.prompt,
                      demoPrompt.title,
                      demoPrompt.id
                    )
                  }
                  disabled={isLoading || !backendReady}
                  title={
                    backendReady
                      ? "Ejecutar prompt"
                      : "El backend todavía no está listo"
                  }
                >
                  {isLoading && activePromptId === demoPrompt.id
                    ? "Consultando..."
                    : backendReady
                      ? "Ejecutar"
                      : "Esperando backend"}
                </button>
              </article>
            ))}
          </div>

          <div className="free-box">
            <h2>Consulta libre acotada</h2>
            <p>
              Para la demo: olivar, síntomas visuales, plagas, enfermedades o
              valor cooperativo de AgroClaw.
            </p>

            <textarea
              value={freePrompt}
              onChange={(event) => setFreePrompt(event.target.value)}
              placeholder="Escribe una consulta libre..."
              rows={5}
            />

            <button
              type="button"
              className="secondary"
              disabled={isLoading || !backendReady || !freePrompt.trim()}
              title={
                backendReady
                  ? "Ejecutar consulta libre"
                  : "El backend todavía no está listo"
              }
              onClick={() =>
                void runPrompt(freePrompt.trim(), "Consulta libre", null)
              }
            >
              {backendReady ? "Ejecutar consulta libre" : "Esperando backend"}
            </button>
          </div>
        </section>

        <section className="panel response-panel">
          <div className="response-header">
            <div>
              <h2>Respuesta de AgroClaw</h2>
              <p>
                {lastPromptTitle
                  ? `Última consulta: ${lastPromptTitle}`
                  : "Selecciona una tarjeta para iniciar la demo."}
              </p>
            </div>

            <div className="actions">
              <button
                type="button"
                className="ghost"
                disabled={!answer}
                onClick={() => void navigator.clipboard.writeText(answer)}
              >
                Copiar
              </button>

              <button
                type="button"
                className="ghost"
                disabled={isLoading || (!answer && !error)}
                onClick={clearResponse}
              >
                Limpiar
              </button>
            </div>
          </div>

          <div className="response-box">
            {isLoading && (
              <p className="loading">AgroClaw está consultando...</p>
            )}

            {error && <pre className="error">{error}</pre>}

            {!isLoading && !error && answer && (
              <div className="markdown-answer">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {answer}
                </ReactMarkdown>
              </div>
            )}

            {!isLoading && !error && !answer && (
              <p className="placeholder">
                Aquí aparecerá la respuesta generada en directo.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
