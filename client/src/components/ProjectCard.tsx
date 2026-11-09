import {
  ArrowUpRight,
  ArrowRight,
  Github,
  MapPin,
  ShoppingBag,
  Layers,
  ShieldCheck,
  Code2,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { PortfolioProject } from "@shared/portfolio";

export function ProjectCover({ project }: { project: PortfolioProject }) {
  if (project.imageUrl)
    return (
      <img
        className="project-image"
        src={project.imageUrl}
        alt={`${project.title} project preview`}
        loading="lazy"
      />
    );
  return (
    <div className={`project-art art-${project.cover}`} aria-hidden="true">
      {project.cover === "delivery" ? (
        <>
          <div className="preview-browser">
            <div className="browser-top">
              <span className="browser-dots">● ● ●</span>
              <span>amieroute</span>
            </div>
            <div className="delivery-screen">
              <div className="mini-nav">
                <b>
                  <MapPin size={13} /> amie<span>route</span>
                </b>
                <span>Discover · Local favorites</span>
              </div>
              <div className="delivery-head">
                <small>GOOD THINGS, CLOSE TO HOME</small>
                <strong>
                  Your neighborhood.
                  <br />
                  Delivered.
                </strong>
                <div className="mini-search">
                  <MapPin size={10} /> Explore local shops{" "}
                  <ArrowRight size={11} />
                </div>
              </div>
              <div className="food-row">
                <div className="food-tile">
                  <ShoppingBag size={22} />
                  <small>Fresh & local</small>
                </div>
                <div className="food-tile">
                  <MapPin size={22} />
                  <small>Made with love</small>
                </div>
                <div className="food-tile">
                  <Layers size={22} />
                  <small>Your daily favorites</small>
                </div>
              </div>
            </div>
          </div>
          <div className="preview-float">
            <ShoppingBag size={13} />
            <span>Local. Connected.</span>
          </div>
        </>
      ) : project.cover === "banking" ? (
        <>
          <div className="preview-browser banking-browser">
            <div className="browser-top">
              <span className="browser-dots">● ● ●</span>
              <span>Credit management</span>
            </div>
            <div className="bank-screen">
              <aside>
                <b>
                  BIAT<span> / </span>
                </b>
                <small>Overview</small>
                <small className="selected">Applications</small>
                <small>Branches</small>
                <small>Settings</small>
              </aside>
              <div className="bank-main">
                <small>WORKSPACE / APPLICATIONS</small>
                <strong>A clearer way forward.</strong>
                <div className="bank-stats">
                  <div>
                    <small>Applications</small>
                    <b>24</b>
                  </div>
                  <div>
                    <small>In review</small>
                    <b>08</b>
                  </div>
                  <div>
                    <small>Approved</small>
                    <b>16</b>
                  </div>
                </div>
                <div className="bank-table">
                  <span>
                    Application <i>Status</i>
                  </span>
                  <span>
                    Credit request #001 <em>In review</em>
                  </span>
                  <span>
                    Credit request #002 <em>Approved</em>
                  </span>
                  <span>
                    Branch transfer <em>Approved</em>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="preview-float">
            <ShieldCheck size={13} />
            <span>Structured by design.</span>
          </div>
        </>
      ) : (
        <>
          <div className="preview-browser portfolio-browser">
            <div className="browser-top">
              <span className="browser-dots">● ● ●</span>
              <span>ali.dev / portfolio</span>
            </div>
            <div className="portfolio-screen">
              <div className="mini-nav">
                <b>
                  AD<span> / </span>
                </b>
                <span>About &nbsp; Work &nbsp; Contact ↗</span>
              </div>
              <small>FULL-STACK WEB DEVELOPER</small>
              <strong>
                Thoughtful code.
                <br />
                <span>Meaningful experiences.</span>
              </strong>
              <div className="mini-code">
                <Code2 size={40} strokeWidth={1} />
              </div>
              <div className="mini-cta">Explore my work ↗</div>
              <div className="mini-lines">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
          <div className="preview-float">
            <Layers size={13} />
            <span>Built end to end.</span>
          </div>
        </>
      )}
    </div>
  );
}

export function ProjectDetails({
  project,
  children,
}: {
  project: PortfolioProject;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal project-modal">
          <Dialog.Close
            className="modal-close"
            aria-label="Close project details"
          >
            <X size={22} />
          </Dialog.Close>
          <span className="eyebrow">
            {project.category} · {project.year}
            {project.featured && " · FEATURED PROJECT"}
          </span>
          <Dialog.Title>{project.title}</Dialog.Title>
          <Dialog.Description>{project.description}</Dialog.Description>
          <ProjectCover project={project} />
          <small className="illustrative-note">
            {project.imageUrl
              ? "Project image"
              : "Illustrative interface preview — not a production screenshot."}
          </small>
          <h3>Behind the build</h3>
          <ul className="project-highlights">
            {project.highlights.map(item => (
              <li key={item}>
                <ArrowRight size={15} />
                {item}
              </li>
            ))}
          </ul>
          <div className="tags">
            {project.technologies.map(t => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <div className="modal-actions">
            {project.githubUrl && (
              <a
                className="button primary"
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github size={17} /> Explore source <ArrowUpRight size={17} />
              </a>
            )}
            {project.liveUrl && (
              <a
                className="button outline"
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Live website <ArrowUpRight size={17} />
              </a>
            )}
            {!project.githubUrl && !project.liveUrl && (
              <p className="muted small">
                {project.cover === "banking"
                  ? "Academic work completed during the BIAT internship. Source code is not publicly available."
                  : "You’re exploring the live portfolio right now."}
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export default function ProjectCard({
  project,
  index,
}: {
  project: PortfolioProject;
  index: number;
}) {
  return (
    <article className="project-card">
      <ProjectDetails project={project}>
        <button
          className="project-cover-button"
          aria-label={`View ${project.title} details`}
        >
          <ProjectCover project={project} />
          <span className="project-status">{project.status}</span>
          {project.featured && (
            <span className="featured-badge">Featured ↗</span>
          )}
          <span className="cover-arrow">
            <ArrowUpRight size={20} />
          </span>
        </button>
      </ProjectDetails>
      <div className="project-meta">
        <span>
          {String(index + 1).padStart(2, "0")} / {project.category}
        </span>
        <span>{project.year}</span>
      </div>
      <div className="project-title-row">
        <ProjectDetails project={project}>
          <button className="project-title">{project.title}</button>
        </ProjectDetails>
        <ArrowUpRight size={19} />
      </div>
      <p>{project.description}</p>
      <div className="tags">
        {project.technologies.slice(0, 4).map(tech => (
          <span key={tech}>{tech}</span>
        ))}
      </div>
    </article>
  );
}
