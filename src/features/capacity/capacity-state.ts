export type CapacityActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialCapacityActionState: CapacityActionState = {
  status: "idle",
  message: "",
};

