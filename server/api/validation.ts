import { z } from "zod";

function isHttpUrl(value: string): boolean {
  if (!value) return true;
  if (/[\s\\\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function isStoragePath(value: string): boolean {
  return (
    /^\/manus-storage\/[A-Za-z0-9_./%-]+$/.test(value) &&
    !value.includes("//") &&
    !value.split("/").some(segment => {
      try {
        return (
          [".", ".."].includes(decodeURIComponent(segment)) ||
          /[\\/]/.test(decodeURIComponent(segment))
        );
      } catch {
        return true;
      }
    })
  );
}

const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    isHttpUrl,
    "Use an http:// or https:// URL, or leave this field blank."
  );
const imageUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    value => isHttpUrl(value) || isStoragePath(value),
    "Use an http://, https:// or /manus-storage/ image URL."
  );
export const idSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, "This item identifier is invalid.");

export const projectSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Project title must contain at least 2 characters.")
      .max(120),
    subtitle: z.string().trim().max(200),
    description: z
      .string()
      .trim()
      .min(10, "Project description must contain at least 10 characters.")
      .max(5000),
    category: z.enum(["Full-stack", "Web application"]),
    year: z.string().trim().min(1).max(30),
    technologies: z.array(z.string().trim().min(1).max(60)).max(20),
    status: z.string().trim().min(1).max(80),
    featured: z.boolean(),
    published: z.boolean(),
    cover: z.enum(["delivery", "banking", "portfolio"]),
    imageUrl,
    githubUrl: optionalUrl,
    liveUrl: optionalUrl,
    highlights: z.array(z.string().trim().min(1).max(500)).max(12),
    order: z.number().int().min(0).max(100000),
  })
  .strict();

export const updateProjectSchema = projectSchema.extend({
  id: idSchema.optional(),
});
export const contactSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Please enter a name between 2 and 100 characters.")
      .max(100),
    email: z
      .string()
      .trim()
      .max(320)
      .email("Please enter a valid email address."),
    subject: z
      .string()
      .trim()
      .min(2, "Please enter a subject between 2 and 160 characters.")
      .max(160),
    message: z
      .string()
      .trim()
      .min(10, "Please write a message between 10 and 5,000 characters.")
      .max(5000),
    website: z
      .string()
      .trim()
      .max(0, "This submission could not be accepted.")
      .default(""),
  })
  .strict();
export const messageStatusSchema = z
  .object({ status: z.enum(["unread", "read", "archived"]) })
  .strict();
