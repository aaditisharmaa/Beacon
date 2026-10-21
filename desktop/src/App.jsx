import { useState } from "react";
import Login from "./Login";
import TaskList from "./TaskList";

export default function App() {
  const [tokens, setTokens] = useState(null);

  if (!tokens) return <Login onLogin={setTokens} />;

  return (
    <TaskList
      token={tokens.access}
      onExpired={() => setTokens(null)}
      onLogout={() => setTokens(null)}
    />
  );
}