import {
    FaBookOpen,
    FaChalkboardTeacher,
    FaChartLine,
    FaClipboardCheck,
    FaSchool,
    FaUserGraduate,
} from "react-icons/fa";
import { FiCircle, FiClock, FiMail, FiMapPin, FiPhone } from "react-icons/fi";
import type { IconType } from "react-icons";

import heroSlide1 from "../assets/hero-1.svg";
import heroSlide2 from "../assets/hero-2.svg";
import heroSlide3 from "../assets/hero-3.svg";

/*
 * Landing page content — single source of truth for the public landing page.
 *
 * Phase 1 (docs/landing-content-plan.md): the previously hardcoded constants
 * in LandingPage.tsx live here as DEFAULT_LANDING_CONTENT so the page can
 * later render DB-managed content merged over these defaults (Phase 3).
 *
 * Icons are stored as KEYS into ICON_REGISTRY (never arbitrary component
 * names) so backend-validated content can only ever render whitelisted icons.
 */

// ==================== Types (Phase 2/3 API contract) ====================

export interface HeroSlide {
    /** Image URL — bundled asset path for defaults, server/upload URL later. */
    image: string;
    label: string;
}

export interface HeroContent {
    slides: HeroSlide[];
    title: string;
    titleAccent: string;
    subtitle: string;
}

export interface StatRow {
    value: string;
    label: string;
}

export interface StatsContent {
    rows: StatRow[];
}

export interface SectionHeading {
    eyebrow: string;
    title: string;
    text: string;
}

export interface FeatureCard {
    iconKey: string;
    title: string;
    text: string;
}

export interface AboutContent {
    heading: SectionHeading;
    features: FeatureCard[];
}

export interface StepCard {
    step: string;
    title: string;
    text: string;
}

export interface HowItWorksContent {
    heading: SectionHeading;
    steps: StepCard[];
}

export interface AudienceCard {
    iconKey: string;
    title: string;
    text: string;
    points: string[];
}

export interface AudiencesContent {
    heading: SectionHeading;
    cards: AudienceCard[];
}

export interface ContactItem {
    iconKey: string;
    title: string;
    lines: string[];
}

export interface ContactContent {
    heading: SectionHeading;
    items: ContactItem[];
}

export interface CtaContent {
    title: string;
    text: string;
}

export interface LandingContent {
    hero: HeroContent;
    stats: StatsContent;
    about: AboutContent;
    how_it_works: HowItWorksContent;
    audiences: AudiencesContent;
    contact: ContactContent;
    cta: CtaContent;
}

/** Section identifiers used as the `section` key in the API and DB. */
export const LANDING_SECTION_KEYS = [
    "hero",
    "stats",
    "about",
    "how_it_works",
    "audiences",
    "contact",
    "cta",
] as const;

export type LandingSectionKey = (typeof LANDING_SECTION_KEYS)[number];

/**
 * Editor metadata: one card per section on /developer/landing-content,
 * in the same order the public page renders them.
 */
export const SECTION_META: Record<LandingSectionKey, { label: string; description: string }> = {
    hero: {
        label: "Hero",
        description: "The full-width slider on top: images, headline and subtitle.",
    },
    stats: {
        label: "Stats",
        description: "The numbers strip under the hero (value + label pairs).",
    },
    about: {
        label: "About",
        description: "The About Us heading and its four feature cards.",
    },
    how_it_works: {
        label: "How It Works",
        description: "The four numbered steps between About and Who It's For.",
    },
    audiences: {
        label: "Who It's For",
        description: "One card per role: administrators, teachers, students.",
    },
    contact: {
        label: "Contact",
        description: "Contact details and office hours shown in the Contact section and footer.",
    },
    cta: {
        label: "CTA Band",
        description: "The closing call-to-action strip above the footer.",
    },
};

// ==================== Icon whitelist registry ====================

/**
 * The only icons landing content may render. Backend validation (Phase 2)
 * checks `iconKey` against this set; unknown keys fall back to the default.
 * Add an icon here when new content needs it — nothing else to wire up.
 */
export const ICON_REGISTRY = {
    // react-icons/fa
    FaBookOpen,
    FaChalkboardTeacher,
    FaChartLine,
    FaClipboardCheck,
    FaSchool,
    FaUserGraduate,
    // react-icons/fi
    FiCircle,
    FiClock,
    FiMail,
    FiMapPin,
    FiPhone,
} as const satisfies Record<string, IconType>;

