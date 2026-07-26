export type TicketActionState = {
  status: "success" | "error";
  message: string;
  savedAt?: string;
};
