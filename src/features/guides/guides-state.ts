export type PlanningGuideActionState = {
  status: "success" | "error";
  message: string;
  planningGuideId?: string;
};