export type IconKey = keyof typeof ICON_REGISTRY;

/** Default icon for unknown/missing iconKey (fail-open, never crashes). */
export const DEFAULT_ICON_KEY: IconKey = "FiCircle";

/** Resolves an icon key to a component; unknown keys fall back safely. */
export function getIcon(key: string | undefined): IconType {
    if (key && key in ICON_REGISTRY) {
        return ICON_REGISTRY[key as IconKey];
    }
    return ICON_REGISTRY[DEFAULT_ICON_KEY];
}

// ==================== DB merge (fail-open) ====================

/**
 * Shape guards for DB values. A section that fails its guard degrades to the
 * hardcoded default — the landing page must never crash or blank out because
 * the backend stored something unexpected (plan §6.4, fail-open).
 */
function isStr(value: unknown): value is string {
    return typeof value === "string";
}

function isStrArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(isStr);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHeroContent(value: unknown): value is HeroContent {
    if (!isRecord(value) || !Array.isArray(value.slides) || value.slides.length === 0) return false;
    return (
        value.slides.every(
            (slide) => isRecord(slide) && isStr(slide.image) && slide.image.length > 0 && isStr(slide.label),
        ) && isStr(value.title) && isStr(value.titleAccent) && isStr(value.subtitle)
    );
}

function isStatsContent(value: unknown): value is StatsContent {
    if (!isRecord(value) || !Array.isArray(value.rows) || value.rows.length === 0) return false;
    return value.rows.every((row) => isRecord(row) && isStr(row.value) && isStr(row.label));
}

function isSectionHeading(value: unknown): boolean {
    return isRecord(value) && isStr(value.eyebrow) && isStr(value.title) && isStr(value.text);
}

function isAboutContent(value: unknown): value is AboutContent {
    if (!isRecord(value) || !isSectionHeading(value.heading)) return false;
    return (
        Array.isArray(value.features) &&
        value.features.length > 0 &&
        value.features.every(
            (feature) => isRecord(feature) && isStr(feature.iconKey) && isStr(feature.title) && isStr(feature.text),
        )
    );
}

function isHowItWorksContent(value: unknown): value is HowItWorksContent {
    if (!isRecord(value) || !isSectionHeading(value.heading)) return false;
    return (
        Array.isArray(value.steps) &&
        value.steps.length > 0 &&
        value.steps.every(
            (step) => isRecord(step) && isStr(step.step) && isStr(step.title) && isStr(step.text),
        )
    );
}

function isAudiencesContent(value: unknown): value is AudiencesContent {
    if (!isRecord(value) || !isSectionHeading(value.heading)) return false;
    return (
        Array.isArray(value.cards) &&
        value.cards.length > 0 &&
        value.cards.every(
            (card) =>
                isRecord(card) &&
                isStr(card.iconKey) &&
                isStr(card.title) &&
                isStr(card.text) &&
                isStrArray(card.points),
        )
    );
}

function isContactContent(value: unknown): value is ContactContent {
    if (!isRecord(value) || !isSectionHeading(value.heading)) return false;
    return (
        Array.isArray(value.items) &&
        value.items.length > 0 &&
        value.items.every(
            (item) => isRecord(item) && isStr(item.iconKey) && isStr(item.title) && isStrArray(item.lines),
        )
    );
}

function isCtaContent(value: unknown): value is CtaContent {
    return isRecord(value) && isStr(value.title) && isStr(value.text);
}

/**
 * Validated merge of DB content over the defaults (fail-open):
 *  - missing sections → the default section renders;
 *  - malformed shapes (bad types, empty arrays) → the default section;
 *  - unknown icon keys are kept but render via getIcon()'s safe fallback.
 */
