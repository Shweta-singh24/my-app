import React, { createContext, useContext, useEffect, useReducer, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"

function uuid() {
  return Math.random().toString(36).substr(2, 9);
}


function makeDefaultBoard() {
  const t1 = {
    id: uuid(),
    title: "Welcome to your Kanban",
    description: "Drag me around, edit, or delete.",
    tags: ["intro"],
    createdAt: Date.now(),
  };
  return {
    id: uuid(),
    name: "Personal",
    columns: [
      { id: uuid(), title: "To Do", taskIds: [t1.id] },
      { id: uuid(), title: "In Progress", taskIds: [] },
      { id: uuid(), title: "Done", taskIds: [] },
    ],
    tasks: { [t1.id]: t1 },
    createdAt: Date.now(),
  };
}

const LS_KEY = "kanban.local.v1";

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {}
}

// Reducer 
function reducer(state, action) {
  const next = JSON.parse(JSON.stringify(state));
  const findBoard = (id) => next.boards.find(b => b.id === id);

  switch (action.type) {
    case "ADD_BOARD": {
      next.boards.push({ id: uuid(), name: action.name || "Untitled", columns: [], tasks: {}, createdAt: Date.now() });
      const b = next.boards[next.boards.length - 1];
      ["To Do", "In Progress", "Done"].forEach(title => b.columns.push({ id: uuid(), title, taskIds: [] }));
      return next;
    }
    case "RENAME_BOARD": {
      const b = findBoard(action.boardId);
      b.name = action.name;
      return next;
    }
    case "DELETE_BOARD": {
      next.boards = next.boards.filter(b => b.id !== action.boardId);
      if (next.boards.length === 0) next.boards.push(makeDefaultBoard());
      return next;
    }
    case "ADD_COLUMN": {
      const b = findBoard(action.boardId);
      b.columns.push({ id: uuid(), title: action.title, taskIds: [] });
      return next;
    }
    case "RENAME_COLUMN": {
      const b = findBoard(action.boardId);
      const c = b.columns.find(c => c.id === action.columnId);
      c.title = action.title;
      return next;
    }
    case "DELETE_COLUMN": {
      const b = findBoard(action.boardId);
      b.columns = b.columns.filter(c => c.id !== action.columnId);
      return next;
    }
    case "ADD_TASK": {
      const b = findBoard(action.boardId);
      const id = uuid();
      b.tasks[id] = { id, createdAt: Date.now(), ...action.task };
      const col = b.columns.find(c => c.id === action.columnId);
      col.taskIds.unshift(id);
      return next;
    }
    case "EDIT_TASK": {
      const b = findBoard(action.boardId);
      const t = b.tasks[action.taskId];
      b.tasks[action.taskId] = { ...t, ...action.patch };
      return next;
    }
    case "DELETE_TASK": {
      const b = findBoard(action.boardId);
      delete b.tasks[action.taskId];
      const col = b.columns.find(c => c.id === action.columnId);
      col.taskIds = col.taskIds.filter(id => id !== action.taskId);
      return next;
    }
    case "MOVE_TASK": {
      const b = findBoard(action.boardId);
      const from = b.columns.find(c => c.id === action.fromColId);
      const to = b.columns.find(c => c.id === action.toColId);
      const [removed] = from.taskIds.splice(action.fromIndex, 1);
      to.taskIds.splice(action.toIndex, 0, removed);
      return next;
    }
    default:
      return state;
  }
}

// Context 
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

// UI Helpers
const IconBtn = (props) => (
  <button className="px-2 py-1 rounded-xl border shadow-sm text-sm hover:shadow" {...props} />
);

const TextInput = (props) => (
  <input {...props} className={`w-full rounded-xl border p-2 shadow-sm ${props.className || ""}`} />
);

// App Shell 
const Shell = ({ children }) => (
  <div className="min-h-screen bg-gray-50 text-gray-900">
    <header className="sticky top-0 border-b bg-white shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 justify-between">
        <Link to="/" className="font-semibold text-lg">Kanban</Link>
      </div>
    </header>
    <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
  </div>
);

