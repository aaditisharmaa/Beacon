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

async function authFetch(path, token, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  if (!res.ok) {
    let message = "Something went wrong";
    try {
      const data = await res.json();
      if (typeof data.error === "string") message = data.error;
    } catch {
      // response mein JSON nahi tha, default message rehne do
    }
    throw new Error(message);
  }
  return res.json();
}

export const getTasks = (token) => authFetch("/api/tasks/prioritize", token);

export const snoozeTask = (token, id) =>
  authFetch(`/api/tasks/${id}/snooze`, token, { method: "POST" });

export const completeTask = (token, id) =>
  authFetch(`/api/tasks/${id}/complete`, token, { method: "POST" });

export const captureText = (token, text) =>
  authFetch("/api/tasks/capture", token, {
    method: "POST",
    body: JSON.stringify({ text }),
  });

export const createTask = (token, task) =>
  authFetch("/api/tasks/", token, {
    method: "POST",
    body: JSON.stringify(task),
  });