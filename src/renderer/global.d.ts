export {};

declare global {
  interface Window {
    orchestrator: {
      ping: () => Promise<string>;
    };
  }
}