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
      // FormData pe browser khud boundary lagata hai, JSON header nahi lagana
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
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

export const getRoadmap = (token, id) =>
  authFetch(`/api/tasks/${id}/roadmap`, token, { method: "POST" });

export const getCompleted = (token) =>
  authFetch("/api/tasks/completed", token);

const STORAGE_KEY = "beacon_tokens";

export function saveTokens(tokens) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // storage na chale toh bhi app chalegi, bas login yaad nahi rahega
  }
}

export function loadTokens() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearTokens() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function refreshAccess(refresh) {
  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) throw new Error("SESSION_EXPIRED");
  return res.json(); // { access }
}

export const getNudge = (token, id, tone) =>
  authFetch(`/api/tasks/${id}/nudge`, token, {
    method: "POST",
    body: JSON.stringify({ tone }),
  });

export const getProfile = (token) => authFetch("/api/auth/profile", token);

export const saveProfile = (token, data) =>
  authFetch("/api/auth/profile", token, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const transcribeAudio = (token, blob) => {
  const form = new FormData();
  form.append("audio", blob, "voice.webm");
  return authFetch("/api/tasks/transcribe", token, {
    method: "POST",
    body: form,
  });
};

export const getFirstStep = (token, id) =>
  authFetch(`/api/tasks/${id}/first-step`, token, { method: "POST" });

export const getAnalytics = (token) => authFetch('/api/tasks/analytics', token);
