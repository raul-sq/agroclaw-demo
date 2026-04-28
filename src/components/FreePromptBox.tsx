import { useState } from "react";
import type { FormEvent } from "react";

type FreePromptBoxProps = {
  isLoading: boolean;
  onRun: (prompt: string) => void;
};

export function FreePromptBox({ isLoading, onRun }: FreePromptBoxProps) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = value.trim();
    if (!trimmed) return;

    onRun(trimmed);
  }

  return (
    <section className="panel free-prompt">
      <div className="panel__header">
        <h2>Consulta libre acotada</h2>
        <p>
          Para esta demo, úsala solo con olivar, síntomas visuales, plagas,
          enfermedades o valor cooperativo de AgroClaw.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Escribe una consulta libre para AgroClaw..."
          rows={5}
        />

        <button
          type="submit"
          className="button button--secondary"
          disabled={isLoading || !value.trim()}
        >
          Ejecutar consulta libre
        </button>
      </form>
    </section>
  );
}
