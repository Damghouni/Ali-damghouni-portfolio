export type ProjectCategory = "Full-stack" | "Web application";
export interface PortfolioProject {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: ProjectCategory;
  year: string;
  technologies: string[];
  status: string;
  featured: boolean;
  published: boolean;
  cover: "delivery" | "banking" | "portfolio";
  imageUrl: string;
  githubUrl: string;
  liveUrl: string;
  highlights: string[];
  order: number;
}
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "unread" | "read" | "archived";
  createdAt: string;
}
export const initialProjects: PortfolioProject[] = [
  {
    id: "amieroute",
    title: "AmieRoute",
    subtitle: "Local delivery. Without borders.",
    description:
      "A multilingual delivery platform connecting local shops, restaurants and their communities. Built with real-time communication and role-based access.",
    category: "Full-stack",
    year: "Ongoing",
    technologies: ["Next.js", "TypeScript", "Node.js", "MongoDB", "Socket.IO"],
    status: "In development",
    featured: true,
    published: true,
    cover: "delivery",
    imageUrl: "",
    githubUrl: "https://github.com/Damghouni/Amieroute",
    liveUrl: "",
    highlights: [
      "German, French and Arabic interfaces with next-intl.",
      "React, Next.js, Tailwind CSS and Zustand frontend.",
      "Express REST API with MongoDB/Mongoose and Socket.IO.",
      "Authentication, role-based permissions and API security.",
      "Docker containerization with backend health checks.",
    ],
    order: 0,
  },
  {
    id: "biat-credit",
    title: "BIAT Credit Portal",
    subtitle: "Making banking workflows simpler.",
    description:
      "A graduation project for submitting and tracking credit applications, with branch-transfer workflows and integrated business modules.",
    category: "Web application",
    year: "2012",
    technologies: ["Java", "Spring MVC", "MySQL", "JavaScript"],
    status: "Graduation project",
    featured: false,
    published: true,
    cover: "banking",
    imageUrl: "",
    githubUrl: "",
    liveUrl: "",
    highlights: [
      "Credit application submission and status tracking.",
      "Bank branch-transfer workflow.",
      "Business-module design and integration.",
      "Application testing and validation during the BIAT internship.",
      "Java, Spring MVC, HTML, CSS, jQuery, MySQL and Apache Tomcat.",
    ],
    order: 1,
  },
  {
    id: "developer-portfolio",
    title: "Developer Portfolio",
    subtitle: "A home for the work behind the code.",
    description:
      "This responsive portfolio pairs a React interface with an Express API, MongoDB project management and a protected administration dashboard.",
    category: "Full-stack",
    year: "2026",
    technologies: ["React", "Express.js", "MongoDB", "TypeScript"],
    status: "This website",
    featured: false,
    published: true,
    cover: "portfolio",
    imageUrl: "",
    githubUrl: "",
    liveUrl: "",
    highlights: [
      "Responsive, accessible React interface with restrained motion.",
      "Express REST API and MongoDB/Mongoose data models.",
      "Validated contact submissions and message management.",
      "Owner-only authenticated project administration.",
    ],
    order: 2,
  },
];
