import type { Entry } from "@bulletspace/core";

const DAYS_TO_SHOW = 30;
const DAY_MS = 86_400_000;

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

interface HabitStreakModuleProps {
  entries: Entry[];
}

export function HabitStreakModule({ entries }: HabitStreakModuleProps) {
  const daysWithEntries = new Set(entries.map((entry) => startOfDay(entry.createdAt)));
  const today = startOfDay(Date.now());
  const days = Array.from(
    { length: DAYS_TO_SHOW },
    (_, i) => today - (DAYS_TO_SHOW - 1 - i) * DAY_MS,
  );

  let streak = 0;
  for (let day = today; daysWithEntries.has(day); day -= DAY_MS) {
    streak += 1;
  }

  return (
    <div className="module">
      <div className="module-header">
        <h3>Journaling streak</h3>
        <span className="module-stat">
          {streak} day{streak === 1 ? "" : "s"}
        </span>
      </div>
      <div className="habit-grid">
        {days.map((day) => (
          <div
            key={day}
            className={daysWithEntries.has(day) ? "habit-cell filled" : "habit-cell"}
            title={new Date(day).toLocaleDateString()}
          />
        ))}
      </div>
    </div>
  );
}
