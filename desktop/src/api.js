const BASE_URL = "http://127.0.0.1:8001";

export async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, password }),
  });
  if (!res.ok) throw new Error("Wrong email or password");
  return res.json(); // { access, refresh }
}