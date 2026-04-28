type ResponsePanelProps = {
  answer: string;
  error: string | null;
  isLoading: boolean;
  lastPromptTitle: string | null;
  onClear: () => void;
};

export function ResponsePanel({
  answer,
  error,
  isLoading,
  lastPromptTitle,
  onClear,
}: ResponsePanelProps) {
  const hasContent = answer.trim().length > 0 || error;

  async function handleCopy() {
    if (!answer) return;
    await navigator.clipboard.writeText(answer);
  }

  return (
    <section className="panel response-panel">
      <div className="panel__header response-panel__header">
        <div>
          <h2>Respuesta de AgroClaw</h2>
          <p>
            {lastPromptTitle
              ? `Última tarjeta: ${lastPromptTitle}`
              : "Selecciona una tarjeta para iniciar la demo."}
          </p>
        </div>

        <div className="response-panel__actions">
          <button
            type="button"
            className="button button--ghost"
            onClick={handleCopy}
            disabled={!answer}
          >
            Copiar
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={onClear}
            disabled={!hasContent || isLoading}
          >
            Limpiar
          </button>
        </div>
      </div>

      <div className="response-box">
        {isLoading && (
          <div className="loading">
            <span className="spinner" />
            AgroClaw está consultando su knowledge...
          </div>
        )}

        {error && <pre className="response-error">{error}</pre>}

        {!isLoading && !error && answer && (
          <pre className="response-text">{answer}</pre>
        )}

        {!isLoading && !error && !answer && (
          <p className="response-placeholder">
            La respuesta aparecerá aquí. La demo está pensada para mostrar
            recuperación documental, razonamiento prudente y utilidad cooperativa.
          </p>
        )}
      </div>
    </section>
  );
}
