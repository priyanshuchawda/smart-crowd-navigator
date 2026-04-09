const appName = "Smart Crowd Navigator";
const appTagline =
  "A Gemini-powered assistant for real-time movement decisions inside sporting venues.";

export function App() {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Issue #1 scaffold</p>
        <h1>{appName}</h1>
        <p>{appTagline}</p>
        <ul>
          <li>Food</li>
          <li>Washroom</li>
          <li>Entry Gate</li>
          <li>Exit</li>
        </ul>
      </section>
    </main>
  );
}
