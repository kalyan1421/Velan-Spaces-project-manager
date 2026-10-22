import { describe, expect, it } from "vitest";
import type { TimelinePhase, TimelineTask } from "@/lib/api/project-ops";
import {
  createEditorState,
  isDirty,
  rebaseProgress,
  serializeDraft,
  timelineEditorReducer as reduce,
  timelineFingerprint,
  validateDraft,
  type EditorState,
} from "./timeline-editor";

function task(overrides: Partial<TimelineTask> = {}): TimelineTask {
  return {
    id: "t1",
    phaseId: "ph1",
    projectId: "p1",
    title: "Lay floor tiles",
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
    orderIndex: 0,
    createdAt: "2026-10-01T05:00:00Z",
    updatedAt: "2026-10-01T05:00:00Z",
    ...overrides,
  };
}

function phase(overrides: Partial<TimelinePhase> = {}): TimelinePhase {
  return {
    id: "ph1",
    projectId: "p1",
    name: "Civil work",
    startDate: "2026-10-01T00:00:00+00:00",
    endDate: "2026-10-20T00:00:00+00:00",
    status: "pending",
    orderIndex: 0,
    notes: null,
    createdAt: "2026-09-30T00:00:00Z",
    updatedAt: "2026-09-30T00:00:00Z",
    tasks: [task()],
    ...overrides,
  };
}

const twoPhases = () => [
  phase(),
  phase({ id: "ph2", name: "Electrical", orderIndex: 1, tasks: [task({ id: "t2", phaseId: "ph2", title: "Wiring" })] }),
];

const names = (s: EditorState) => s.phases.map((p) => p.name);
const titles = (s: EditorState, phaseIndex = 0) => s.phases[phaseIndex].tasks.map((t) => t.title);

describe("createEditorState / isDirty", () => {
  it("starts clean and keeps server ids as stable keys", () => {
    const state = createEditorState(twoPhases());
    expect(isDirty(state)).toBe(false);
    expect(state.phases.map((p) => p.key)).toEqual(["ph1", "ph2"]);
    expect(state.phases[0].tasks[0].key).toBe("t1");
  });

  it("becomes dirty on an edit and clean again when the edit is undone", () => {
    let state = createEditorState(twoPhases());
    state = reduce(state, { type: "updatePhase", phaseKey: "ph1", patch: { name: "Civil & masonry" } });
    expect(isDirty(state)).toBe(true);
    state = reduce(state, { type: "updatePhase", phaseKey: "ph1", patch: { name: "Civil work" } });
    expect(isDirty(state)).toBe(false);
  });

  it("ignores whitespace-only differences that would not change the saved timeline", () => {
    const state = reduce(createEditorState(twoPhases()), {
      type: "updatePhase",
      phaseKey: "ph1",
      patch: { name: "  Civil work  " },
    });
    expect(isDirty(state)).toBe(false);
  });

  it("reset adopts the server timeline as the new clean baseline", () => {
    let state = reduce(createEditorState(twoPhases()), { type: "removePhase", phaseKey: "ph1" });
    expect(isDirty(state)).toBe(true);
    state = reduce(state, { type: "reset", phases: [phase({ name: "Saved" })] });
    expect(isDirty(state)).toBe(false);
    expect(names(state)).toEqual(["Saved"]);
  });
});

describe("phases: add / move / remove", () => {
  it("adds a phase at the end with the given key and dates", () => {
    const state = reduce(createEditorState(twoPhases()), {
      type: "addPhase",
      key: "new-1",
      startDate: "2026-11-01",
      endDate: "2026-11-15",
    });
    expect(state.phases).toHaveLength(3);
    expect(state.phases[2]).toMatchObject({ key: "new-1", name: "", startDate: "2026-11-01", tasks: [] });
    expect(state.phases[2].id).toBeUndefined();
    expect(isDirty(state)).toBe(true);
  });

  it("moves a phase up and down and ignores moves past either end", () => {
    let state = createEditorState(twoPhases());
    state = reduce(state, { type: "movePhase", phaseKey: "ph2", offset: -1 });
    expect(names(state)).toEqual(["Electrical", "Civil work"]);
    const same = reduce(state, { type: "movePhase", phaseKey: "ph2", offset: -1 });
    expect(same).toBe(state);
    state = reduce(state, { type: "movePhase", phaseKey: "ph2", offset: 1 });
    expect(names(state)).toEqual(["Civil work", "Electrical"]);
  });

  it("removes a phase together with its tasks", () => {
    const state = reduce(createEditorState(twoPhases()), { type: "removePhase", phaseKey: "ph1" });
    expect(names(state)).toEqual(["Electrical"]);
    expect(serializeDraft(state.phases).phases[0].tasks.map((t) => t.id)).toEqual(["t2"]);
  });
});