export function mergeLandingContent(db: Record<string, unknown> | null | undefined): LandingContent {
    const source = (db ?? {}) as Record<string, unknown>;
    const merged: LandingContent = { ...DEFAULT_LANDING_CONTENT };

    // Each section merges independently — one broken section only degrades
    // that section, the rest still come from the DB.
    if (isHeroContent(source.hero)) merged.hero = source.hero;
    if (isStatsContent(source.stats)) merged.stats = source.stats;
    if (isAboutContent(source.about)) merged.about = source.about;
    if (isHowItWorksContent(source.how_it_works)) merged.how_it_works = source.how_it_works;
    if (isAudiencesContent(source.audiences)) merged.audiences = source.audiences;
    if (isContactContent(source.contact)) merged.contact = source.contact;
    if (isCtaContent(source.cta)) merged.cta = source.cta;
    return merged;
}

// ==================== Preview escape hatch (Phase 5) ====================

/*
 * The developer editor (pages/developer/DeveloperLandingContent.tsx) publishes
 * its UNSAVED draft here so the public landing page can render it under
 * `/?preview` — the developer is otherwise redirected to their dashboard
 * (plan §7.6, Decision #6).
 *
 * localStorage (not sessionStorage): the preview opens in a NEW tab and
 * sessionStorage is not reliably shared across tabs. The stored draft is
 * client-side only and never persisted to the DB; reads go through the same
 * fail-open shape guards as the DB path, so a hand-edited or half-typed draft
 * can never crash the landing page. A TTL keeps stale drafts from haunting
 * the developer forever.
 */

const PREVIEW_STORAGE_KEY = "landing-content-preview";
const PREVIEW_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/** Fired after the stored preview draft changes (store/clear). */
export const LANDING_PREVIEW_EVENT = "landing-preview-updated";

interface StoredPreview {
    at: number;
    content: LandingContent;
}

/** Publishes the editor draft for preview (same tab or another tab). */
export function storeLandingPreview(content: LandingContent): void {
    try {
        const payload: StoredPreview = { at: Date.now(), content };
        window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // Storage unavailable (private mode, quota) — preview just shows published content.
    }
    window.dispatchEvent(new Event(LANDING_PREVIEW_EVENT));
}

/**
 * Subscription for useSyncExternalStore: re-renders the preview when the
 * stored draft changes in this tab (custom event) or another tab (storage).
 */
export function subscribeToPreviewStore(onStoreChange: () => void): () => void {
    window.addEventListener(LANDING_PREVIEW_EVENT, onStoreChange);
    window.addEventListener("storage", onStoreChange);
    return () => {
        window.removeEventListener(LANDING_PREVIEW_EVENT, onStoreChange);
        window.removeEventListener("storage", onStoreChange);
    };
}

/** Discards the stored preview draft (banner "Discard" button / clean exit). */
export function clearLandingPreview(): void {
    try {
        window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
    } catch {
        // Storage unavailable — nothing to clear.
    }
    window.dispatchEvent(new Event(LANDING_PREVIEW_EVENT));
}

// Snapshot cache keyed on the raw storage value: readLandingPreview() must
// return a stable reference between storage changes so it can serve as a
// useSyncExternalStore snapshot (LandingPage) without re-render loops.
let previewSnapshotCache: { raw: string | null; at: number; content: LandingContent | null } | null = null;

/**
 * The stored preview draft, or null when absent/expired. Re-validated through
 * mergeLandingContent's per-section guards: sections that don't match their
 * shape (e.g. emptied arrays) fall back to the defaults exactly like DB content.
 */
export function readLandingPreview(): LandingContent | null {
    let raw: string | null;
    try {
        raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    } catch {
        return null; // Storage unavailable — no preview.
    }

    const hit = previewSnapshotCache?.raw === raw ? previewSnapshotCache : null;
    if (hit) {
        return Date.now() - hit.at > PREVIEW_TTL_MS ? null : hit.content;
    }

    let at = 0;
    let content: LandingContent | null = null;
    if (raw) {
        try {
            const parsed = JSON.parse(raw) as Partial<StoredPreview>;
            if (typeof parsed?.at === "number" && Date.now() - parsed.at <= PREVIEW_TTL_MS) {
                at = parsed.at;
                // Cast is safe: mergeLandingContent re-validates every section shape.
                content = mergeLandingContent((parsed.content ?? null) as Record<string, unknown> | null);
            }
        } catch {
            content = null; // Corrupted draft — ignore it.
        }
    }
    previewSnapshotCache = { raw, at, content };
    return content;
}

// ==================== Default content ====================

