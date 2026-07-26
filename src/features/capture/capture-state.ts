export type CaptureActionState = {
  status: "success" | "error";
  message: string;
  captureId?: string;
  savedAt?: string;
};
