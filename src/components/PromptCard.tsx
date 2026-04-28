import type { DemoPrompt } from "../types/agroclaw";

type PromptCardProps = {
  prompt: DemoPrompt;
  isActive: boolean;
  isLoading: boolean;
  onRun: (prompt: DemoPrompt) => void;
};

export function PromptCard({
  prompt,
  isActive,
  isLoading,
  onRun,
}: PromptCardProps) {
  return (
    <article className={`prompt-card ${isActive ? "prompt-card--active" : ""}`}>
      <div>
        <h3>{prompt.title}</h3>
        <p>{prompt.goal}</p>
      </div>

      <button
        type="button"
        className="button button--primary"
        onClick={() => onRun(prompt)}
        disabled={isLoading}
      >
        {isLoading && isActive ? "Consultando..." : "Ejecutar"}
      </button>
    </article>
  );
}
