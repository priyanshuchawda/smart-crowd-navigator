import {
  APP_NAME,
  APP_TAGLINE,
  CORE_INTENTS,
} from "@smart-crowd-navigator/shared";

const intentLabels: Record<(typeof CORE_INTENTS)[number], string> = {
  food: "Food",
  washroom: "Washroom",
  "entry-gate": "Entry Gate",
  exit: "Exit",
};

export function App() {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Issue #1 scaffold</p>
        <h1>{APP_NAME}</h1>
        <p>{APP_TAGLINE}</p>
        <ul>
          {CORE_INTENTS.map((intent) => (
            <li key={intent}>{intentLabels[intent]}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
