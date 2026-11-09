import { describe, expect, it, afterEach, vi } from "vitest";
import { initialProjects } from "../../shared/portfolio";
import { roleForOpenId, stableUserId } from "../db";
import {
  contactSchema,
  idSchema,
  messageStatusSchema,
  projectSchema,
  updateProjectSchema,
} from "./validation";

const { id: _id, ...project } = initialProjects[0];
const contact = {
  name: "Ali D",
  email: "ali@example.com",
  subject: "A project",
  message: "Let's discuss a new project together.",
  website: "",
};
afterEach(() => vi.unstubAllEnvs());

describe("project validation", () => {
  it("accepts every known seed and trims text", () => {
    for (const { id: _id, ...seed } of initialProjects)
      expect(projectSchema.safeParse(seed).success).toBe(true);
    expect(
      projectSchema.parse({ ...project, title: "  Project  " }).title
    ).toBe("Project");
  });
  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,test",
    "//evil.example/image.png",
    "ftp://example.com/image",
    "https://user:pass@example.com",
    "https://example.com/with space",
    "/outside/image.png",
    "/manus-storage/../secret",
    "/manus-storage/%2e%2e/secret",
    "/manus-storage/a%2fb",
  ])("rejects unsafe image URL %s", imageUrl => {
    expect(projectSchema.safeParse({ ...project, imageUrl }).success).toBe(
      false
    );
  });
  it.each([
    "",
    "https://example.com/image.png",
    "http://localhost:3000/image.png",
    "/manus-storage/portfolio/project.png",
  ])("accepts safe image URL %s", imageUrl => {
    expect(projectSchema.safeParse({ ...project, imageUrl }).success).toBe(
      true
    );
  });
  it("bounds lists, text, order and categories without coercion", () => {
    for (const bad of [
      { technologies: Array(21).fill("React") },
      { highlights: Array(13).fill("Highlight") },
      { title: "x" },
      { description: "short" },
      { order: 1.5 },
      { order: -1 },
      { order: "1" },
      { category: "Anything" },
      { published: "false" },
      { $where: "injected" },
      { githubUrl: "/relative" },
    ])
      expect(projectSchema.safeParse({ ...project, ...bad }).success).toBe(
        false
      );
  });
  it("only permits an optional stable id in update bodies", () => {
    expect(
      projectSchema.safeParse({ ...project, id: "amieroute" }).success
    ).toBe(false);
    expect(
      updateProjectSchema.safeParse({ ...project, id: "amieroute" }).success
    ).toBe(true);
    expect(idSchema.safeParse({ $ne: null }).success).toBe(false);
    expect(idSchema.safeParse("../../secret").success).toBe(false);
  });
});

describe("contact validation", () => {
  it("trims fields and defaults an omitted honeypot to blank", () => {
    const { website: _website, ...withoutHoneypot } = contact;
    expect(
      contactSchema.parse({ ...withoutHoneypot, name: "  Ali D  " })
    ).toMatchObject({ name: "Ali D", website: "" });
  });
  it.each([
    { name: " A " },
    { name: "x".repeat(101) },
    { email: "invalid" },
    { email: "x".repeat(321) + "@example.com" },
    { subject: "x" },
    { subject: "x".repeat(161) },
    { message: "short" },
    { message: "x".repeat(5001) },
    { website: "bot.example" },
    { name: { $gt: "" } },
    { status: "archived" },
  ])("rejects invalid or injected contact input %j", bad => {
    expect(contactSchema.safeParse({ ...contact, ...bad }).success).toBe(false);
  });
  it("accepts boundary sizes", () => {
    expect(
      contactSchema.safeParse({
        ...contact,
        name: "AA",
        subject: "Hi",
        message: "x".repeat(10),
      }).success
    ).toBe(true);
    expect(
      contactSchema.safeParse({
        ...contact,
        name: "x".repeat(100),
        subject: "x".repeat(160),
        message: "x".repeat(5000),
      }).success
    ).toBe(true);
  });
  it("allows only declared message statuses", () => {
    for (const status of ["unread", "read", "archived"])
      expect(messageStatusSchema.safeParse({ status }).success).toBe(true);
    expect(messageStatusSchema.safeParse({ status: "deleted" }).success).toBe(
      false
    );
    expect(
      messageStatusSchema.safeParse({ status: "read", $unset: { message: 1 } })
        .success
    ).toBe(false);
  });
});

describe("owner identity and compatibility", () => {
  it("produces stable safe numeric ids", () => {
    expect(stableUserId("owner")).toBe(stableUserId("owner"));
    expect(Number.isSafeInteger(stableUserId("owner"))).toBe(true);
    expect(stableUserId("owner")).not.toBe(stableUserId("visitor"));
  });
  it("never grants admin to the first visitor or an unspecified owner", () => {
    vi.stubEnv("OWNER_OPEN_ID", "");
    expect(roleForOpenId("visitor")).toBe("user");
    vi.stubEnv("OWNER_OPEN_ID", "owner");
    expect(roleForOpenId("visitor")).toBe("user");
    expect(roleForOpenId("owner")).toBe("admin");
  });
});
