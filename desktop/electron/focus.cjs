const { execFile, spawn } = require("child_process");

// BEACON's own windows and Windows system UI are always allowed
const ALWAYS_ALLOWED = new Set([
  "electron",
  "beacon",
  "explorer",
  "searchhost",
  "searchapp",
  "startmenuexperiencehost",
  "shellexperiencehost",
  "lockapp",
  "textinputhost",
]);
const MAX_APPS = 50;
const MAX_MINUTES = 720;

function cleanName(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.exe$/, "")
    .slice(0, 60);
}

// Brain of the focus session. Kept separate from Electron so it can be tested alone.
// Privacy: only the app (process) name is compared in memory. Window titles
// are never read, and nothing is saved to disk or sent over the network.
function createFocus({
  startWatcher,
  onState,
  onAvatar,
  onFinish,
  msPerMinute = 60000,
  repeatMs = 30000,
  holdMs = 4000,
}) {
  let session = null;
  let stopWatcher = null;
  let endTimer = null;
  let holdTimer = null;
  let lastSummary = null;
  let lastError = "";

  function getState() {
    if (session) {
      return {
        active: true,
        endsAt: session.endsAt,
        minutes: session.minutes,
        violations: session.violations,
        allowed: [...session.allowed],
      };
    }
    return { active: false, summary: lastSummary, error: lastError };
  }

  const emit = () => onState?.(getState());

  function say(state, hold = 0) {
    clearTimeout(holdTimer);
    onAvatar?.(state);
    if (hold > 0) holdTimer = setTimeout(() => onAvatar?.(null), hold);
  }

  function cleanup() {
    clearTimeout(endTimer);
    endTimer = null;
    if (stopWatcher) {
      try {
        stopWatcher();
      } catch {
        // watcher already stopped
      }
      stopWatcher = null;
    }
  }

  function minutesLeft() {
    return Math.max(1, Math.ceil((session.endsAt - Date.now()) / msPerMinute));
  }

  function warningText(rawName) {
    const app = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const left = minutesLeft();
    const lines = [
      `Opened ${app}? Focus mode is on, get back to work 👀`,
      `Hey! ${app} can wait, it's focus time.`,
      `Close ${app}, only ${left} min left.`,
      `${app} again? Just ${left} more minute(s), you've got this 💪`,
    ];
    return lines[session.warned++ % lines.length];
  }

  function handleApp(raw) {
    if (!session) return;
    const name = cleanName(raw);

    if (!name || session.allowed.has(name) || ALWAYS_ALLOWED.has(name)) {
      if (session.off) {
        session.off = false;
        say({ tone: "friendly", message: "Nice, back on track 💪" }, holdMs);
      }
      return;
    }

    const t = Date.now();
    if (!session.off) {
      session.off = true;
      session.violations += 1;
      session.lastWarnAt = t;
      say({ tone: "strict", message: warningText(name) });
      emit();
    } else if (t - session.lastWarnAt >= repeatMs) {
      session.lastWarnAt = t;
      say({ tone: "strict", message: warningText(name) });
    }
  }

  function end(completed) {
    if (!session) return;
    lastSummary = {
      minutes: session.minutes,
      violations: session.violations,
      completed,
    };
    lastError = "";
    session = null;
    cleanup();
    emit();

    if (completed) {
      const v = lastSummary.violations;
      say(
        {
          tone: "friendly",
          message:
            v === 0
              ? "Focus session complete, not a single distraction! 🎉"
              : `Session complete! You strayed ${v} ${
                  v === 1 ? "time" : "times"
                }, but you finished it 👏`,
        },
        10000
      );
      onFinish?.(lastSummary);
    } else {
      say(null);
    }
  }

  function fail(err) {
    if (!session) return;
    session = null;
    cleanup();
    lastError = err?.message || "Could not start focus mode";
    say(null);
    emit();
  }

  function start({ minutes, allowed } = {}) {
    if (session) return { ok: false, error: "Focus mode is already running" };

    const m = Math.round(Number(minutes));
    if (!Number.isFinite(m) || m < 1 || m > MAX_MINUTES) {
      return {
        ok: false,
        error: `Duration must be between 1 and ${MAX_MINUTES} minutes`,
      };
    }
    const list = Array.isArray(allowed)
      ? allowed.map(cleanName).filter(Boolean).slice(0, MAX_APPS)
      : [];
    if (list.length === 0) {
      return { ok: false, error: "Allow at least one app" };
    }

    lastSummary = null;
    lastError = "";
    session = {
      minutes: m,
      endsAt: Date.now() + m * msPerMinute,
      allowed: new Set(list),
      violations: 0,
      warned: 0,
      off: false,
      lastWarnAt: 0,
    };
    endTimer = setTimeout(() => end(true), m * msPerMinute);
    stopWatcher = startWatcher(handleApp, fail);

    // watcher failed right at startup (for example, not on Windows)
    if (!session) return { ok: false, error: lastError || "Could not start" };

    say(
      { tone: "friendly", message: `Focus mode on! ${m} minute(s), you've got this 💪` },
      holdMs + 2000
    );
    emit();
    return { ok: true, state: getState() };
  }

  function stop() {
    end(false);
    return getState();
  }

  return { start, stop, getState, handleApp };
}

// On Windows, reads the foreground window's app name every ~1.5 seconds.
// A single PowerShell process keeps running and only prints the process name.
const WATCH_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class BeaconFg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
}
"@
while ($true) {
  $name = ''
  $h = [BeaconFg]::GetForegroundWindow()
  if ($h -ne [IntPtr]::Zero) {
    $procId = [uint32]0
    [void][BeaconFg]::GetWindowThreadProcessId($h, [ref]$procId)
    $p = Get-Process -Id $procId
    if ($p) { $name = $p.ProcessName }
  }
  [Console]::Out.WriteLine($name)
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds 1500
}
`;

function startPowerShellWatcher(onApp, onError) {
  if (process.platform !== "win32") {
    onError(new Error("Focus mode currently works only on Windows"));
    return () => {};
  }

  const encoded = Buffer.from(WATCH_SCRIPT, "utf16le").toString("base64");
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
    { windowsHide: true }
  );

  let stopped = false;
  let buffer = "";
  let lastErr = "";

  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) onApp(line);
  });
  child.stderr.on("data", (chunk) => {
    lastErr = chunk.toString("utf8").slice(0, 300);
  });
  child.on("error", (err) => {
    if (!stopped) onError(err);
  });
  child.on("exit", (code) => {
    if (!stopped) {
      onError(new Error(lastErr.trim() || `Watcher stopped (code ${code})`));
    }
  });

  return () => {
    stopped = true;
    try {
      child.kill();
    } catch {
      // already stopped
    }
  };
}

// Names of currently open apps (names only, no window titles) for the allow list
function listRunningApps() {
  return new Promise((resolve) => {
    if (process.platform !== "win32") return resolve([]);
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object -ExpandProperty ProcessName | Sort-Object -Unique",
      ],
      { windowsHide: true, timeout: 10000 },
      (err, stdout) => {
        if (err) return resolve([]);
        const names = stdout
          .split(/\r?\n/)
          .map(cleanName)
          .filter((n) => n && !ALWAYS_ALLOWED.has(n));
        resolve([...new Set(names)]);
      }
    );
  });
}

module.exports = {
  createFocus,
  startPowerShellWatcher,
  listRunningApps,
  ALWAYS_ALLOWED,
};