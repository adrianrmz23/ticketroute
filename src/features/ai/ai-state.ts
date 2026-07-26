export type AiActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialAiActionState: AiActionState = {
  status: "idle",
  message: "",
};
