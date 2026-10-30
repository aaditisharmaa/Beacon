const TONES = ["friendly", "nudging", "strict"];

function hoursLeftFor(task) {
  return (new Date(task.deadline) - Date.now()) / 36e5;
}

function whenText(hoursLeft) {
  if (hoursLeft <= 0) return "overdue";
  if (hoursLeft < 48) return `due in ${Math.round(hoursLeft)}h`;
  return `due in ${Math.round(hoursLeft / 24)} days`;
}

export function dueText(task) {
  return whenText(hoursLeftFor(task));
}

// pet aur card dono isi se tone lete hain
export function taskTone(task) {
  const hoursLeft = hoursLeftFor(task);
  let level = task.snooze_count >= 3 ? 2 : task.snooze_count >= 1 ? 1 : 0;
  if (hoursLeft < 24) level = Math.min(2, level + 1);
  // planned start nikal gaya aur task abhi bhi pending: ek level upar
  if (task.planned_start && new Date(task.planned_start) < Date.now()) level = Math.min(2, level + 1);
  return TONES[level];
}

export function computeAvatarState(tasks) {
  if (!tasks.length) {
    return { tone: "friendly", message: "All clear! Nothing pending 🎉" };
  }

  const top = tasks[0]; // list priority ke hisaab se sorted aati hai
  const tone = taskTone(top);

  const title =
    top.title.length > 40 ? top.title.slice(0, 37) + "..." : top.title;
  const when = whenText(hoursLeftFor(top));

  const messages = {
    friendly: `Hey, "${title}" is ${when}. You've got this 💪`,
    nudging: `"${title}" is ${when}. Let's do just 10 minutes?`,
    strict: `"${title}" is ${when}. No more snoozing, start NOW.`,
  };

  return { tone, message: messages[tone] };
}