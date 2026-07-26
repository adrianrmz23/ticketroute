import { describe, expect, it } from "vitest";

import {
  confirmEmailSchema,
  loginSchema,
  registerSchema,
  updatePasswordSchema,
} from "./auth-schemas";

describe("esquemas de autenticación", () => {
  it("normaliza el correo de acceso", () => {
    const result = loginSchema.parse({
      email: "  ADRIAN@EXAMPLE.COM ",
      password: "temporal",
    });

    expect(result.email).toBe("adrian@example.com");
  });

  it("exige una contraseña robusta durante el registro", () => {
    const result = registerSchema.safeParse({
      name: "Adrián",
      email: "adrian@example.com",
      password: "solo-letras",
      confirmPassword: "solo-letras",
    });

    expect(result.success).toBe(false);
  });

  it("detecta contraseñas de confirmación diferentes", () => {
    const result = registerSchema.safeParse({
      name: "Adrián",
      email: "adrian@example.com",
      password: "Ticket2026",
      confirmPassword: "Ticket2027",
    });

    expect(result.success).toBe(false);
  });

  it("acepta únicamente códigos de seis dígitos", () => {
    expect(
      confirmEmailSchema.safeParse({
        email: "adrian@example.com",
        token: "123456",
      }).success,
    ).toBe(true);
    expect(
      confirmEmailSchema.safeParse({
        email: "adrian@example.com",
        token: "12345A",
      }).success,
    ).toBe(false);
  });

  it("valida la actualización de contraseña", () => {
    expect(
      updatePasswordSchema.safeParse({
        password: "Nueva2026",
        confirmPassword: "Nueva2026",
      }).success,
    ).toBe(true);
  });
});