export const DEFAULT_LANDING_CONTENT: LandingContent = {
    hero: {
        slides: [
            { image: heroSlide1, label: "School campus" },
            { image: heroSlide2, label: "Classroom learning" },
            { image: heroSlide3, label: "Student graduation" },
        ],
        title: "School records,",
        titleAccent: " simplified.",
        subtitle:
            "Abang Suizu Integrated School runs on GradeSync — one system for grading, attendance, class submission and official school records, all in one place.",
    },
    stats: {
        rows: [
            { value: "3", label: "Roles, one system" },
            { value: "4", label: "Quarters tracked" },
            { value: "100%", label: "Digital records" },
            { value: "SF10", label: "Ready submissions" },
        ],
    },
    about: {
        heading: {
            eyebrow: "About Us",
            title: "A complete academic record system",
            text: "Abang Suizu Integrated School uses GradeSync to keep academic records accurate, organized and up to date — from daily attendance to the quarterly submission of official student records (SF10 / Form-137).",
        },
        features: [
            {
                iconKey: "FaUserGraduate",
                title: "Student Records",
                text: "Every learner's profile, enrollment and class placement in one place.",
            },
            {
                iconKey: "FaClipboardCheck",
                title: "Grading & Attendance",
                text: "Quarter grades computed automatically from teacher-entered scores and attendance.",
            },
            {
                iconKey: "FaBookOpen",
                title: "Class Submission",
                text: "Advisers review and submit frozen student records each quarter for SF10 / Form-137.",
            },
            {
                iconKey: "FaChartLine",
                title: "Reports & Analytics",
                text: "Dashboards for admins, report cards for teachers and prospects for students.",
            },
        ],
    },
    how_it_works: {
        heading: {
            eyebrow: "How it works",
            title: "From enrollment to Form-137",
            text: "Four steps connect the school office, the classrooms and every learner's permanent record.",
        },
        steps: [
            {
                step: "01",
                title: "Enroll the learner",
                text: "Admins record student information and place them in a class for the school year.",
            },
            {
                step: "02",
                title: "Record daily progress",
                text: "Teachers take attendance and encode scores in the gradebook as classes happen.",
            },
            {
                step: "03",
                title: "Grades compute themselves",
                text: "Quarterly grades are calculated automatically against the school's grading weights.",
            },
            {
                step: "04",
                title: "Submit official records",
                text: "Advisers review, freeze and submit class records for SF10 / Form-137 printing.",
            },
        ],
    },
    audiences: {
        heading: {
            eyebrow: "Who it's for",
            title: "Built for every role in school",
            text: "Each role gets a workspace with exactly the tools it needs — nothing more, nothing missing.",
        },
        cards: [
            {
                iconKey: "FaSchool",
                title: "For Administrators",
                text: "See the whole school at a glance and keep records moving.",
                points: [
                    "Enrollment and records oversight",
                    "School-wide reports and analytics",
                    "Academic settings control",
                ],
            },
            {
                iconKey: "FaChalkboardTeacher",
                title: "For Teachers",
                text: "Spend less time on paperwork, more time teaching.",
                points: [
                    "Fast attendance taking",
                    "Gradebook with auto-computed grades",
                    "One-click class record submission",
                ],
            },
            {
                iconKey: "FaUserGraduate",
                title: "For Students",
                text: "Your school life, visible in one place.",
                points: ["Profile and class schedule", "Grades per quarter", "Subject prospectus tracking"],
            },
        ],
    },
    contact: {
        heading: {
            eyebrow: "Contact Us",
            title: "Reach the school office",
            text: "For login help or questions about records, get in touch with the school office during office hours.",
        },
        items: [
            {
                iconKey: "FiMapPin",
                title: "Address",
                lines: ["Abang Suizu Integrated School", "Your School Address Here"],
            },
            {
                iconKey: "FiMail",
                title: "Email",
                lines: ["admin@abangsuizu.edu.ph"],
            },
            {
                iconKey: "FiPhone",
                title: "Phone",
                lines: ["(000) 000-0000"],
            },
            {
                iconKey: "FiClock",
                title: "Office Hours",
                lines: ["Mon – Fri, 8:00 AM – 5:00 PM"],
            },
        ],
    },
    cta: {
        title: "Ready to simplify school records?",
        text: "Sign in with your school account — admins, teachers and students all use the same door.",
    },
};
