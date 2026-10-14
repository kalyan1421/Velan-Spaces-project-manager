import { describe, expect, it } from "vitest";
import type { TimelinePhase, TimelineTask } from "@/lib/api/project-ops";
import {
  addDaysToDateKey,
  canProgressTask,
  canUpdateTimelinePlan,
  checklistToggled,
  isoToDateKey,
  nextPhaseDates,
  normalizePhaseStatus,
  normalizePriority,
  normalizeTaskStatus,
  phaseProgress,
  scheduleBars,
  tasksAssignedTo,
} from "./timeline-model";

function task(overrides: Partial<TimelineTask> = {}): TimelineTask {
  return {
    id: "t1",
    phaseId: "ph1",
    projectId: "p1",
    title: "Task",
    description: null,
    status: "pending",
    priority: "medium",
    plannedStart: null,
    plannedEnd: null,
    actualStart: null,
    actualEnd: null,
    assignedWorkerId: null,
    roomId: null,
    checklistItems: [],
    comments: [],
    photoProofUrls: [],
    createdAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

function phase(overrides: Partial<TimelinePhase> = {}): TimelinePhase {
  return {
    id: "ph1",
    projectId: "p1",
    name: "Phase",
    startDate: "2026-10-01",
    endDate: "2026-10-10",
    status: "pending",
    orderIndex: 0,
    notes: null,
    createdAt: "2026-10-01T00:00:00Z",
    tasks: [],
    ...overrides,
  };
}

describe("status normalisation", () => {
  it("maps legacy and unknown values to the API's enums", () => {
    expect(normalizeTaskStatus("notStarted")).toBe("pending");
    expect(normalizeTaskStatus("completed")).toBe("done");
    expect(normalizeTaskStatus("blocked")).toBe("blocked");
    expect(normalizeTaskStatus(undefined)).toBe("pending");
    expect(normalizePhaseStatus("notStarted")).toBe("pending");
    expect(normalizePhaseStatus("done")).toBe("completed");
    expect(normalizePhaseStatus("inProgress")).toBe("inProgress");
    expect(normalizePriority("HIGH")).toBe("high");
    expect(normalizePriority("urgent")).toBe("medium");
  });
});

describe("isoToDateKey", () => {
  it("returns date-only strings unchanged", () => {
    expect(isoToDateKey("2026-10-14")).toBe("2026-10-14");
  });

  it("reads timestamps on the Indian calendar", () => {
    // Midnight IST stored as UTC (what the mobile app writes) is still the 14th in India.
    expect(isoToDateKey("2026-10-13T18:30:00Z")).toBe("2026-10-14");
    expect(isoToDateKey("2026-10-14T00:00:00+00:00")).toBe("2026-10-14");
  });

  it("returns an empty string for missing or invalid values", () => {
    expect(isoToDateKey(null)).toBe("");
    expect(isoToDateKey("not a date")).toBe("");
  });
});

describe("addDaysToDateKey / nextPhaseDates", () => {
  it("adds calendar days across month ends", () => {
    expect(addDaysToDateKey("2026-10-25", 14)).toBe("2026-11-08");
  });

  it("starts a new phase the day after the last phase ends", () => {
    expect(nextPhaseDates(["2026-10-20T00:00:00+00:00"], { today: "2026-10-14" })).toEqual({
      startDate: "2026-10-21",
      endDate: "2026-11-04",
    });
  });

  it("falls back to the project start, then today", () => {
    expect(nextPhaseDates([], { today: "2026-10-14", projectStart: "2026-09-01" })).toEqual({
      startDate: "2026-09-01",
      endDate: "2026-09-15",
    });
    expect(nextPhaseDates([""], { today: "2026-10-14" }).startDate).toBe("2026-10-14");
  });
});

describe("phaseProgress", () => {
  it("counts done tasks (legacy 'completed' included)", () => {
    const p = phase({ tasks: [task({ status: "done" }), task({ status: "completed" }), task({ status: "inProgress" })] });
    expect(phaseProgress(p)).toEqual({ done: 2, total: 3 });
  });
});

describe("permissions", () => {
  const mine = task({ assignedWorkerId: "w1" });

  it("lets head and managers change the plan; nobody else", () => {
    expect(canUpdateTimelinePlan("head")).toBe(true);
    expect(canUpdateTimelinePlan("manager")).toBe(true);
    expect(canUpdateTimelinePlan("worker")).toBe(false);
    expect(canUpdateTimelinePlan("client")).toBe(false);
  });

  it("lets workers report progress only on their own tasks; clients never", () => {
    expect(canProgressTask({ id: "w1", role: "worker" }, mine)).toBe(true);
    expect(canProgressTask({ id: "w2", role: "worker" }, mine)).toBe(false);
    expect(canProgressTask({ id: "m1", role: "manager" }, mine)).toBe(true);
    expect(canProgressTask({ id: "c1", role: "client" }, mine)).toBe(false);
  });
});

describe("tasksAssignedTo", () => {
  it("keeps only phases with the worker's tasks, and only those tasks", () => {
    const phases = [
      phase({ id: "a", tasks: [task({ id: "1", assignedWorkerId: "w1" }), task({ id: "2", assignedWorkerId: "w2" })] }),
      phase({ id: "b", tasks: [task({ id: "3", assignedWorkerId: "w2" })] }),
    ];
    const result = tasksAssignedTo(phases, "w1");
    expect(result.map((p) => p.id)).toEqual(["a"]);
    expect(result[0].tasks.map((t) => t.id)).toEqual(["1"]);
  });
});

describe("checklistToggled", () => {
  it("returns the full checklist with one item flipped (idempotent PATCH body)", () => {
    const items = [
      { id: "a", label: "A", isDone: false },
      { id: "b", label: "B", isDone: true },
    ];
    expect(checklistToggled(items, "a", true)).toEqual([
      { id: "a", label: "A", isDone: true },
      { id: "b", label: "B", isDone: true },
    ]);
  });
});

describe("scheduleBars", () => {
  it("positions each phase as a percentage of the overall date span", () => {
    const bars = scheduleBars([
      phase({ id: "a", startDate: "2026-10-01", endDate: "2026-10-10" }),
      phase({ id: "b", startDate: "2026-10-11", endDate: "2026-10-20" }),
    ]);
    expect(bars.range).toEqual({ start: "2026-10-01", end: "2026-10-20" });
    expect(bars.items[0]).toMatchObject({ id: "a", offset: 0, width: 50 });
    expect(bars.items[1]).toMatchObject({ id: "b", offset: 50, width: 50 });
  });

  it("skips phases without dates", () => {
    const bars = scheduleBars([phase({ id: "a", startDate: null, endDate: null })]);
    expect(bars.items).toEqual([]);
    expect(bars.range).toBeNull();
  });
});