describe("tasks: add / move / remove", () => {
  it("adds a pending, medium-priority task to the chosen phase", () => {
    const state = reduce(createEditorState(twoPhases()), { type: "addTask", phaseKey: "ph2", key: "nt" });
    expect(state.phases[1].tasks.at(-1)).toMatchObject({ key: "nt", status: "pending", priority: "medium", title: "" });
  });

  it("reorders tasks within a phase", () => {
    let state = reduce(createEditorState(twoPhases()), { type: "addTask", phaseKey: "ph1", key: "nt", title: "Grouting" });
    state = reduce(state, { type: "moveTask", phaseKey: "ph1", taskKey: "nt", offset: -1 });
    expect(titles(state)).toEqual(["Grouting", "Lay floor tiles"]);
  });

  it("moves a task to another phase (appended at its end)", () => {
    const state = reduce(createEditorState(twoPhases()), {
      type: "moveTaskToPhase",
      phaseKey: "ph1",
      taskKey: "t1",
      toPhaseKey: "ph2",
    });
    expect(titles(state, 0)).toEqual([]);
    expect(titles(state, 1)).toEqual(["Wiring", "Lay floor tiles"]);
  });

  it("removes a task", () => {
    const state = reduce(createEditorState(twoPhases()), { type: "removeTask", phaseKey: "ph1", taskKey: "t1" });
    expect(titles(state)).toEqual([]);
  });

  it("edits the checklist of a task", () => {
    let state = createEditorState(twoPhases());
    state = reduce(state, { type: "addChecklistItem", phaseKey: "ph1", taskKey: "t1", itemId: "c1", label: "Level check" });
    state = reduce(state, { type: "updateChecklistItem", phaseKey: "ph1", taskKey: "t1", itemId: "c1", patch: { isDone: true } });
    expect(state.phases[0].tasks[0].checklistItems).toEqual([{ id: "c1", label: "Level check", isDone: true }]);
    state = reduce(state, { type: "removeChecklistItem", phaseKey: "ph1", taskKey: "t1", itemId: "c1" });
    expect(state.phases[0].tasks[0].checklistItems).toEqual([]);
  });
});

describe("serializeDraft (PUT /timeline payload)", () => {
  it("round-trips an untouched timeline with ids, order and progress fields kept", () => {
    const proof = "https://x.supabase.co/storage/v1/object/sign/project-files/projects/p1/a.jpg?token=abc";
    const body = serializeDraft(
      createEditorState([
        phase({
          tasks: [
            task({
              status: "done",
              actualStart: "2026-10-02T00:00:00Z",
              actualEnd: "2026-10-03T00:00:00Z",
              assignedWorkerId: "w1",
              roomId: "r1",
              checklistItems: [{ id: "c1", label: "Level", isDone: true }],
              comments: [{ id: "m1", text: "Looks good" }],
              photoProofUrls: [proof],
            }),
          ],
        }),
      ]).phases,
    );
    expect(body).toEqual({
      phases: [
        {
          id: "ph1",
          name: "Civil work",
          startDate: "2026-10-01T00:00:00+00:00",
          endDate: "2026-10-20T00:00:00+00:00",
          status: "pending",
          notes: null,
          createdAt: "2026-09-30T00:00:00Z",
          tasks: [
            {
              id: "t1",
              title: "Lay floor tiles",
              description: null,
              status: "done",
              priority: "medium",
              plannedStart: null,
              plannedEnd: null,
              actualStart: "2026-10-02T00:00:00Z",
              actualEnd: "2026-10-03T00:00:00Z",
              assignedWorkerId: "w1",
              roomId: "r1",
              checklistItems: [{ id: "c1", label: "Level", isDone: true }],
              comments: [{ id: "m1", text: "Looks good" }],
              photoProofUrls: [proof],
              createdAt: "2026-10-01T05:00:00Z",
            },
          ],
        },
      ],
    });
  });

  it("omits ids for new phases/tasks so the server assigns them, and trims text", () => {
    let state = createEditorState([]);
    state = reduce(state, { type: "addPhase", key: "k1", startDate: "2026-11-01", endDate: "2026-11-10" });
    state = reduce(state, { type: "updatePhase", phaseKey: "k1", patch: { name: " Painting ", notes: "  " } });
    state = reduce(state, { type: "addTask", phaseKey: "k1", key: "k2", title: " Primer coat " });
    const [p] = serializeDraft(state.phases).phases;
    expect(p).not.toHaveProperty("id");
    expect(p).toMatchObject({ name: "Painting", notes: null, startDate: "2026-11-01", endDate: "2026-11-10" });
    expect(p.tasks[0]).not.toHaveProperty("id");
    expect(p.tasks[0]).toMatchObject({ title: "Primer coat", assignedWorkerId: null, roomId: null, status: "pending" });
  });

  it("maps legacy statuses and priorities to values the API accepts", () => {
    const body = serializeDraft(
      createEditorState([
        phase({ status: "notStarted", tasks: [task({ status: "notStarted", priority: "urgent" })] }),
      ]).phases,
    );
    expect(body.phases[0].status).toBe("pending");
    expect(body.phases[0].tasks[0]).toMatchObject({ status: "pending", priority: "medium" });
  });
});

