import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  FiArrowRight,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiLogIn,
  FiMenu,
  FiUserCheck,
  FiUserPlus,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { FaChalkboardTeacher } from "react-icons/fa";

import logo1 from "../assets/logo1.webp";
import { DASHBOARD_PATH, SCHOOL_NAME } from "../constant/navigation";
import {
  DEFAULT_LANDING_CONTENT,
  clearLandingPreview,
  getIcon,
  readLandingPreview,
  subscribeToPreviewStore,
} from "../constant/landingContent";
import { useLandingContent } from "../hooks/useLandingContent";
import { useAuth } from "../hooks/useAuth";
import { useUser } from "../hooks/useUser";
import "../style/landingPage.css";

// ==================== Static content ====================

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Who it's for", href: "#who-its-for" },
  { label: "Contact", href: "#contact" },
];

const HERO_SLIDE_INTERVAL = 6000;

// ==================== Page ====================

function LandingPage() {
  const { loading, auth } = useAuth();
  const { user } = useUser();
  const { content } = useLandingContent();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeSection, setActiveSection] = useState("#home");
  const prefersReducedMotionRef = useRef(false);

  // ?preview escape hatch (plan §7.6, Decision #6): the editor publishes its
  // UNSAVED draft to localStorage; this page renders it for the developer.
  // Drafts go through the same fail-open shape guards as DB content, and a
  // missing/expired draft simply shows the published content. Local storage
  // is external state, so it's read through useSyncExternalStore (also keeps
  // the preview tab live when the editor tab re-publishes — the "storage"
  // event fires cross-tab).
  const isPreview = new URLSearchParams(location.search).has("preview");
  const preview = useSyncExternalStore(subscribeToPreviewStore, readLandingPreview, () => null);

  // Fail-open: render the defaults until the DB content arrives (or forever
  // if the API is down) — the page never blanks or toasts (plan §6.4).
  // Preview mode overrides with the editor's draft when one is stored.
  const landing = isPreview ? (preview ?? DEFAULT_LANDING_CONTENT) : (content ?? DEFAULT_LANDING_CONTENT);
  const slideCount = landing.hero.slides.length;

  // Keep the active slide in range if the slide list shrinks (DB edit).
  if (activeSlide >= slideCount) {
    setActiveSlide(0);
  }

  // Track reduced-motion so the slider stops auto-advancing for users who opt out.
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      prefersReducedMotionRef.current = media.matches;
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // Auto-advance the hero slider. Restarting on every slide change also resets
  // the timer after manual navigation (dots / arrows); slideCount is a dep so
  // a DB-driven slide-list change is picked up too.
  useEffect(() => {
    if (prefersReducedMotionRef.current) return;
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slideCount);
    }, HERO_SLIDE_INTERVAL);
    return () => window.clearInterval(timer);
  }, [activeSlide, slideCount]);

  // Mobile drawer: close on Escape and lock page scroll while open.
  useEffect(() => {
    if (!mobileNavOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  // Scroll-spy: highlight the nav link of the section currently in view.
  // A slim horizontal band around the viewport middle decides which section
  // counts as "active" while scrolling.
  useEffect(() => {
    if (loading) return;

    const sections = NAV_LINKS
      .map(({ href }) => document.getElementById(href.slice(1)))
      .filter((section): section is HTMLElement => section !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(`#${entry.target.id}`);
          }
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [loading]);

  // Scroll-reveal: fade sections in as they enter the viewport (once each).
  useEffect(() => {
    if (loading) return;

    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [loading]);

  const closeNav = () => setMobileNavOpen(false);
  const currentYear = new Date().getFullYear();
  // Preview-bar actions (rendered only when ?preview is present).
  const exitPreview = () => {
    window.location.assign("/developer/landing-content");
  };
  const discardPreview = () => {
    clearLandingPreview();
  };

  if (loading) {
    return (
      <div
        className="landing-splash"
        role="status"
        aria-live="polite"
        aria-label="Checking your session"
      >
        <div className="landing-splash__logo" aria-hidden="true">
          <img src={logo1} alt="" />
        </div>
        <p className="landing-splash__status">Loading…</p>
      </div>
    );
  }

  // ?preview: the signed-in developer stays here to review their draft
  // instead of being bounced to their dashboard (plan Decision #6).
  if (auth && user && !isPreview) {
    return <Navigate to={DASHBOARD_PATH[user.role]} replace />;
  }

  return (
    <main className="landing">
      {/* ---------- Preview bar (?preview only) ---------- */}
      {isPreview && (
        <div className="landing-preview-bar" role="region" aria-label="Landing page preview">
          <p className="landing-preview-bar__text">
            <FiEye aria-hidden="true" />
            {preview ? "Previewing unsaved changes" : "No unsaved draft — showing published content"}
            <span className="landing-preview-bar__hint">Only you can see this.</span>
          </p>
          <div className="landing-preview-bar__actions">
            <button type="button" className="landing-preview-bar__btn" onClick={discardPreview} disabled={!preview}>
              Discard draft
            </button>
            <button type="button" className="landing-preview-bar__btn landing-preview-bar__btn--primary" onClick={exitPreview}>
              Back to editor
            </button>
          </div>
        </div>
      )}

      {/* ---------- Topbar ---------- */}
      <header className="landing__topbar">
        <div className="landing__container">
          <a href="#home" className="landing-brand" onClick={closeNav}>
            <span className="landing-brand__logo">
              <img src={logo1} alt={`${SCHOOL_NAME} logo`} />
            </span>
            <span className="landing-brand__name">{SCHOOL_NAME}</span>
          </a>

          <nav className="landing-nav" aria-label="Main navigation">
            {NAV_LINKS.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className={`landing-nav__link${href === activeSection ? " landing-nav__link--active" : ""}`}
                aria-current={href === activeSection ? "true" : undefined}
              >
                {label}
              </a>
            ))}
            <Link to="/login" className="landing-nav__cta">
              <FiLogIn aria-hidden="true" />
              Sign in
            </Link>
          </nav>

          <button
            type="button"
            className="landing-nav__toggle"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileNavOpen}
            aria-controls="landing-drawer"
          >
            <FiMenu aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* ---------- Mobile drawer ---------- */}
      {mobileNavOpen && (
        <div
          className="landing-drawer__overlay"
          onClick={closeNav}
          aria-hidden="true"
        />
      )}
      <aside
        id="landing-drawer"
        className={`landing-drawer${mobileNavOpen ? " landing-drawer--open" : ""}`}
        aria-label="Mobile navigation"
        aria-hidden={!mobileNavOpen}
      >
        <div className="landing-drawer__head">
          <span className="landing-drawer__brand">
            <span className="landing-drawer__logo">
              <img src={logo1} alt="" />
            </span>
            <span className="landing-drawer__name">{SCHOOL_NAME}</span>
          </span>
          <button
            type="button"
            className="landing-drawer__close"
            onClick={closeNav}
            aria-label="Close navigation menu"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>

        <nav className="landing-drawer__nav" aria-label="Mobile">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className={`landing-drawer__link${href === activeSection ? " landing-drawer__link--active" : ""}`}
              aria-current={href === activeSection ? "true" : undefined}
              onClick={closeNav}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="landing-drawer__footer">
          <Link to="/login" className="landing-drawer__cta" onClick={closeNav}>
            <FiLogIn aria-hidden="true" />
            Sign in to GradeSync
          </Link>
          <p className="landing-drawer__hint">Students, teachers and admins use the same sign-in.</p>
        </div>
      </aside>

      {/* ---------- Hero (sliding background) ---------- */}
      <section id="home" className="landing-hero">
        <div className="landing-hero__slides" aria-hidden="true">
          {landing.hero.slides.map((slide, index) => (
            <div
              key={`${slide.label}-${index}`}
              className={`landing-hero__slide${index === activeSlide ? " landing-hero__slide--active" : ""}`}
              style={{ backgroundImage: `url(${slide.image})` }}
            />
          ))}
          <div className="landing-hero__scrim" />
        </div>

        <div className="landing__container landing-hero__inner">
          <div className="landing-hero__badge">
            <span className="landing-hero__badge-dot" aria-hidden="true" />
            GradeSync · Digital School Management
          </div>

          <h1 className="landing-hero__title">
            {landing.hero.title}
            <span className="landing-hero__title-accent">{landing.hero.titleAccent}</span>
          </h1>

          <p className="landing-hero__subtitle">{landing.hero.subtitle}</p>

          <div className="landing-hero__actions">
            <Link to="/login" className="landing-hero__cta landing-hero__cta--primary">
              Sign in to GradeSync
              <FiArrowRight aria-hidden="true" />
            </Link>
            <a href="#about" className="landing-hero__cta landing-hero__cta--ghost">
              Learn more
            </a>
          </div>
        </div>

        <div className="landing-hero__controls">
          <button
            type="button"
            className="landing-hero__arrow"
            aria-label="Previous background"
            onClick={() =>
              setActiveSlide((prev) => (prev - 1 + landing.hero.slides.length) % landing.hero.slides.length)
            }
          >
            <FiChevronLeft aria-hidden="true" />
          </button>
          <div className="landing-hero__dots" role="group" aria-label="Background slides">
            {landing.hero.slides.map((slide, index) => (
              <button
                key={`dot-${slide.label}-${index}`}
                type="button"
                className={`landing-hero__dot${index === activeSlide ? " landing-hero__dot--active" : ""}`}
                aria-label={`Show background: ${slide.label}`}
                aria-current={index === activeSlide}
                onClick={() => setActiveSlide(index)}
              />
            ))}
          </div>
          <button
            type="button"
            className="landing-hero__arrow"
            aria-label="Next background"
            onClick={() => setActiveSlide((prev) => (prev + 1) % landing.hero.slides.length)}
          >
            <FiChevronRight aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* ---------- Stats strip ---------- */}
      <section className="landing-stats" aria-label="GradeSync in numbers">
        <div className="landing__container">
          <ul className="landing-stats__grid">
            {landing.stats.rows.map(({ value, label }, index) => (
              <li
                key={`${label}-${index}`}
                className="landing-stat"
                data-reveal=""
                style={{ "--reveal-delay": `${index * 80}ms` } as CSSProperties}
              >
                <span className="landing-stat__value">{value}</span>
                <span className="landing-stat__label">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- About ---------- */}
      <section id="about" className="landing-about">
        <div className="landing__container">
          <div className="landing-section__heading" data-reveal="">
            <p className="landing-section__eyebrow">{landing.about.heading.eyebrow}</p>
            <h2 className="landing-section__title">{landing.about.heading.title}</h2>
            <p className="landing-section__text">{landing.about.heading.text}</p>
          </div>

          <ul className="landing-about__grid">
            {landing.about.features.map(({ iconKey, title, text }, index) => {
              const Icon = getIcon(iconKey);
              return (
                <li
                  key={`${title}-${index}`}
                  className="landing-feature"
                  data-reveal=""
                  style={{ "--reveal-delay": `${index * 80}ms` } as CSSProperties}
                >
                  <span className="landing-feature__icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <h3 className="landing-feature__title">{title}</h3>
                  <p className="landing-feature__text">{text}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className="landing-how">
        <div className="landing__container">
          <div className="landing-section__heading" data-reveal="">
            <p className="landing-section__eyebrow">{landing.how_it_works.heading.eyebrow}</p>
            <h2 className="landing-section__title">{landing.how_it_works.heading.title}</h2>
            <p className="landing-section__text">{landing.how_it_works.heading.text}</p>
          </div>

          <ol className="landing-how__grid">
            {landing.how_it_works.steps.map(({ step, title, text }, index) => (
              <li
                key={`${step}-${index}`}
                className="landing-step"
                data-reveal=""
                style={{ "--reveal-delay": `${index * 80}ms` } as CSSProperties}
              >
                <span className="landing-step__number" aria-hidden="true">{step}</span>
                <h3 className="landing-step__title">{title}</h3>
                <p className="landing-step__text">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Who it's for ---------- */}
      <section id="who-its-for" className="landing-audience">
        <div className="landing__container">
          <div className="landing-section__heading" data-reveal="">
            <p className="landing-section__eyebrow">{landing.audiences.heading.eyebrow}</p>
            <h2 className="landing-section__title">{landing.audiences.heading.title}</h2>
            <p className="landing-section__text">{landing.audiences.heading.text}</p>
          </div>

          <ul className="landing-audience__grid">
            {landing.audiences.cards.map(({ iconKey, title, text, points }, index) => {
              const Icon = getIcon(iconKey);
              return (
                <li
                  key={`${title}-${index}`}
                  className="landing-audience__card"
                  data-reveal=""
                  style={{ "--reveal-delay": `${index * 90}ms` } as CSSProperties}
                >
                  <span className="landing-audience__icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <h3 className="landing-audience__title">{title}</h3>
                  <p className="landing-audience__text">{text}</p>
                  <ul className="landing-audience__points">
                    {points.map((point, pointIndex) => (
                      <li key={`${point}-${pointIndex}`} className="landing-audience__point">
                        <FiCheck aria-hidden="true" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>

          <p className="landing-audience__note" data-reveal="">
            <FiUsers aria-hidden="true" />
            One account per role — sign in and GradeSync opens the right workspace.
          </p>
        </div>
      </section>

      {/* ---------- Contact ---------- */}
      <section id="contact" className="landing-contact">
        <div className="landing__container">
          <div className="landing-section__heading" data-reveal="">
            <p className="landing-section__eyebrow">{landing.contact.heading.eyebrow}</p>
            <h2 className="landing-section__title">{landing.contact.heading.title}</h2>
            <p className="landing-section__text">{landing.contact.heading.text}</p>
          </div>

          <ul className="landing-contact__grid">
            {landing.contact.items.map(({ iconKey, title, lines }, index) => {
              const Icon = getIcon(iconKey);
              return (
                <li
                  key={`${title}-${index}`}
                  className="landing-contact__card"
                  data-reveal=""
                  style={{ "--reveal-delay": `${index * 80}ms` } as CSSProperties}
                >
                  <span className="landing-contact__icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <h3 className="landing-contact__title">{title}</h3>
                  {lines.map((line, lineIndex) => (
                    <p key={`${line}-${lineIndex}`} className="landing-contact__line">
                      {line}
                    </p>
                  ))}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ---------- CTA band ---------- */}
      <section className="landing-cta">
        <div className="landing__container landing-cta__inner" data-reveal="">
          <div className="landing-cta__copy">
            <h2 className="landing-cta__title">{landing.cta.title}</h2>
            <p className="landing-cta__text">{landing.cta.text}</p>
          </div>
          <Link to="/login" className="landing-cta__button">
            Sign in to GradeSync
            <FiArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="landing-footer">
        <div className="landing__container">
          <div className="landing-footer__grid">
            <div className="landing-footer__about">
              <div className="landing-footer__brand">
                <span className="landing-footer__logo">
                  <img src={logo1} alt={`${SCHOOL_NAME} logo`} />
                </span>
                <div>
                  <p className="landing-footer__name">{SCHOOL_NAME}</p>
                  <p className="landing-footer__muted">Powered by GradeSync</p>
                </div>
              </div>
              <p className="landing-footer__tagline">
                One system for grading, attendance, class submission and official
                school records.
              </p>
              <div className="landing-footer__badges">
                <span className="landing-footer__badge">
                  <FiUserCheck aria-hidden="true" />
                  Admin
                </span>
                <span className="landing-footer__badge">
                  <FaChalkboardTeacher aria-hidden="true" />
                  Teacher
                </span>
                <span className="landing-footer__badge">
                  <FiUserPlus aria-hidden="true" />
                  Student
                </span>
              </div>
            </div>

            <nav className="landing-footer__col" aria-label="Footer quick links">
              <h3 className="landing-footer__heading">Quick links</h3>
              {NAV_LINKS.map(({ label, href }) => (
                <a key={href} href={href} className="landing-footer__link">
                  {label}
                </a>
              ))}
              <Link to="/login" className="landing-footer__link">
                Sign in
              </Link>
            </nav>

            <div className="landing-footer__col">
              <h3 className="landing-footer__heading">Contact</h3>
              {landing.contact.items.map(({ iconKey, title, lines }, index) => {
                const Icon = getIcon(iconKey);
                return (
                  <div key={`${title}-${index}`} className="landing-footer__contact">
                    <span className="landing-footer__contact-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <div>
                      <p className="landing-footer__contact-title">{title}</p>
                      {lines.map((line, lineIndex) => (
                        <p key={`${line}-${lineIndex}`} className="landing-footer__contact-line">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="landing-footer__bottom">
            <p className="landing-footer__copy">
              © {currentYear} {SCHOOL_NAME}. All rights reserved.
            </p>
            <p className="landing-footer__copy">
              GradeSync · Digital School Management
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default LandingPage;
