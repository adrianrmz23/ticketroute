import { describe, expect, it } from "vitest";

import {
  createInviteSchema,
  createWorkspaceSchema,
  createWorkspaceSlug,
  invitationTokenSchema,
} from "./workspace-schemas";

describe("workspace schemas", () => {
  it("crea slugs estables para nombres en español", () => {
    expect(createWorkspaceSlug("Equipo de Adrián & Desarrollo")).toBe(
      "equipo-de-adrian-desarrollo",
    );
  });

  it("valida una configuración completa de onboarding", () => {
    const result = createWorkspaceSchema.safeParse({
      name: "TicketRoute Lab",
      slug: "ticketroute-lab",
      timezone: "America/Mexico_City",
      estimationUnit: "days",
      weeklyCapacityHours: "40",
      defaultAiProvider: "manual",
      dataRetentionDays: "365",
      deleteAudioAfterTranscription: true,
    });

    expect(result.success).toBe(true);
  });

  it("rechaza capacidad, retención y slug fuera de contrato", () => {
    const result = createWorkspaceSchema.safeParse({
      name: "TR",
      slug: "Ticket Route",
      timezone: "America/Mexico_City",
      estimationUnit: "days",
      weeklyCapacityHours: 200,
      defaultAiProvider: "manual",
      dataRetentionDays: 45,
      deleteAudioAfterTranscription: true,
    });

    expect(result.success).toBe(false);
  });

  it("impide crear invitaciones directas con rol owner", () => {
    const result = createInviteSchema.safeParse({
      workspaceId: "404f8a7c-3d5b-4c47-8e19-f86d0748c483",
      email: "owner@ticketroute.dev",
      role: "owner",
    });

    expect(result.success).toBe(false);
  });

  it("acepta únicamente tokens aleatorios de 64 caracteres hexadecimales", () => {
    expect(invitationTokenSchema.safeParse("a".repeat(64)).success).toBe(true);
    expect(invitationTokenSchema.safeParse("short-token").success).toBe(false);
  });
});
