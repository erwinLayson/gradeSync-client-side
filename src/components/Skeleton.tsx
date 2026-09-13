import "../style/skeleton.css";

export interface SkeletonProps {
    /** Number of skeleton lines to render inside each item. Defaults to 3. */
    lines?: number;
    /** Number of skeleton items to render. Defaults to 1. */
    count?: number;
    /** Width of each line. Defaults to "100%". */
    width?: string;
    /** Height of each line. Defaults to "0.75rem". */
    height?: string;
    /** Border radius of each line. Defaults to "0.25rem". */
    radius?: string;
    /** Gap between lines. Defaults to "0.75rem". */
    gap?: string;
    /** Gap between items when count > 1. Defaults to "1rem". */
    itemGap?: string;
    /** CSS grid template for items when count > 1 (e.g. "repeat(2, 1fr)"). */
    grid?: string;
    /** Additional wrapper class names. */
    className?: string;
    /** Render a circle avatar placeholder instead of lines. */
    avatar?: boolean;
    /** Avatar size in px. Defaults to 56. */
    avatarSize?: number;
    /** Wrapper element for each item. Defaults to "div". */
    itemTag?: "div" | "article" | "li";
}

/**
 * Single shimmering placeholder bar styled like the skeleton lines.
 * Useful for one-off loading placeholders that don't need a full Skeleton block.
 */
export function SkeletonLine({
    width = "100%",
    height = "0.75rem",
    radius = "0.5rem",
    className = "",
}: {
    width?: string | number;
    height?: string | number;
    radius?: string;
    className?: string;
}) {
    return (
        <div
            className={`skeleton__bar ${className}`.trim()}
            style={{ width, height, borderRadius: radius }}
            aria-hidden="true"
        />
    );
}

function SkeletonBar({ width, height, radius, last }: {
    width: string;
    height: string;
    radius: string;
    last: boolean;
}) {
    return (
        <div
            className="skeleton__bar"
            style={{
                width: last ? "60%" : width,
                height,
                borderRadius: radius,
            }}
        />
    );
}

function SkeletonAvatar({ avatar, avatarSize }: {
    height: string;
    radius: string;
    avatar: boolean;
    avatarSize: number;
}) {
    if (!avatar) return null;
    return (
        <div
            className="skeleton__bar skeleton__bar--circle"
            style={{ width: avatarSize, height: avatarSize }}
        />
    );
}

export default function Skeleton({
    lines = 3,
    count = 1,
    width = "100%",
    height = "0.75rem",
    radius = "0.25rem",
    gap = "0.75rem",
    itemGap = "1rem",
    grid,
    className = "",
    avatar = false,
    avatarSize = 56,
    itemTag: ItemTag = "div",
}: SkeletonProps) {
    const itemStyle = grid
        ? { display: "grid", gridTemplateColumns: grid, gap: itemGap }
        : { display: "flex", flexDirection: "column" as const, gap: itemGap };

    return (
        <div
            className={`skeleton ${className}`}
            style={itemStyle}
            aria-hidden="true"
        >
            {Array.from({ length: count }).map((_, itemIndex) => (
                <ItemTag key={itemIndex} className="skeleton__item">
                    {avatar ? (
                        <div className="flex items-center gap-4">
                            <SkeletonAvatar
                                height={height}
                                radius={radius}
                                avatar={avatar}
                                avatarSize={avatarSize}
                            />
                            <div className="flex flex-1 flex-col" style={{ gap }}>
                                <SkeletonBar width="40%" height={height} radius={radius} last={false} />
                                <SkeletonBar width="65%" height="0.5rem" radius={radius} last={false} />
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col" style={{ gap }}>
                            {Array.from({ length: lines }).map((_, lineIndex) => (
                                <SkeletonBar
                                    key={lineIndex}
                                    width={width}
                                    height={height}
                                    radius={radius}
                                    last={lineIndex === lines - 1}
                                />
                            ))}
                        </div>
                    )}
                </ItemTag>
            ))}
        </div>
    );
}
