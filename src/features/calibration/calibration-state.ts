export type CalibrationActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialCalibrationActionState: CalibrationActionState = {
  status: "idle",
  message: "",
};
