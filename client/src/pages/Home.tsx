import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  ArrowDown,
  ArrowRight,
  Github,
  Linkedin,
  MapPin,
  Download,
  Sun,
  Moon,
  Menu,
  X,
  Code2,
  Braces,
  Database,
  Terminal,
  Globe2,
  Mail,
  Check,
  Send,
  Loader2,
  Copy,
  ShieldCheck,
  Network,
} from "lucide-react";
import { Link } from "wouter";
import ProjectCard from "@/components/ProjectCard";
import { api } from "@/lib/api";
import type { PortfolioProject } from "@shared/portfolio";

const sections = [
  "Home",
  "About",
  "Skills",
  "Projects",
  "Experience",
  "Contact",
];
const skills = [
  {
    icon: Code2,
    name: "Frontend",
    caption: "Interfaces that feel right.",
    items: [
      "React",
      "Next.js",
      "TypeScript",
      "JavaScript (ES6+)",
      "HTML5",
      "CSS3",
      "Tailwind CSS",
      "next-intl",
      "Zustand",
    ],
  },
  {
    icon: Braces,
    name: "Backend & real-time",
    caption: "A solid foundation underneath.",
    items: [
      "Node.js",
      "Express.js",
      "REST APIs",
      "Socket.IO",
      "Authentication & RBAC",
    ],
  },
  {
    icon: Database,
    name: "Databases",
    caption: "Data, thoughtfully structured.",
    items: ["MongoDB", "Mongoose", "MySQL", "SQL", "HyperFileSQL"],
  },
  {
    icon: Terminal,
    name: "DevOps & systems",
    caption: "From local development to delivery.",
    items: [
      "Git",
      "GitHub",
      "Docker",
      "Linux",
      "GitHub Actions",
      "CI/CD · fundamentals",
      "Kubernetes · fundamentals",
    ],
  },
];
function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={
        reduced || typeof window === "undefined" ? false : { opacity: 0, y: 22 }
      }
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
function SectionLabel({ number, title }: { number: string; title: string }) {
  return (
    <div className="section-label">
      <span>{number}</span>
      <span>{title}</span>
    </div>
  );
}