// Boards List
const BoardsList = () => {
  const { state, dispatch } = useApp();
  const [name, setName] = useState("");
  const add = () => {
    if (!name.trim()) return;
    dispatch({ type: "ADD_BOARD", name: name.trim() });
    setName("");
  };
  return (
    <Shell>
      <div className="flex items-center gap-2 mb-6">
        <TextInput placeholder="New board name" value={name} onChange={e => setName(e.target.value)} />
        <IconBtn onClick={add}>Add Board</IconBtn>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {state.boards.map(b => (
          <Link key={b.id} to={`/b/${b.id}`} className="rounded-2xl p-4 border bg-white shadow-sm hover:shadow-md">
            <div className="font-semibold text-lg mb-1">{b.name}</div>
            <div className="text-sm opacity-70">{b.columns.length} columns • {Object.keys(b.tasks).length} tasks</div>
          </Link>
        ))}
      </div>
    </Shell>
  );
};

//Board View
const BoardView = () => {
  const { boardId } = useParams();
  const { state, dispatch } = useApp();
  const nav = useNavigate();
  const board = state.boards.find(b => b.id === boardId);

  useEffect(() => { if (!board) nav("/"); }, [boardId]);

  if (!board) return null;

  return (
    <Shell>
      <div className="flex items-center gap-2 mb-4">
        <TextInput
          className="max-w-xs"
          defaultValue={board.name}
          onBlur={e => dispatch({ type: "RENAME_BOARD", boardId: board.id, name: e.target.value || board.name })}
        />
        <IconBtn onClick={() => { if (confirm("Delete board?")) { dispatch({ type: "DELETE_BOARD", boardId: board.id }); nav("/"); } }}>Delete Board</IconBtn>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {board.columns.map((col) => (
          <div key={col.id} className="w-80 shrink-0 rounded-2xl bg-gray-100 border p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <TextInput
                defaultValue={col.title}
                onBlur={e => dispatch({ type: "RENAME_COLUMN", boardId: board.id, columnId: col.id, title: e.target.value || col.title })}
              />
              <IconBtn onClick={() => dispatch({ type: "DELETE_COLUMN", boardId: board.id, columnId: col.id })}>🗑️</IconBtn>
            </div>

            <div className="space-y-2 min-h-[40px]">
              {col.taskIds.map((tid) => {
                const task = board.tasks[tid];
                return (
                  <div key={task.id} className="rounded-xl p-3 bg-white border shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{task.title}</div>
                      <IconBtn onClick={() => dispatch({ type: "DELETE_TASK", boardId: board.id, columnId: col.id, taskId: task.id })}>🗑️</IconBtn>
                    </div>
                    {task.description && <p className="text-sm mt-1 opacity-90">{task.description}</p>}
                  </div>
                );
              })}
            </div>

            <button
              className="mt-3 w-full p-2 border rounded-xl bg-white"
              onClick={() => dispatch({ type: "ADD_TASK", boardId: board.id, columnId: col.id, task: { title: "New Task", description: "", tags: [] } })}
            >
              + Add Task
            </button>
          </div>
        ))}

        <div className="w-80 shrink-0 rounded-2xl bg-white border p-3 h-fit">
          <div className="font-medium mb-2">Add Column</div>
          <button className="p-2 border rounded-xl w-full" onClick={() => dispatch({ type: "ADD_COLUMN", boardId: board.id, title: "New Column" })}>+ Add</button>
        </div>
      </div>
    </Shell>
  );
};

// Root App 
const Provider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState() || { boards: [makeDefaultBoard()] });
  useEffect(() => saveState(state), [state]);
  return <AppCtx.Provider value={{ state, dispatch }}>{children}</AppCtx.Provider>;
};

const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<BoardsList/>} />
      <Route path="/b/:boardId" element={<BoardView/>} />
    </Routes>
  </BrowserRouter>
);

export default function App() {
  return (
    <Provider>
      <AppRouter/>
    </Provider>
  );
}
