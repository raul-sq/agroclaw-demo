import type { DemoPrompt } from "../types/agroclaw";

export const demoPrompts: DemoPrompt[] = [
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
