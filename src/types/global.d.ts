import type { GitBridge } from "./git";

declare global {
  interface Window {
    gitClient: GitBridge;
  }
}

export {};
