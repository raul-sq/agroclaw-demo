import type { DemoPrompt } from "../types/agroclaw";
import { PromptCard } from "./PromptCard";

type PromptDeckProps = {
  prompts: DemoPrompt[];
  activePromptId: string | null;
  isLoading: boolean;
  onRun: (prompt: DemoPrompt) => void;
};

export function PromptDeck({
  prompts,
  activePromptId,
  isLoading,
  onRun,
}: PromptDeckProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Tarjetero de prompts</h2>
        <p>Consultas preparadas para demostrar AgroClaw en directo.</p>
      </div>

      <div className="prompt-grid">
        {prompts.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            isActive={activePromptId === prompt.id}
            isLoading={isLoading}
            onRun={onRun}
          />
        ))}
      </div>
    </section>
  );
}
