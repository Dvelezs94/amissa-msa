import { describe, expect, it } from "vitest";
import {
  parsePublicOrderLookup,
  publicContactEmailLinePattern,
} from "@/lib/public-order-lookup";

describe("parsePublicOrderLookup", () => {
  it("accepts a folio", () => {
    expect(parsePublicOrderLookup(" 2009 ")).toEqual({
      ok: true,
      value: { kind: "folio", folio: 2009 },
    });
  });

  it("accepts a contact email", () => {
    expect(parsePublicOrderLookup("Ana@Correo.com")).toEqual({
      ok: true,
      value: { kind: "email", email: "ana@correo.com" },
    });
  });

  it("rejects an empty value, a bad folio, and a bad email", () => {
    expect(parsePublicOrderLookup("  ").ok).toBe(false);
    expect(parsePublicOrderLookup("abc").ok).toBe(false);
    expect(parsePublicOrderLookup("0").ok).toBe(false);
    expect(parsePublicOrderLookup("ana@").ok).toBe(false);
  });
});

describe("publicContactEmailLinePattern", () => {
  const description = [
    "Falla en el horno",
    "",
    "---",
    "Orden publica desde /orden",
    "Nombre contacto: Ana",
    "Email contacto: ana_b@correo.com",
  ].join("\n");

  it("matches the stored contact line and not a longer address", () => {
    const pattern = publicContactEmailLinePattern("ana_b@correo.com");
    const re = new RegExp(pattern, "i");
    expect(re.test(description)).toBe(true);
    expect(re.test(description + ".mx")).toBe(false);
    expect(
      re.test(description.replace("ana_b@correo.com", "otra@correo.com"))
    ).toBe(false);
  });
});
