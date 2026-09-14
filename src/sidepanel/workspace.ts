import { createContext, useContext } from "react";
import type {
  AppState,
  ResearchCase,
  Identifier,
  CaptureDraft,
} from "../types";
export type Workspace = {
  state: AppState;
  c: ResearchCase | null;
  save: (c: ResearchCase) => Promise<void>;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  notify: (message: string) => void;
  refresh: () => Promise<void>;
  navigate: (page: string) => void;
  editIdentifier: (i?: Identifier) => void;
  pivot: (i: Identifier, sourceId?: string) => void;
  capture: (mode: "finding" | "identifier" | "lead") => Promise<void>;
  draft: CaptureDraft | null;
  dismissDraft: () => Promise<void>;
  windowId?: number;
};
export const WorkspaceContext = createContext<Workspace>(null!);
export const useWorkspace = () => useContext(WorkspaceContext);
