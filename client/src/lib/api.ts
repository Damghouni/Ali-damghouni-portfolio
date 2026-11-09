import { COOKIE_NAME } from "@shared/const";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Portfolio-Request": "1",
  };
  try {
    const raw = sessionStorage.getItem("manus-cookie");
    const prefix = `${COOKIE_NAME}=`;
    const pair = raw?.split(";").find(p => p.trim().startsWith(prefix));
    const token = pair?.trim().slice(prefix.length);
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* Cookies remain the primary authentication method. */
  }
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: { ...headers, ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      response.status,
      body.error || "Something went wrong. Please try again."
    );
  return body as T;
}
