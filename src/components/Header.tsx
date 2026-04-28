import { DemoBadge } from "./DemoBadge";

export function Header() {
  return (
    <header className="header">
      <div>
        <p className="eyebrow">AgroClaw</p>
        <h1>Memoria técnica AgTech asistida por IA</h1>
        <p className="header__subtitle">
          Demo controlada para olivar: knowledge curado, referencias visuales
          documentadas y respuestas prudentes en lenguaje natural.
        </p>
      </div>

      <DemoBadge />
    </header>
  );
}
