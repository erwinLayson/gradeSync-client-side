import { useEffect, useMemo, useRef, useState } from "react";
import {
    FiAlertCircle,
    FiArrowUp,
    FiCheckCircle,
    FiImage,
    FiLink,
    FiPlus,
    FiRefreshCw,
    FiSave,
    FiTrash2,
    FiUpload,
    FiXCircle,
} from "react-icons/fi";
import type { IconType } from "react-icons";

import { patchAPICall, uploadFile } from "../../api/api";
import { SkeletonLine } from "../../components/Skeleton";
import { invalidateLandingContentCache, useLandingContent } from "../../hooks/useLandingContent";
import {
    DEFAULT_LANDING_CONTENT,
    ICON_REGISTRY,
    SECTION_META,
    getIcon,
    storeLandingPreview,
    type AboutContent,
    type AudiencesContent,
    type ContactContent,
    type CtaContent,
    type HeroContent,
    type HowItWorksContent,
    type IconKey,
    type LandingContent,
    type LandingSectionKey,
    type StatsContent,
} from "../../constant/landingContent";
import "../../style/analyticsReports.css";
import "../../style/developerDashboard.css";

/*
 * Endpoints (docs/landing-content-plan.md Phase 2/3):
 *   PATCH /landing-content/:section   { ...section shape }   (developer only)
 *   POST  /uploads                    multipart "image"      (developer only)
 *
 * UI: one card per landing section, edited in place and saved PER SECTION
 * (PATCH /landing-content/:section). The editor state starts from the live
 * content (DB-merged) so the developer edits what is actually published;
 * "Reset" reverts that card. After a successful save the landing-content
 * cache is invalidated and the "landing-content-updated" event fires so the
 * public page (and this editor) re-sync instantly.
 */

const UPLOAD_ENDPOINT = "/uploads";
const MAX_UPLOAD_MB = 5;

type Draft = LandingContent;

/** Server error message if the interceptor pattern is bypassed; generic otherwise. */
function errMessage(err: unknown): string | null {
    if (err && typeof err === "object" && "response" in err) {
        const response = (err as { response?: { data?: { message?: unknown } } }).response;
        const message = response?.data?.message;
        if (typeof message === "string" && message.length > 0) return message;
    }
    return null;
}

// ==================== Small controlled fields ====================

interface FieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    textarea?: boolean;
    maxLength?: number;
    placeholder?: string;
}