export default function Home() {
  const [active, setActive] = useState("Home");
  const [menu, setMenu] = useState(false);
  const [light, setLight] = useState(false);
  const [filter, setFilter] = useState("All projects");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    website: "",
  });
  const [formStatus, setFormStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [error, setError] = useState("");
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<{ projects: PortfolioProject[] }>("/api/projects"),
    retry: 1,
  });
  const projects = projectsQuery.data?.projects ?? [];
  const visible = projects.filter(
    p => filter === "All projects" || p.category === filter
  );
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [light]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries)
          if (entry.isIntersecting)
            setActive(
              entry.target.id[0].toUpperCase() + entry.target.id.slice(1)
            );
      },
      { rootMargin: "-20% 0px -55% 0px" }
    );
    sections.forEach(name => {
      const el = document.getElementById(name.toLowerCase());
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);
  async function submitContact(e: React.FormEvent) {
    e.preventDefault();
    setFormStatus("sending");
    setError("");
    try {
      await api("/api/contact", { method: "POST", body: JSON.stringify(form) });
      setFormStatus("success");
      setForm({ name: "", email: "", subject: "", message: "", website: "" });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send your message. Please try again."
      );
      setFormStatus("error");
    }
  }
  async function copyEmail() {
    try {
      await navigator.clipboard.writeText("ali.damghouni@gmail.com");
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.location.href = "mailto:ali.damghouni@gmail.com";
    }
  }
  return (
    <div className="portfolio-site">
      <header className="site-header">
        <div className="shell header-inner">
          <a className="wordmark" href="#home" aria-label="Ali Damghouni home">
            AD<span className="logo-slash">/</span>
            <span className="wordmark-name">ali.damghouni</span>
          </a>
          <nav
            className={menu ? "main-nav open" : "main-nav"}
            aria-label="Main navigation"
          >
            {sections.slice(0, 5).map(name => (
              <a
                key={name}
                className={active === name ? "active" : ""}
                href={`#${name.toLowerCase()}`}
                onClick={() => setMenu(false)}
              >
                {name}
              </a>
            ))}
            <a
              className="mobile-contact"
              href="#contact"
              onClick={() => setMenu(false)}
            >
              Contact
            </a>
          </nav>
          <div className="header-actions">
            <button
              className="theme-toggle"
              aria-label={
                light ? "Switch to dark theme" : "Switch to light theme"
              }
              onClick={() => setLight(!light)}
            >
              {light ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <a className="header-contact" href="#contact">
              Let’s talk <ArrowUpRight size={16} />
            </a>
            <button
              className="menu-toggle"
              aria-label={menu ? "Close navigation" : "Open navigation"}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main>
        <section id="home" className="hero shell">
          <div className="hero-copy">
            <Reveal>
              <div className="availability">
                <span className="status-dot" /> Open to new opportunities
              </div>
              <p className="eyebrow hero-eyebrow">FULL-STACK WEB DEVELOPER</p>
              <h1>
                Thoughtful code.
                <br />
                Meaningful
                <br />
                <span>experiences.</span>
              </h1>
              <p className="hero-description">
                I’m <strong>Ali Damghouni.</strong> I turn complex ideas into
                reliable,
                <br className="desktop-break" /> intuitive web applications —
                from frontend to backend.
              </p>
              <div className="hero-ctas">
                <a className="button primary" href="#projects">
                  Explore my work <ArrowUpRight size={18} />
                </a>
                <a
                  className="button resume-link"
                  href="/Ali-Damghouni-CV.pdf"
                  download
                >
                  Download CV <Download size={17} />
                </a>
              </div>
              <div className="hero-social">
                <span>
                  <MapPin size={14} /> Quedlinburg, Germany
                </span>
                <i />
                <a
                  href="https://github.com/Damghouni"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ali on GitHub"
                >
                  <Github size={18} />
                </a>
                <a
                  href="https://www.linkedin.com/in/ali-damghouni-a93907366"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ali on LinkedIn"
                >
                  <Linkedin size={18} />
                </a>
              </div>
            </Reveal>
          </div>
          <Reveal className="hero-visual">
            <div className="art-grid" />
            <img
              className="hero-art"
              src="/manus-storage/async-images/8MFZ52XWlMF2vDd8EsIPQn/image-1.webp"
              alt="Abstract chrome loop with a lime sphere, representing connected systems"
              fetchPriority="high"
            />
            <div className="art-label art-label-top">
              <span className="tiny-lime">
                <Code2 size={15} />
              </span>{" "}
              Built with purpose.
            </div>
            <div className="code-chip">
              <div>
                <span className="code-dots">● ● ●</span>
                <span>developer.ts</span>
              </div>
              <code>
                <span>const</span> developer = {"{"}
                <br />
                &nbsp; name: <em>"Ali Damghouni"</em>,<br />
                &nbsp; focus: <em>"Full-stack"</em>,<br />
                &nbsp; mindset: <em>"Always learning"</em>
                <br />
                {"}"};
              </code>
            </div>
            <div className="art-caption">
              <span>01 — IDEAS INTO INTERFACES</span>
              <span>↗</span>
            </div>
          </Reveal>
          <a className="scroll-hint" href="#projects">
            <ArrowDown size={15} /> Scroll to discover
          </a>
        </section>
        <div className="stack-strip">
          <div className="shell stack-inner">
            <span className="stack-intro">MY EVERYDAY TOOLKIT</span>
            <span>
              <Code2 /> React
            </span>
            <span className="next-logo">
              N<span>Next.js</span>
            </span>
            <span>
              <Braces /> TypeScript
            </span>
            <span>
              <Network /> Node.js
            </span>
            <span>
              <Database /> MongoDB
            </span>
            <span>
              <Terminal /> Docker
            </span>
          </div>
        </div>
        <section id="projects" className="shell section projects-section">
          <Reveal>
            <SectionLabel number="01" title="SELECTED WORK" />
            <div className="section-heading">
              <div>
                <h2>
                  Built to solve.
                  <br />
                  <span className="muted-heading">Designed to matter.</span>
                </h2>
                <p>
                  A selection of personal and academic work.
                  <br />
                  Different challenges. The same attention to detail.
                </p>
              </div>
              <a
                className="text-link"
                href="https://github.com/Damghouni"
                target="_blank"
                rel="noopener noreferrer"
              >
                More on GitHub <ArrowUpRight size={17} />
              </a>
            </div>
            <div className="filter-bar">
              {["All projects", "Full-stack", "Web application"].map(f => (
                <button
                  key={f}
                  className={filter === f ? "filter active" : "filter"}
                  onClick={() => setFilter(f)}
                >
                  {f}
                  {f === "All projects" && (
                    <span>{projects.length.toString().padStart(2, "0")}</span>
                  )}
                </button>
              ))}
              <span className="filter-note">FROM CONCEPT TO CODE</span>
            </div>
          </Reveal>
          <div className="projects-grid">
            {projectsQuery.isPending ? (
              Array.from({ length: 3 }, (_, i) => (
                <div className="project-skeleton" key={i}>
                  <div />
                  <span />
                  <span />
                </div>
              ))
            ) : projectsQuery.isError ? (
              <div className="inline-error">
                <p>Projects couldn’t be loaded.</p>
                <button
                  className="button outline"
                  onClick={() => projectsQuery.refetch()}
                >
                  Try again
                </button>
              </div>
            ) : (
              visible.map((project, i) => (
                <Reveal key={project.id}>
                  <ProjectCard project={project} index={i} />
                </Reveal>
              ))
            )}
          </div>
          {!projectsQuery.isPending &&
            !projectsQuery.isError &&
            visible.length === 0 && (
              <p className="empty-state">No projects in this category yet.</p>
            )}
        </section>
        <section id="about" className="about-section">
          <div className="shell about-layout">
            <Reveal>
              <SectionLabel number="02" title="A LITTLE ABOUT ME" />
              <h2>
                A builder’s mindset.
                <br />
                <span className="muted-heading">An IT foundation.</span>
              </h2>
              <div className="about-monogram">
                <span>AD</span>
                <Code2 size={34} strokeWidth={1.2} />
                <small>DEVELOPER. PROBLEM SOLVER. LIFELONG LEARNER.</small>
              </div>
            </Reveal>
            <Reveal className="about-content">
              <p className="large-copy">
                I connect the dots between
                <br />
                great interfaces and dependable systems.
              </p>
              <p>
                Based in Quedlinburg, Germany, I’m a full-stack web developer
                with a background in applied computer science and hands-on
                experience in IT administration, networks and technical support.
              </p>
              <p>
                Today, I focus on the JavaScript ecosystem — building with
                React, Next.js and Node.js. My IT background brings a
                security-conscious, practical perspective to every application I
                create.
              </p>
              <div className="about-values">
                <span>
                  <ShieldCheck size={16} /> Security-conscious
                </span>
                <span>
                  <Code2 size={16} /> Detail-oriented
                </span>
                <span>
                  <ArrowUpRight size={16} /> Always learning
                </span>
              </div>
              <div className="education">
                <div>
                  <span className="small-label">2023 — 2024</span>
                  <h3>Full-Stack JavaScript</h3>
                  <p>GoMyCode · Professional training</p>
                </div>
                <div>
                  <span className="small-label">2008 — 2012</span>
                  <h3>Applied Computer Science</h3>
                  <p>
                    Multimedia & Web · ISEAH Kef
                    <br />
                    University of Jendouba, Tunisia
                  </p>
                </div>
              </div>
              <div className="languages">
                <Globe2 size={17} />
                <span>Arabic</span>
                <i />
                <span>French</span>
                <i />
                <span>German</span>
                <i />
                <span>English</span>
              </div>
            </Reveal>
          </div>
        </section>
        <section id="skills" className="shell section">
          <Reveal>
            <SectionLabel number="03" title="SKILLS & TOOLKIT" />
            <div className="section-heading">
              <div>
                <h2>
                  The right tools.
                  <br />
                  <span className="muted-heading">A thoughtful approach.</span>
                </h2>
              </div>
              <p className="heading-sidecopy">
                From the first component to the final endpoint,
                <br />I care about how every piece fits together.
              </p>
            </div>
          </Reveal>
          <div className="skills-list">
            {skills.map((skill, i) => (
              <Reveal key={skill.name}>
                <div className="skill-row">
                  <div className="skill-icon">
                    <skill.icon size={24} strokeWidth={1.4} />
                  </div>
                  <div className="skill-title">
                    <small>0{i + 1}</small>
                    <h3>{skill.name}</h3>
                    <p>{skill.caption}</p>
                  </div>
                  <div className="skill-tags">
                    {skill.items.map(s => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="skills-footnote">
            <Network size={15} /> Also grounded in network administration,
            TCP/IP, hardware & software support, and access control.
          </p>
        </section>
        <section id="experience" className="experience-section">
          <div className="shell experience-layout">
            <Reveal className="experience-heading">
              <SectionLabel number="04" title="THE JOURNEY SO FAR" />
              <h2>
                Experience
                <br />
                <span className="muted-heading">that adds up.</span>
              </h2>
              <p>
                A path from IT infrastructure
                <br />
                to full-stack development.
              </p>
              <a className="text-link" href="/Ali-Damghouni-CV.pdf" download>
                View full résumé <Download size={16} />
              </a>
            </Reveal>
            <div className="timeline">
              <Reveal>
                <article className="timeline-item">
                  <div className="timeline-date">
                    FEB 2017 — AUG 2020<span>PROFESSIONAL EXPERIENCE</span>
                  </div>
                  <h3>IT Administrator</h3>
                  <h4>
                    Mövenpick Hotel du Lac <span>· Tunis, Tunisia</span>
                  </h4>
                  <p>Kept hotel operations connected, reliable and secure.</p>
                  <ul>
                    <li>
                      Operated and monitored IT systems and network
                      infrastructure.
                    </li>
                    <li>
                      Administered servers, workstations, hardware and software.
                    </li>
                    <li>
                      Provided first- and second-level technical support across
                      hotel departments.
                    </li>
                  </ul>
                  <div className="tags">
                    <span>IT Operations</span>
                    <span>Networking</span>
                    <span>Technical Support</span>
                  </div>
                </article>
              </Reveal>
              <Reveal>
                <article className="timeline-item">
                  <div className="timeline-date">
                    FEB — JUL 2012<span>INTERNSHIP & GRADUATION PROJECT</span>
                  </div>
                  <h3>Networks & IT Maintenance Intern</h3>
                  <h4>
                    BIAT <span>· Tunisia</span>
                  </h4>
                  <p>
                    Developed a web application for credit requests and branch
                    transfers, from business-module design through testing and
                    validation.
                  </p>
                  <div className="tags">
                    <span>Java</span>
                    <span>Spring MVC</span>
                    <span>MySQL</span>
                  </div>
                </article>
              </Reveal>
              <Reveal>
                <article className="timeline-item">
                  <div className="timeline-date">
                    JUN 2011<span>INTERNSHIP</span>
                  </div>
                  <h3>Banking Web Systems Research</h3>
                  <h4>
                    BIAT <span>· Tunisia</span>
                  </h4>
                  <p>
                    Analyzed banking web architectures, dynamic interfaces and
                    online banking systems, with a focus on IT security and data
                    privacy.
                  </p>
                  <div className="tags">
                    <span>Web Architecture</span>
                    <span>IT Security</span>
                  </div>
                </article>
              </Reveal>
            </div>
          </div>
        </section>
        <section id="contact" className="shell section contact-section">
          <div className="contact-layout">
            <Reveal>
              <SectionLabel number="05" title="LET’S CONNECT" />
              <h2>
                Good things start
                <br />
                <span>with a conversation.</span>
              </h2>
              <p>
                Have a role in mind, a project to discuss,
                <br />
                or simply want to say hello? I’d love to hear from you.
              </p>
              <a
                className="contact-email"
                href="mailto:ali.damghouni@gmail.com"
              >
                ali.damghouni@gmail.com <ArrowUpRight size={20} />
              </a>
              <div className="contact-links">
                <button onClick={copyEmail}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? "Email copied" : "Copy email"}
                </button>
                <a
                  href="https://github.com/Damghouni"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github size={17} /> GitHub <ArrowUpRight size={13} />
                </a>
                <a
                  href="https://www.linkedin.com/in/ali-damghouni-a93907366"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Linkedin size={17} /> LinkedIn <ArrowUpRight size={13} />
                </a>
              </div>
              <div className="contact-location">
                <MapPin size={16} />
                <span>
                  Quedlinburg, Germany
                  <br />
                  <small>Open to discussing remote opportunities.</small>
                </span>
              </div>
            </Reveal>
            <Reveal>
              <form className="contact-form" onSubmit={submitContact}>
                <div className="form-top">
                  <Mail size={19} />
                  <h3>Drop me a message</h3>
                  <span>↗</span>
                </div>
                <div className="form-row">
                  <label>
                    Your name
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      name="name"
                      autoComplete="name"
                      placeholder="Alex Morgan"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                    />
                  </label>
                  <label>
                    Email address
                    <input
                      required
                      type="email"
                      maxLength={320}
                      name="email"
                      autoComplete="email"
                      placeholder="alex@company.com"
                      value={form.email}
                      onChange={e =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label>
                  What’s on your mind?
                  <input
                    required
                    minLength={2}
                    maxLength={160}
                    name="subject"
                    placeholder="A new opportunity, a project, a hello…"
                    value={form.subject}
                    onChange={e =>
                      setForm({ ...form, subject: e.target.value })
                    }
                  />
                </label>
                <label>
                  Your message
                  <textarea
                    required
                    minLength={10}
                    maxLength={5000}
                    name="message"
                    rows={4}
                    placeholder="Tell me a little about it…"
                    value={form.message}
                    onChange={e =>
                      setForm({ ...form, message: e.target.value })
                    }
                  />
                </label>
                <div className="honeypot" aria-hidden="true">
                  <label>
                    Website
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      name="website"
                      value={form.website}
                      onChange={e =>
                        setForm({ ...form, website: e.target.value })
                      }
                    />
                  </label>
                </div>
                <button
                  className="button primary send-button"
                  type="submit"
                  disabled={formStatus === "sending"}
                >
                  {formStatus === "sending" ? (
                    <>
                      <Loader2 className="spin" size={17} /> Sending…
                    </>
                  ) : (
                    <>
                      Send message <ArrowUpRight size={18} />
                    </>
                  )}
                </button>
                <div aria-live="polite">
                  {formStatus === "success" && (
                    <p className="form-success">
                      <Check size={16} /> Thanks! Your message has been saved.
                      I’ll be in touch.
                    </p>
                  )}
                  {formStatus === "error" && (
                    <p className="form-error">
                      {error} You can also contact me directly by email.
                    </p>
                  )}
                </div>
                <p className="form-privacy">
                  <ShieldCheck size={12} /> Your details are only used to
                  respond to your message.
                </p>
              </form>
            </Reveal>
          </div>
        </section>
      </main>
      <footer className="site-footer shell">
        <a className="wordmark" href="#home">
          AD<span className="logo-slash">/</span>
        </a>
        <p>
          © {new Date().getFullYear()} Ali Damghouni <span>·</span> Built with
          intention.
        </p>
        <div>
          <Link className="admin-footer" href="/admin">
            Admin
          </Link>
          <a href="#home">
            Back to top <ArrowUpRight size={14} />
          </a>
        </div>
      </footer>
    </div>
  );
}
