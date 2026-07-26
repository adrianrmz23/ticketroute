export type ExecutionActionState = {
  status: "success" | "error";
  message: string;
  executionRunId?: string;
};