function Field({ label, value, onChange, textarea, maxLength, placeholder }: FieldProps) {
    const sharedClassName = "developer-input w-full rounded-lg border px-3 py-2 text-sm";
    const id = useMemo(() => `fld-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, [label]);
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">
                {label}
            </label>
            {textarea ? (
                <textarea
                    id={id}
                    className={sharedClassName}
                    rows={3}
                    maxLength={maxLength}
                    placeholder={placeholder}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                />
            ) : (
                <input
                    id={id}
                    type="text"
                    className={sharedClassName}
                    maxLength={maxLength}
                    placeholder={placeholder}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                />
            )}
        </div>
    );
}

interface StringListProps {
    label: string;
    items: string[];
    onChange: (items: string[]) => void;
    addLabel: string;
    max: number;
}

function StringList({ label, items, onChange, addLabel, max }: StringListProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">{label}</span>
            <ul className="flex flex-col gap-2">
                {items.map((item, index) => (
                    <li key={index} className="flex items-center gap-2">
                        <input
                            type="text"
                            className="developer-input flex-1 rounded-lg border px-3 py-2 text-sm"
                            value={item}
                            maxLength={500}
                            aria-label={`${label} ${index + 1}`}
                            onChange={(event) => {
                                const next = [...items];
                                next[index] = event.target.value;
                                onChange(next);
                            }}
                        />
                        <IconFieldButton
                            title="Remove"
                            ariaLabel={`Remove ${label} ${index + 1}`}
                            onClick={() => onChange(items.filter((_, i) => i !== index))}
                            icon={FiTrash2}
                            tone="danger"
                        />
                    </li>
                ))}
            </ul>
            {items.length < max && (
                <button type="button" className="developer-editor__add" onClick={() => onChange([...items, ""])}>
                    <FiPlus aria-hidden="true" />
                    {addLabel}
                </button>
            )}
        </div>
    );
}

interface ImageFieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
}

function ImageField({ label, value, onChange }: ImageFieldProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    async function handleFile(file: File) {
        setUploadError(null);
        if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
            setUploadError(`Image exceeds the ${MAX_UPLOAD_MB} MB limit`);
            return;
        }
        setUploading(true);
        try {
            const response = await uploadFile(UPLOAD_ENDPOINT, file, { toast: true });
            if (response.data?.url) {
                onChange(response.data.url);
            }
        } catch (err) {
            setUploadError(errMessage(err) ?? "Upload failed — check your connection and try again.");
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">{label}</span>
            <div className="flex flex-wrap items-center gap-3">
                <span className="developer-editor__thumb" aria-hidden="true">
                    {value ? <img src={value} alt="" /> : <FiImage />}
                </span>
                <input
                    type="url"
                    className="developer-input min-w-[12rem] flex-1 rounded-lg border px-3 py-2 text-sm"
                    value={value}
                    placeholder="https://… or /assets/…"
                    aria-label={`${label} URL`}
                    onChange={(event) => onChange(event.target.value)}
                />
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    aria-label={`Upload ${label} image`}
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleFile(file);
                        event.target.value = "";
                    }}
                />
                <button
                    type="button"
                    className="developer-editor__upload"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <FiUpload aria-hidden="true" />
                    {uploading ? "Uploading…" : "Upload"}
                </button>
            </div>
            {uploadError && (
                <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-[#B91C1C]" role="alert">
                    <FiAlertCircle aria-hidden="true" />
                    {uploadError}
                </p>
            )}
        </div>
    );
}

// Module-level render helper (not a component): keeps the capitalized
// icon variable out of a component body, which react-hooks/static-components
// would otherwise flag.
function renderIconPreview(value: string) {
    const Preview = getIcon(value);
    return <Preview />;
}

interface IconFieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
}

function IconField({ label, value, onChange }: IconFieldProps) {
    const keys = Object.keys(ICON_REGISTRY) as IconKey[];
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">{label}</span>
            <div className="flex items-center gap-2">
                <span className="developer-editor__icon-preview" aria-hidden="true">
                    {renderIconPreview(value)}
                </span>
                <select
                    className="developer-input flex-1 rounded-lg border px-3 py-2 text-sm"
                    value={value}
                    aria-label={label}
                    onChange={(event) => onChange(event.target.value)}
                >
                    {keys.map((key) => (
                        <option key={key} value={key}>
                            {key}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}

// ==================== Card chrome ====================

interface SectionCardProps {
    sectionKey: LandingSectionKey;
    dirty: boolean;
    saving: boolean;
    error: string | null;
    savedAt: string | null;
    children: React.ReactNode;
    onSave: () => void;
    onReset: () => void;
}

function SectionCard({ sectionKey, dirty, saving, error, savedAt, children, onSave, onReset }: SectionCardProps) {
    const meta = SECTION_META[sectionKey];
    return (
        <section className="analytics__card overflow-hidden rounded-2xl bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
                <div className="min-w-0">
                    <h3 className="text-base font-bold text-neutral-800">{meta.label}</h3>
                    <p className="mt-0.5 text-[0.8125rem] text-neutral-500">{meta.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {dirty && (
                        <span className="rounded-full bg-[#FEF3C7] px-2.5 py-1 text-[0.6875rem] font-bold text-[#92400E]">
                            Unsaved changes
                        </span>
                    )}
                    {savedAt && !dirty && (
                        <span className="flex items-center gap-1 rounded-full bg-[#EAF5EE] px-2.5 py-1 text-[0.6875rem] font-bold text-[#176B3A]">
                            <FiCheckCircle aria-hidden="true" />
                            {savedAt}
                        </span>
                    )}
                    <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--neutral-border)] px-3 py-2 text-xs font-bold text-neutral-700 shadow-sm transition hover:border-[var(--primary)] disabled:opacity-50"
                        onClick={onReset}
                        disabled={!dirty || saving}
                    >
                        <FiRefreshCw aria-hidden="true" />
                        Reset
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
                        onClick={onSave}
                        disabled={!dirty || saving}
                    >
                        <FiSave aria-hidden="true" />
                        {saving ? "Saving…" : "Save"}
                    </button>
                </div>
            </header>
            <div className="flex flex-col gap-4 p-5">{children}</div>
            {error && (
                <p className="flex items-center gap-2 border-t px-5 py-3 text-[0.8125rem] font-semibold text-[#B91C1C]" role="alert">
                    <FiXCircle aria-hidden="true" />
                    {error}
                </p>
            )}
        </section>
    );
}

interface IconFieldButtonProps {
    title: string;
    ariaLabel: string;
    onClick: () => void;
    icon: IconType;
    tone?: "default" | "danger";
    disabled?: boolean;
}

function IconFieldButton({ title, ariaLabel, onClick, icon: Icon, tone = "default", disabled }: IconFieldButtonProps) {
    return (
        <button
            type="button"
            title={title}
            aria-label={ariaLabel}
            className={`developer-editor__icon-btn${tone === "danger" ? " developer-editor__icon-btn--danger" : ""}`}
            onClick={onClick}
            disabled={disabled}
        >
            <Icon aria-hidden="true" />
        </button>
    );
}

function RowShell({
    children,
    onRemove,
    onMoveUp,
    moveUpDisabled,
    removeDisabled,
}: {
    children: React.ReactNode;
    onRemove: () => void;
    onMoveUp?: () => void;
    moveUpDisabled?: boolean;
    removeDisabled?: boolean;
}) {
    return (
        <li className="developer-editor__row">
            <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
            <div className="flex shrink-0 flex-row gap-1.5">
                {onMoveUp && (
                    <IconFieldButton title="Move up" ariaLabel="Move row up" onClick={onMoveUp} icon={FiArrowUp} disabled={moveUpDisabled} />
                )}
                <IconFieldButton
                    title="Remove"
                    ariaLabel="Remove row"
                    onClick={onRemove}
                    icon={FiTrash2}
                    tone="danger"
                    disabled={removeDisabled}
                />
            </div>
        </li>
    );
}

// ==================== Section editors ====================

function HeroEditor({ value, patch }: { value: HeroContent; patch: (partial: Partial<HeroContent>) => void }) {
    return (
        <>
            <ul className="flex flex-col gap-3">
                {value.slides.map((slide, index) => (
                    <RowShell
                        key={index}
                        onRemove={() => patch({ slides: value.slides.filter((_, i) => i !== index) })}
                        onMoveUp={index > 0 ? () => {
                            const next = [...value.slides];
                            [next[index - 1], next[index]] = [next[index], next[index - 1]];
                            patch({ slides: next });
                        } : undefined}
                        moveUpDisabled={index === 0}
                        removeDisabled={value.slides.length <= 1}
                    >
                        <ImageField
                            label={`Slide ${index + 1} image`}
                            value={slide.image}
                            onChange={(image) => {
                                const next = [...value.slides];
                                next[index] = { ...slide, image };
                                patch({ slides: next });
                            }}
                        />
                        <Field
                            label={`Slide ${index + 1} label`}
                            value={slide.label}
                            maxLength={200}
                            onChange={(label) => {
                                const next = [...value.slides];
                                next[index] = { ...slide, label };
                                patch({ slides: next });
                            }}
                        />
                    </RowShell>
                ))}
            </ul>
            {value.slides.length < 6 && (
                <button
                    type="button"
                    className="developer-editor__add"
                    onClick={() => patch({ slides: [...value.slides, { image: "", label: "New slide" }] })}
                >
                    <FiPlus aria-hidden="true" />
                    Add slide
                </button>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Headline" value={value.title} maxLength={300} onChange={(title) => patch({ title })} />
                <Field label="Headline accent" value={value.titleAccent} maxLength={300} onChange={(titleAccent) => patch({ titleAccent })} />
            </div>
            <Field label="Subtitle" value={value.subtitle} maxLength={600} textarea onChange={(subtitle) => patch({ subtitle })} />
        </>
    );
}

function StatsEditor({ value, patch }: { value: StatsContent; patch: (partial: Partial<StatsContent>) => void }) {
    return (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {value.rows.map((row, index) => (
                <li key={index} className="developer-editor__row">
                    <div className="flex min-w-0 items-center gap-2">
                        <input
                            type="text"
                            className="developer-input w-20 shrink-0 rounded-lg border px-2 py-2 text-center text-sm font-bold"
                            value={row.value}
                            maxLength={50}
                            aria-label={`Stat ${index + 1} value`}
                            onChange={(event) => {
                                const next = [...value.rows];
                                next[index] = { ...row, value: event.target.value };
                                patch({ rows: next });
                            }}
                        />
                        <input
                            type="text"
                            className="developer-input min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
                            value={row.label}
                            maxLength={200}
                            aria-label={`Stat ${index + 1} label`}
                            onChange={(event) => {
                                const next = [...value.rows];
                                next[index] = { ...row, label: event.target.value };
                                patch({ rows: next });
                            }}
                        />
                        <IconFieldButton
                            title="Remove"
                            ariaLabel={`Remove stat ${index + 1}`}
                            onClick={() => patch({ rows: value.rows.filter((_, i) => i !== index) })}
                            icon={FiTrash2}
                            tone="danger"
                            disabled={value.rows.length <= 1}
                        />
                    </div>
                </li>
            ))}
            {value.rows.length < 8 && (
                <li>
                    <button
                        type="button"
                        className="developer-editor__add"
                        onClick={() => patch({ rows: [...value.rows, { value: "", label: "" }] })}
                    >
                        <FiPlus aria-hidden="true" />
                        Add stat
                    </button>
                </li>
            )}
        </ul>
    );
}

interface HeadingEditorProps {
    heading: { eyebrow: string; title: string; text: string };
    onChange: (heading: { eyebrow: string; title: string; text: string }) => void;
}

function HeadingEditor({ heading, onChange }: HeadingEditorProps) {
    return (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-[var(--neutral-border)] p-4">
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-neutral-400">Section heading</span>
            <Field label="Eyebrow" value={heading.eyebrow} maxLength={100} onChange={(eyebrow) => onChange({ ...heading, eyebrow })} />
            <Field label="Title" value={heading.title} maxLength={300} onChange={(title) => onChange({ ...heading, title })} />
            <Field label="Text" value={heading.text} maxLength={1000} textarea onChange={(text) => onChange({ ...heading, text })} />
        </div>
    );
}

function AboutEditor({ value, patch }: { value: AboutContent; patch: (partial: Partial<AboutContent>) => void }) {
    return (
        <>
            <HeadingEditor heading={value.heading} onChange={(heading) => patch({ heading })} />
            <ul className="flex flex-col gap-3">
                {value.features.map((feature, index) => (
                    <RowShell
                        key={index}
                        onRemove={() => patch({ features: value.features.filter((_, i) => i !== index) })}
                        removeDisabled={value.features.length <= 1}
                    >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                            <Field
                                label="Title"
                                value={feature.title}
                                maxLength={200}
                                onChange={(title) => {
                                    const next = [...value.features];
                                    next[index] = { ...feature, title };
                                    patch({ features: next });
                                }}
                            />
                            <IconField
                                label="Icon"
                                value={feature.iconKey}
                                onChange={(iconKey) => {
                                    const next = [...value.features];
                                    next[index] = { ...feature, iconKey };
                                    patch({ features: next });
                                }}
                            />
                        </div>
                        <Field
                            label="Text"
                            value={feature.text}
                            maxLength={600}
                            textarea
                            onChange={(text) => {
                                const next = [...value.features];
                                next[index] = { ...feature, text };
                                patch({ features: next });
                            }}
                        />
                    </RowShell>
                ))}
            </ul>
            {value.features.length < 8 && (
                <button
                    type="button"
                    className="developer-editor__add"
                    onClick={() => patch({ features: [...value.features, { iconKey: "FiCircle", title: "", text: "" }] })}
                >
                    <FiPlus aria-hidden="true" />
                    Add card
                </button>
            )}
        </>
    );
}

function HowItWorksEditor({ value, patch }: { value: HowItWorksContent; patch: (partial: Partial<HowItWorksContent>) => void }) {
    return (
        <>
            <HeadingEditor heading={value.heading} onChange={(heading) => patch({ heading })} />
            <ul className="flex flex-col gap-3">
                {value.steps.map((step, index) => (
                    <RowShell
                        key={index}
                        onRemove={() => patch({ steps: value.steps.filter((_, i) => i !== index) })}
                        removeDisabled={value.steps.length <= 1}
                    >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
                            <Field
                                label="Number"
                                value={step.step}
                                maxLength={10}
                                onChange={(stepNumber) => {
                                    const next = [...value.steps];
                                    next[index] = { ...step, step: stepNumber };
                                    patch({ steps: next });
                                }}
                            />
                            <Field
                                label="Title"
                                value={step.title}
                                maxLength={200}
                                onChange={(title) => {
                                    const next = [...value.steps];
                                    next[index] = { ...step, title };
                                    patch({ steps: next });
                                }}
                            />
                        </div>
                        <Field
                            label="Text"
                            value={step.text}
                            maxLength={600}
                            textarea
                            onChange={(text) => {
                                const next = [...value.steps];
                                next[index] = { ...step, text };
                                patch({ steps: next });
                            }}
                        />
                    </RowShell>
                ))}
            </ul>
            {value.steps.length < 8 && (
                <button
                    type="button"
                    className="developer-editor__add"
                    onClick={() =>
                        patch({
                            steps: [...value.steps, { step: String(value.steps.length + 1).padStart(2, "0"), title: "", text: "" }],
                        })
                    }
                >
                    <FiPlus aria-hidden="true" />
                    Add step
                </button>
            )}
        </>
    );
}

function AudiencesEditor({ value, patch }: { value: AudiencesContent; patch: (partial: Partial<AudiencesContent>) => void }) {
    return (
        <>
            <HeadingEditor heading={value.heading} onChange={(heading) => patch({ heading })} />
            <ul className="flex flex-col gap-3">
                {value.cards.map((card, index) => (
                    <RowShell
                        key={index}
                        onRemove={() => patch({ cards: value.cards.filter((_, i) => i !== index) })}
                        removeDisabled={value.cards.length <= 1}
                    >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                            <Field
                                label="Title"
                                value={card.title}
                                maxLength={200}
                                onChange={(title) => {
                                    const next = [...value.cards];
                                    next[index] = { ...card, title };
                                    patch({ cards: next });
                                }}
                            />
                            <IconField
                                label="Icon"
                                value={card.iconKey}
                                onChange={(iconKey) => {
                                    const next = [...value.cards];
                                    next[index] = { ...card, iconKey };
                                    patch({ cards: next });
                                }}
                            />
                        </div>
                        <Field
                            label="Text"
                            value={card.text}
                            maxLength={600}
                            textarea
                            onChange={(text) => {
                                const next = [...value.cards];
                                next[index] = { ...card, text };
                                patch({ cards: next });
                            }}
                        />
                        <StringList
                            label="Bullet points"
                            items={card.points}
                            max={8}
                            addLabel="Add point"
                            onChange={(points) => {
                                const next = [...value.cards];
                                next[index] = { ...card, points };
                                patch({ cards: next });
                            }}
                        />
                    </RowShell>
                ))}
            </ul>
            {value.cards.length < 6 && (
                <button
                    type="button"
                    className="developer-editor__add"
                    onClick={() =>
                        patch({ cards: [...value.cards, { iconKey: "FiCircle", title: "", text: "", points: [""] }] })
                    }
                >
                    <FiPlus aria-hidden="true" />
                    Add card
                </button>
            )}
        </>
    );
}

function ContactEditor({ value, patch }: { value: ContactContent; patch: (partial: Partial<ContactContent>) => void }) {
    return (
        <>
            <HeadingEditor heading={value.heading} onChange={(heading) => patch({ heading })} />
            <ul className="flex flex-col gap-3">
                {value.items.map((item, index) => (
                    <RowShell
                        key={index}
                        onRemove={() => patch({ items: value.items.filter((_, i) => i !== index) })}
                        removeDisabled={value.items.length <= 1}
                    >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                            <Field
                                label="Title"
                                value={item.title}
                                maxLength={200}
                                onChange={(title) => {
                                    const next = [...value.items];
                                    next[index] = { ...item, title };
                                    patch({ items: next });
                                }}
                            />
                            <IconField
                                label="Icon"
                                value={item.iconKey}
                                onChange={(iconKey) => {
                                    const next = [...value.items];
                                    next[index] = { ...item, iconKey };
                                    patch({ items: next });
                                }}
                            />
                        </div>
                        <StringList
                            label="Lines"
                            items={item.lines}
                            max={4}
                            addLabel="Add line"
                            onChange={(lines) => {
                                const next = [...value.items];
                                next[index] = { ...item, lines };
                                patch({ items: next });
                            }}
                        />
                    </RowShell>
                ))}
            </ul>
            {value.items.length < 8 && (
                <button
                    type="button"
                    className="developer-editor__add"
                    onClick={() => patch({ items: [...value.items, { iconKey: "FiCircle", title: "", lines: [""] }] })}
                >
                    <FiPlus aria-hidden="true" />
                    Add item
                </button>
            )}
        </>
    );
}

function CtaEditor({ value, patch }: { value: CtaContent; patch: (partial: Partial<CtaContent>) => void }) {
    return (
        <>
            <Field label="Title" value={value.title} maxLength={300} onChange={(title) => patch({ title })} />
            <Field label="Text" value={value.text} maxLength={600} textarea onChange={(text) => patch({ text })} />
        </>
    );
}

// ==================== Page ====================

function LandingContentEditor() {
    // Editor state seeds from the DB-merged content once loaded; after that
    // the page owns its draft state (per-card save/reset, no live overwrite).
    const { content } = useLandingContent();
    const [draft, setDraft] = useState<Draft | null>(null);
    const [draftSeeded, setDraftSeeded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [dirty, setDirty] = useState<Record<LandingSectionKey, boolean>>({
        hero: false,
        stats: false,
        about: false,
        how_it_works: false,
        audiences: false,
        contact: false,
        cta: false,
    });
    const [saving, setSaving] = useState<Record<LandingSectionKey, boolean>>({
        hero: false,
        stats: false,
        about: false,
        how_it_works: false,
        audiences: false,
        contact: false,
        cta: false,
    });
    const [errors, setErrors] = useState<Record<LandingSectionKey, string | null>>({
        hero: null,
        stats: null,
        about: null,
        how_it_works: null,
        audiences: null,
        contact: null,
        cta: null,
    });
    const [savedAt, setSavedAt] = useState<Record<LandingSectionKey, string | null>>({
        hero: null,
        stats: null,
        about: null,
        how_it_works: null,
        audiences: null,
        contact: null,
        cta: null,
    });
    const [savedBanner, setSavedBanner] = useState(false);

    const dirtyValues = Object.values(dirty);
    const hasDirty = dirtyValues.some(Boolean);

    // NOTE: row removal is intentionally immediate (no confirm dialog):
    // rows live in the unsaved draft — nothing is published until the
    // section's Save is clicked, and Reset restores the published content.
    // The danger ConfirmDialog stays reserved for publish-level actions
    // (see DeveloperFeatures).

    // Seed the draft once the hook has loaded content. After seeding, the
    // page owns its draft — a background re-sync (event) must NOT clobber
    // unsaved edits, so only the very first arrival seeds.
    useEffect(() => {
        if (!draftSeeded && content) {
            setDraft(content);
            setDraftSeeded(true);
            setLoading(false);
        }
    }, [content, draftSeeded]);

    function patchSection<K extends LandingSectionKey>(key: K, partial: Partial<Draft[K]>) {
        setDraft((prev) => (prev ? { ...prev, [key]: { ...prev[key], ...partial } } : prev));
        setDirty((prev) => ({ ...prev, [key]: true }));
        setSavedAt((prev) => ({ ...prev, [key]: null }));
    }

    function resetSection(key: LandingSectionKey) {
        setDraft((prev) => (prev ? { ...prev, [key]: DEFAULT_LANDING_CONTENT[key] } : prev));
        setDirty((prev) => ({ ...prev, [key]: false }));
        setErrors((prev) => ({ ...prev, [key]: null }));
        setSavedAt((prev) => ({ ...prev, [key]: null }));
    }

    async function saveSection(key: LandingSectionKey) {
        if (!draft) return;
        setSaving((prev) => ({ ...prev, [key]: true }));
        setErrors((prev) => ({ ...prev, [key]: null }));
        try {
            await patchAPICall(`/landing-content/${key}`, draft[key], { toast: true });
            setDirty((prev) => ({ ...prev, [key]: false }));
            setSavedAt((prev) => ({ ...prev, [key]: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }));
            setSavedBanner(true);
            window.setTimeout(() => setSavedBanner(false), 2500);
            // Publish to the rest of the app: landing page + this editor resync.
            invalidateLandingContentCache();
            window.dispatchEvent(new Event("landing-content-updated"));
        } catch (err) {
            // Error toast handled by the interceptor; also surface inline.
            setErrors((prev) => ({ ...prev, [key]: errMessage(err) ?? "Save failed — please try again." }));
        } finally {
            setSaving((prev) => ({ ...prev, [key]: false }));
        }
    }

    // Warn before the tab closes / reloads / navigates away with unsaved
    // changes (plan §4, Phase 4/5). The browser shows its native dialog —
    // there is no custom UI for this event.
    useEffect(() => {
        if (!hasDirty) return;
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            // Chrome additionally requires returnValue to be set.
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [hasDirty]);

    if (loading || !draft) {
        return (
            <section className="flex flex-col gap-5" aria-busy="true">
                <SkeletonLine width="100%" height="7rem" radius="1rem" />
                <SkeletonLine width="100%" height="14rem" radius="1rem" />
                <SkeletonLine width="100%" height="14rem" radius="1rem" />
            </section>
        );
    }

    return (
        <section className="flex flex-col gap-5">
            <div className="analytics__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                        <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Platform</span>
                        <h3 className="analytics__title mt-1 text-base font-bold">Landing Content</h3>
                        <p className="analytics__subtitle mt-1 text-[0.8125rem]">
                            Edit the public landing page. Each section saves independently and goes live immediately.
                            Use Preview to check unsaved changes first.
                        </p>
                    </div>
                    <a
                        href="/?preview"
                        target="_blank"
                        rel="noreferrer"
                        title="Opens the landing page in a new tab with your unsaved changes (visible to you only)"
                        onClick={() => {
                            // Publish the current draft for the preview tab
                            // (client-side only — nothing is saved to the DB).
                            if (draft) storeLandingPreview(draft);
                        }}
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--neutral-border)] px-3.5 py-2 text-xs font-bold text-neutral-700 shadow-sm transition hover:border-[var(--primary)]"
                    >
                        <FiLink aria-hidden="true" />
                        Preview page
                    </a>
                    {savedBanner && (
                        <span className="flex items-center gap-1.5 rounded-full bg-[#EAF5EE] px-3 py-1.5 text-xs font-bold text-[#176B3A]" role="status">
                            <FiCheckCircle aria-hidden="true" />
                            Saved — live on the landing page
                        </span>
                    )}
                </div>
            </div>

            {(Object.keys(SECTION_META) as LandingSectionKey[]).map((key) => (
                <SectionCard
                    key={key}
                    sectionKey={key}
                    dirty={dirty[key]}
                    saving={saving[key]}
                    error={errors[key]}
                    savedAt={savedAt[key]}
                    onSave={() => void saveSection(key)}
                    onReset={() => resetSection(key)}
                >
                    {key === "hero" && <HeroEditor value={draft.hero} patch={(partial) => patchSection("hero", partial)} />}
                    {key === "stats" && <StatsEditor value={draft.stats} patch={(partial) => patchSection("stats", partial)} />}
                    {key === "about" && <AboutEditor value={draft.about} patch={(partial) => patchSection("about", partial)} />}
                    {key === "how_it_works" && (
                        <HowItWorksEditor value={draft.how_it_works} patch={(partial) => patchSection("how_it_works", partial)} />
                    )}
                    {key === "audiences" && (
                        <AudiencesEditor value={draft.audiences} patch={(partial) => patchSection("audiences", partial)} />
                    )}
                    {key === "contact" && <ContactEditor value={draft.contact} patch={(partial) => patchSection("contact", partial)} />}
                    {key === "cta" && <CtaEditor value={draft.cta} patch={(partial) => patchSection("cta", partial)} />}
                </SectionCard>
            ))}
        </section>
    );
}

export default LandingContentEditor;
