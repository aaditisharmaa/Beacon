import { useState } from "react";
import Login from "./Login";

export default function App() {
  const [tokens, setTokens] = useState(null);

  if (!tokens) return <Login onLogin={setTokens} />;

  return (
    <div className="card">
      <h1>BEACON</h1>
      <p>Logged in ✅</p>
      <button onClick={() => setTokens(null)}>Log out</button>
    </div>
  );
}