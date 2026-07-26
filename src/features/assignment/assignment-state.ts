export type AssignmentActionState = {
  status: "success" | "error";
  message: string;
  assignmentPlanId?: string;
};