describe("validateDraft", () => {
  const ctx = { workerIds: ["w1"], roomIds: ["r1"] };

  it("accepts a complete timeline", () => {
    expect(validateDraft(createEditorState(twoPhases()).phases, ctx)).toEqual([]);
  });

  it("flags missing names/titles, missing dates and end-before-start with field ids", () => {
    let state = createEditorState([]);
    state = reduce(state, { type: "addPhase", key: "k1", startDate: "2026-11-10", endDate: "2026-11-01" });
    state = reduce(state, { type: "addPhase", key: "k2", startDate: "", endDate: "" });
    state = reduce(state, { type: "addTask", phaseKey: "k1", key: "t" });
    const fields = validateDraft(state.phases, ctx).map((i) => i.fieldId);
    expect(fields).toEqual([
      "phase-k1-name",
      "phase-k1-end",
      "task-t-title",
      "phase-k2-name",
      "phase-k2-start",
      "phase-k2-end",
    ]);
  });

  it("flags an assignee who is no longer on the project and a deleted room", () => {
    const phases = createEditorState([phase({ tasks: [task({ assignedWorkerId: "gone", roomId: "r-gone" })] })]).phases;
    const messages = validateDraft(phases, ctx).map((i) => i.fieldId);
    expect(messages).toEqual(["task-t1-assignee", "task-t1-room"]);
  });

  it("flags empty checklist labels", () => {
    let state = createEditorState(twoPhases());
    state = reduce(state, { type: "addChecklistItem", phaseKey: "ph1", taskKey: "t1", itemId: "c1", label: " " });
    expect(validateDraft(state.phases, ctx).map((i) => i.fieldId)).toEqual(["task-t1-checklist-c1"]);
  });
});

describe("timelineFingerprint", () => {
  it("ignores signed-URL tokens and server timestamps that change on every read", () => {
    const a = [phase({ updatedAt: "1", tasks: [task({ photoProofUrls: ["https://s/x.jpg?token=1"], updatedAt: "1" })] })];
    const b = [phase({ updatedAt: "2", tasks: [task({ photoProofUrls: ["https://s/x.jpg?token=2"], updatedAt: "2" })] })];
    expect(timelineFingerprint(a)).toBe(timelineFingerprint(b));
  });

  it("changes when someone else edits the plan or a worker reports progress", () => {
    const base = timelineFingerprint([phase()]);
    expect(timelineFingerprint([phase({ name: "Renamed" })])).not.toBe(base);
    expect(timelineFingerprint([phase({ tasks: [task({ status: "inProgress" })] })])).not.toBe(base);
  });
});

describe("rebaseProgress", () => {
  it("takes a worker's newer progress for tasks whose progress the editor did not touch", () => {
    const baseline = [phase()];
    let state = createEditorState(baseline);
    state = reduce(state, { type: "updateTask", phaseKey: "ph1", taskKey: "t1", patch: { title: "Lay vitrified tiles" } });
    const latest = [
      phase({
        tasks: [
          task({
            status: "inProgress",
            actualStart: "2026-10-05T00:00:00Z",
            comments: [{ id: "m1", text: "Started" }],
            checklistItems: [],
          }),
        ],
      }),
    ];
    const [t] = rebaseProgress(state.phases, baseline, latest)[0].tasks;
    expect(t).toMatchObject({ title: "Lay vitrified tiles", status: "inProgress", actualStart: "2026-10-05T00:00:00Z" });
    expect(t.comments).toEqual([{ id: "m1", text: "Started" }]);
  });

  it("keeps the editor's own status change over the server's", () => {
    const baseline = [phase()];
    let state = createEditorState(baseline);
    state = reduce(state, { type: "updateTask", phaseKey: "ph1", taskKey: "t1", patch: { status: "blocked" } });
    const latest = [phase({ tasks: [task({ status: "inProgress" })] })];
    expect(rebaseProgress(state.phases, baseline, latest)[0].tasks[0].status).toBe("blocked");
  });

  it("leaves new tasks and tasks deleted on the server alone", () => {
    const baseline = [phase()];
    let state = createEditorState(baseline);
    state = reduce(state, { type: "addTask", phaseKey: "ph1", key: "nt", title: "New" });
    const rebased = rebaseProgress(state.phases, baseline, [phase({ tasks: [] })]);
    expect(rebased[0].tasks.map((t) => t.title)).toEqual(["Lay floor tiles", "New"]);
  });
});
