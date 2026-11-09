import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  Plus,
  FolderKanban,
  Mail,
  MailOpen,
  ShieldCheck,
  Loader2,
  LogOut,
  Pencil,
  Trash2,
  X,
  Archive,
  Check,
  Github,
  AlertTriangle,
  Database,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { startLogin } from "@/const";
import { ProjectCover } from "@/components/ProjectCard";
import type { PortfolioProject, ContactMessage } from "@shared/portfolio";

type AdminIdentity = {
  user: { name: string; email: string; role: string };
  databaseMode: "external" | "local-preview" | "unavailable";
};
const blankProject: PortfolioProject = {
  id: "",
  title: "",
  subtitle: "",
  description: "",
  category: "Full-stack",
  year: String(new Date().getFullYear()),
  technologies: [],
  status: "In development",
  featured: false,
  published: true,
  cover: "portfolio",
  imageUrl: "",
  githubUrl: "",
  liveUrl: "",
  highlights: [],
  order: 0,
};

export default function Admin() {
  const client = useQueryClient();
  const [tab, setTab] = useState<"projects" | "messages">("projects");
  const [search, setSearch] = useState("");
  const [messageFilter, setMessageFilter] = useState("All");
  const [openedMessage, setOpenedMessage] = useState<string | null>(null);
  const [editor, setEditor] = useState<PortfolioProject | null>(null);
  const [deleteItem, setDeleteItem] = useState<{
    type: "projects" | "messages";
    id: string;
    name: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const identity = useQuery({
    queryKey: ["admin", "me"],
    queryFn: () => api<AdminIdentity>("/api/admin/me"),
    retry: false,
  });
  const authorized = !!identity.data;
  const projects = useQuery({
    queryKey: ["admin", "projects"],
    queryFn: () => api<{ projects: PortfolioProject[] }>("/api/admin/projects"),
    enabled: authorized,
  });
  const messages = useQuery({
    queryKey: ["admin", "messages"],
    queryFn: () => api<{ messages: ContactMessage[] }>("/api/admin/messages"),
    enabled: authorized,
  });
  useEffect(() => {
    const oldTitle = document.title;
    document.title = "Portfolio Administration — Ali Damghouni";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.title = oldTitle;
      meta.remove();
    };
  }, []);
  async function logout() {
    try {
      await api("/api/admin/logout", { method: "POST" });
      sessionStorage.removeItem("manus-cookie");
      client.clear();
      window.location.href = "/";
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not sign out."
      );
    }
  }
  async function updateMessage(
    message: ContactMessage,
    status: ContactMessage["status"]
  ) {
    try {
      await api(`/api/admin/messages/${encodeURIComponent(message.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await client.invalidateQueries({ queryKey: ["admin", "messages"] });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update message."
      );
    }
  }
  async function openMessage(message: ContactMessage) {
    setOpenedMessage(openedMessage === message.id ? null : message.id);
    if (message.status === "unread") await updateMessage(message, "read");
  }
  async function remove() {
    if (!deleteItem) return;
    setBusy(true);
    try {
      await api(
        `/api/admin/${deleteItem.type}/${encodeURIComponent(deleteItem.id)}`,
        { method: "DELETE" }
      );
      await client.invalidateQueries({ queryKey: ["admin", deleteItem.type] });
      await client.invalidateQueries({ queryKey: ["projects"] });
      toast.success(
        `${deleteItem.type === "projects" ? "Project" : "Message"} deleted.`
      );
      setDeleteItem(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete this item."
      );
    } finally {
      setBusy(false);
    }
  }
  const allProjects = projects.data?.projects ?? [];
  const allMessages = messages.data?.messages ?? [];
  const unread = allMessages.filter(m => m.status === "unread").length;
  const filteredProjects = allProjects.filter(p =>
    `${p.title} ${p.technologies.join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  const filteredMessages = allMessages.filter(
    m =>
      (messageFilter === "All" || m.status === messageFilter.toLowerCase()) &&
      `${m.name} ${m.subject} ${m.email}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-shell">
          <div className="admin-brand">
            <Link className="wordmark" href="/">
              AD<span className="logo-slash">/</span>
            </Link>
            <span>PORTFOLIO ADMIN</span>
          </div>
          <div className="admin-header-links">
            <Link href="/">
              View portfolio <ArrowUpRight size={14} />
            </Link>
            {authorized && (
              <button onClick={logout} aria-label="Sign out">
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </header>
      {identity.isPending ? (
        <div className="admin-login">
          <div className="admin-login-icon">
            <Loader2 className="spin" />
          </div>
          <p>Checking secure access…</p>
        </div>
      ) : !authorized ? (
        <div className="admin-login">
          <div className="admin-login-icon">
            <ShieldCheck size={27} />
          </div>
          <span className="eyebrow">PRIVATE WORKSPACE</span>
          <h1>Your work. Your control.</h1>
          <p>
            {identity.error instanceof ApiError && identity.error.status === 403
              ? "This workspace is reserved for the portfolio owner. Your account doesn’t have administrator access."
              : identity.error instanceof ApiError &&
                  identity.error.status === 401
                ? "Sign in with the portfolio owner’s Manus account to manage projects and read contact messages."
                : "Administrator access could not be checked. The database or authentication service may be unavailable."}
          </p>
          <button
            className="button primary"
            onClick={() => {
              try {
                startLogin();
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Sign-in is unavailable."
                );
              }
            }}
          >
            Sign in securely <ArrowUpRight size={16} />
          </button>
          {!(
            identity.error instanceof ApiError &&
            [401, 403].includes(identity.error.status)
          ) && (
            <button
              className="button outline"
              onClick={() => identity.refetch()}
            >
              Retry
            </button>
          )}
          <small>
            Owner-only access · Secure authentication · No public sign-up
          </small>
        </div>
      ) : (
        <main className="admin-shell admin-main">
          <div className="admin-title">
            <div>
              <span className="eyebrow">YOUR CREATIVE WORKSPACE</span>
              <h1>Portfolio overview</h1>
              <p>
                Welcome back, {identity.data.user.name || "Ali"}. Keep your work
                up to date.
              </p>
            </div>
            <button
              className="button primary"
              onClick={() =>
                setEditor({ ...blankProject, order: allProjects.length })
              }
            >
              <Plus size={16} /> Add project
            </button>
          </div>
          {identity.data.databaseMode !== "external" && (
            <div className="database-banner">
              <Database size={17} />
              <span>
                {identity.data.databaseMode === "local-preview"
                  ? "Local MongoDB preview. Data is stored in this sandbox, not a hosted production database. Configure MONGODB_URI before publishing."
                  : "Hosted MongoDB is not configured. Database-backed actions are currently unavailable."}
              </span>
            </div>
          )}
          <div className="admin-stats">
            <div className="stat-card">
              <div>
                <span>Total projects</span>
                <strong>
                  {allProjects.length.toString().padStart(2, "0")}
                </strong>
              </div>
              <FolderKanban />
            </div>
            <div className="stat-card">
              <div>
                <span>Published projects</span>
                <strong>
                  {allProjects
                    .filter(p => p.published)
                    .length.toString()
                    .padStart(2, "0")}
                </strong>
              </div>
              <ArrowUpRight />
            </div>
            <div className="stat-card">
              <div>
                <span>Unread messages</span>
                <strong>{unread.toString().padStart(2, "0")}</strong>
              </div>
              <Mail />
            </div>
          </div>
          <div className="admin-tabs">
            <button
              className={tab === "projects" ? "active" : ""}
              onClick={() => {
                setTab("projects");
                setSearch("");
              }}
            >
              <FolderKanban size={16} /> Projects
            </button>
            <button
              className={tab === "messages" ? "active" : ""}
              onClick={() => {
                setTab("messages");
                setSearch("");
              }}
            >
              <Mail size={16} /> Messages{" "}
              {unread > 0 && <span>({unread})</span>}
            </button>
          </div>
          <div className="admin-content-bar">
            <input
              aria-label={`Search ${tab}`}
              placeholder={
                tab === "projects"
                  ? "Search projects or technologies…"
                  : "Search messages…"
              }
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {tab === "messages" && (
              <div>
                {["All", "Unread", "Read", "Archived"].map(f => (
                  <button
                    key={f}
                    className={messageFilter === f ? "filter active" : "filter"}
                    onClick={() => setMessageFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
            <span className="small muted">
              {tab === "projects"
                ? `${filteredProjects.length} projects`
                : `${filteredMessages.length} messages`}
            </span>
          </div>
          {tab === "projects" ? (
            projects.isPending ? (
              <p className="empty-state">Loading projects…</p>
            ) : projects.isError ? (
              <div className="inline-error">
                <p>Unable to load projects.</p>
                <button
                  className="button outline"
                  onClick={() => projects.refetch()}
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="admin-projects">
                {filteredProjects.length === 0 ? (
                  <div className="admin-empty">
                    <FolderKanban size={28} />
                    <h3>
                      {search
                        ? "No matching projects"
                        : "Room for your next build"}
                    </h3>
                    <p>
                      {search
                        ? "Try a different search."
                        : "Add a project to share it on your portfolio."}
                    </p>
                  </div>
                ) : (
                  filteredProjects.map(project => (
                    <article className="admin-project" key={project.id}>
                      <div className="admin-project-preview">
                        <ProjectCover project={project} />
                      </div>
                      <div className="admin-project-info">
                        <h3>{project.title}</h3>
                        <p>
                          {project.category} · {project.year}
                          {project.featured && " · Featured"}
                        </p>
                        <div className="tags">
                          {project.technologies.slice(0, 4).map(t => (
                            <span key={t}>{t}</span>
                          ))}
                        </div>
                      </div>
                      <span
                        className={
                          project.published
                            ? "admin-badge published"
                            : "admin-badge"
                        }
                      >
                        {project.published ? "Published" : "Draft"}
                      </span>
                      <div className="icon-actions">
                        <button
                          aria-label={`Edit ${project.title}`}
                          onClick={() => setEditor(project)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="danger"
                          aria-label={`Delete ${project.title}`}
                          onClick={() =>
                            setDeleteItem({
                              type: "projects",
                              id: project.id,
                              name: project.title,
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            )
          ) : messages.isPending ? (
            <p className="empty-state">Loading messages…</p>
          ) : messages.isError ? (
            <div className="inline-error">
              <p>Unable to load messages.</p>
              <button
                className="button outline"
                onClick={() => messages.refetch()}
              >
                Retry
              </button>
            </div>
          ) : (
            <div>
              {filteredMessages.length === 0 ? (
                <div className="admin-empty">
                  <Inbox size={30} />
                  <h3>
                    {search
                      ? "No matching messages"
                      : "A little quiet, for now."}
                  </h3>
                  <p>
                    {search
                      ? "Try another name, email or subject."
                      : "Messages sent through your contact form will appear here."}
                  </p>
                </div>
              ) : (
                filteredMessages.map(message => (
                  <article
                    className={`message-card ${message.status}`}
                    key={message.id}
                  >
                    <div className="message-summary">
                      <button
                        className="message-open"
                        onClick={() => openMessage(message)}
                        aria-expanded={openedMessage === message.id}
                      >
                        <div>
                          <strong>{message.name}</strong>
                          <small>
                            {new Date(message.createdAt).toLocaleDateString(
                              "en",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </small>
                        </div>
                        <p>{message.subject}</p>
                      </button>
                      <span className="admin-badge">{message.status}</span>
                      <div className="icon-actions">
                        <button
                          className="danger"
                          aria-label={`Delete message from ${message.name}`}
                          onClick={() =>
                            setDeleteItem({
                              type: "messages",
                              id: message.id,
                              name: message.subject,
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {openedMessage === message.id && (
                      <div className="message-body">
                        <a href={`mailto:${message.email}`}>
                          <Mail size={13} />
                          {message.email} <ArrowUpRight size={12} />
                        </a>
                        <p>{message.message}</p>
                        <div>
                          <button
                            className="button outline"
                            onClick={() =>
                              updateMessage(
                                message,
                                message.status === "unread" ? "read" : "unread"
                              )
                            }
                          >
                            <MailOpen size={13} />
                            {message.status === "unread"
                              ? "Mark as read"
                              : "Mark as unread"}
                          </button>
                          <button
                            className="button outline"
                            onClick={() =>
                              updateMessage(
                                message,
                                message.status === "archived"
                                  ? "read"
                                  : "archived"
                              )
                            }
                          >
                            <Archive size={13} />
                            {message.status === "archived"
                              ? "Restore"
                              : "Archive"}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          )}
        </main>
      )}
      <ProjectEditor
        project={editor}
        close={() => setEditor(null)}
        saved={async () => {
          await client.invalidateQueries({ queryKey: ["admin", "projects"] });
          await client.invalidateQueries({ queryKey: ["projects"] });
        }}
      />
      <Dialog.Root
        open={!!deleteItem}
        onOpenChange={open => {
          if (!open && !busy) setDeleteItem(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content className="modal confirm-modal">
            <Dialog.Close
              className="modal-close"
              aria-label="Cancel deletion"
              disabled={busy}
            >
              <X size={20} />
            </Dialog.Close>
            <AlertTriangle size={25} color="#ebaa9c" />
            <Dialog.Title>
              Delete this{" "}
              {deleteItem?.type === "projects" ? "project" : "message"}?
            </Dialog.Title>
            <Dialog.Description>
              “{deleteItem?.name}” will be permanently removed. This can’t be
              undone.
            </Dialog.Description>
            <div className="modal-actions">
              <button
                className="button outline"
                disabled={busy}
                onClick={() => setDeleteItem(null)}
              >
                Keep it
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={remove}
              >
                {busy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function ProjectEditor({
  project,
  close,
  saved,
}: {
  project: PortfolioProject | null;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [form, setForm] = useState(blankProject);
  const [tech, setTech] = useState("");
  const [highlights, setHighlights] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (project) {
      setForm({ ...project });
      setTech(project.technologies.join(", "));
      setHighlights(project.highlights.join("\n"));
      setError("");
    }
  }, [project]);
  function change<K extends keyof PortfolioProject>(
    key: K,
    value: PortfolioProject[K]
  ) {
    setForm(prev => ({ ...prev, [key]: value }));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { id, ...payload } = {
      ...form,
      technologies: tech
        .split(",")
        .map(t => t.trim())
        .filter(Boolean),
      highlights: highlights
        .split("\n")
        .map(t => t.trim())
        .filter(Boolean),
    };
    if (
      payload.technologies.length > 20 ||
      payload.technologies.some(t => t.length > 60)
    ) {
      setError("Use up to 20 technologies, each no longer than 60 characters.");
      setBusy(false);
      return;
    }
    if (
      payload.highlights.length > 12 ||
      payload.highlights.some(t => t.length > 500)
    ) {
      setError("Use up to 12 highlights, each no longer than 500 characters.");
      setBusy(false);
      return;
    }
    try {
      await api(
        id
          ? `/api/admin/projects/${encodeURIComponent(id)}`
          : "/api/admin/projects",
        { method: id ? "PUT" : "POST", body: JSON.stringify(payload) }
      );
      await saved();
      toast.success(id ? "Project updated." : "Project added.");
      close();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save this project."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog.Root
      open={!!project}
      onOpenChange={open => {
        if (!open && !busy) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal editor-modal">
          <Dialog.Close
            className="modal-close"
            aria-label="Close project editor"
            disabled={busy}
          >
            <X size={20} />
          </Dialog.Close>
          <span className="eyebrow">PROJECT WORKSPACE</span>
          <Dialog.Title>
            {project?.id ? "Edit project" : "A new piece of work"}
          </Dialog.Title>
          <Dialog.Description>
            Share the problem, the build, and what makes it worth exploring.
          </Dialog.Description>
          <form className="editor-form" onSubmit={submit}>
            <div className="form-row">
              <label>
                Project title
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={form.title}
                  onChange={e => change("title", e.target.value)}
                  placeholder="Project name"
                />
              </label>
              <label>
                Year / timeframe
                <input
                  required
                  maxLength={30}
                  value={form.year}
                  onChange={e => change("year", e.target.value)}
                  placeholder="2026 or Ongoing"
                />
              </label>
            </div>
            <label>
              Subtitle
              <input
                maxLength={200}
                value={form.subtitle}
                onChange={e => change("subtitle", e.target.value)}
                placeholder="A short, memorable description"
              />
            </label>
            <label>
              Description
              <textarea
                required
                minLength={10}
                maxLength={5000}
                value={form.description}
                onChange={e => change("description", e.target.value)}
                placeholder="What does the project do?"
              />
            </label>
            <div className="form-row">
              <label>
                Category
                <select
                  value={form.category}
                  onChange={e =>
                    change(
                      "category",
                      e.target.value as PortfolioProject["category"]
                    )
                  }
                >
                  <option>Full-stack</option>
                  <option>Web application</option>
                </select>
              </label>
              <label>
                Project status
                <input
                  required
                  maxLength={80}
                  value={form.status}
                  onChange={e => change("status", e.target.value)}
                />
              </label>
            </div>
            <label>
              Technologies <span className="muted">Separated by commas</span>
              <input
                maxLength={1300}
                value={tech}
                onChange={e => setTech(e.target.value)}
                placeholder="React, Node.js, MongoDB"
              />
            </label>
            <label>
              Project highlights{" "}
              <span className="muted">One highlight per line</span>
              <textarea
                maxLength={6100}
                value={highlights}
                onChange={e => setHighlights(e.target.value)}
                placeholder="Responsive React frontend\nSecure REST API"
              />
            </label>
            <div className="form-row">
              <label>
                Cover design
                <select
                  value={form.cover}
                  onChange={e =>
                    change("cover", e.target.value as PortfolioProject["cover"])
                  }
                >
                  <option value="portfolio">Developer portfolio</option>
                  <option value="delivery">Local delivery</option>
                  <option value="banking">Banking workspace</option>
                </select>
              </label>
              <label>
                Display order
                <input
                  type="number"
                  min={0}
                  max={100000}
                  required
                  value={form.order}
                  onChange={e => change("order", Number(e.target.value))}
                />
              </label>
            </div>
            <label>
              Custom cover URL{" "}
              <span className="muted">
                Optional — replaces the illustrative cover
              </span>
              <input
                maxLength={2048}
                value={form.imageUrl}
                onChange={e => change("imageUrl", e.target.value)}
                placeholder="https://… or /manus-storage/…"
              />
            </label>
            <div className="form-row">
              <label>
                GitHub URL <span className="muted">Optional</span>
                <input
                  type="url"
                  maxLength={2048}
                  value={form.githubUrl}
                  onChange={e => change("githubUrl", e.target.value)}
                  placeholder="https://github.com/…"
                />
              </label>
              <label>
                Live website URL <span className="muted">Optional</span>
                <input
                  type="url"
                  maxLength={2048}
                  value={form.liveUrl}
                  onChange={e => change("liveUrl", e.target.value)}
                  placeholder="https://…"
                />
              </label>
            </div>
            <div className="editor-checks">
              <label>
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={e => change("published", e.target.checked)}
                />{" "}
                Published
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={e => change("featured", e.target.checked)}
                />{" "}
                Featured project
              </label>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="editor-actions">
              <button
                type="button"
                className="button outline"
                onClick={close}
                disabled={busy}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy} type="submit">
                {busy ? (
                  <Loader2 className="spin" size={15} />
                ) : (
                  <Check size={15} />
                )}{" "}
                {busy ? "Saving…" : "Save project"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
