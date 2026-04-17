import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { AgentRule, AgentTask, AgentHistory } from '../types/agent-types';

export interface AgentState {
  rules: AgentRule[];
  tasks: AgentTask[];
  history: AgentHistory[];
}

const initialState: AgentState = {
  rules: [],
  tasks: [],
  history: [],
};

type Action =
  | { type: 'SET_RULES'; rules: AgentRule[] }
  | { type: 'ADD_RULE'; rule: AgentRule }
  | { type: 'UPDATE_RULE'; rule: AgentRule }
  | { type: 'DELETE_RULE'; id: string }
  | { type: 'SET_TASKS'; tasks: AgentTask[] }
  | { type: 'ADD_TASK'; task: AgentTask }
  | { type: 'UPDATE_TASK'; task: AgentTask }
  | { type: 'SET_HISTORY'; history: AgentHistory[] }
  | { type: 'ADD_HISTORY'; historyItem: AgentHistory };

function reducer(state: AgentState, action: Action): AgentState {
  switch (action.type) {
    case 'SET_RULES':
      return { ...state, rules: action.rules };
    case 'ADD_RULE':
      return { ...state, rules: [...state.rules, action.rule] };
    case 'UPDATE_RULE':
      return { ...state, rules: state.rules.map(r => r.id === action.rule.id ? action.rule : r) };
    case 'DELETE_RULE':
      return { ...state, rules: state.rules.filter(r => r.id !== action.id) };
    case 'SET_TASKS':
      return { ...state, tasks: action.tasks };
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.task] };
    case 'UPDATE_TASK':
      return { ...state, tasks: state.tasks.map(t => t.id === action.task.id ? action.task : t) };
    case 'SET_HISTORY':
      return { ...state, history: action.history };
    case 'ADD_HISTORY':
      return { ...state, history: [action.historyItem, ...state.history].slice(0, 500) };
    default:
      return state;
  }
}

interface AgentContextType {
  state: AgentState;
  dispatch: React.Dispatch<Action>;
  addRule: (rule: AgentRule) => void;
  updateRule: (rule: AgentRule) => void;
  deleteRule: (id: string) => void;
  addTask: (task: AgentTask) => void;
  updateTask: (task: AgentTask) => void;
  addHistory: (historyItem: AgentHistory) => void;
}

const AgentContext = createContext<AgentContextType | null>(null);

export function useAgentState() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgentState must be used within AgentProvider');
  return ctx;
}

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const addRule = useCallback((rule: AgentRule) => {
    dispatch({ type: 'ADD_RULE', rule });
  }, []);

  const updateRule = useCallback((rule: AgentRule) => {
    dispatch({ type: 'UPDATE_RULE', rule });
  }, []);

  const deleteRule = useCallback((id: string) => {
    dispatch({ type: 'DELETE_RULE', id });
  }, []);

  const addTask = useCallback((task: AgentTask) => {
    dispatch({ type: 'ADD_TASK', task });
  }, []);

  const updateTask = useCallback((task: AgentTask) => {
    dispatch({ type: 'UPDATE_TASK', task });
  }, []);

  const addHistory = useCallback((historyItem: AgentHistory) => {
    dispatch({ type: 'ADD_HISTORY', historyItem });
  }, []);

  // 今後ここでローカル JSON に state.rules 等を書き出す useEffect を追加可能

  return (
    <AgentContext.Provider value={{ state, dispatch, addRule, updateRule, deleteRule, addTask, updateTask, addHistory }}>
      {children}
    </AgentContext.Provider>
  );
}
