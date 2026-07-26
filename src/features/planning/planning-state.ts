export type EstimateActionState = {
  status: "success" | "error";
  message: string;
  estimateId?: string;
};
