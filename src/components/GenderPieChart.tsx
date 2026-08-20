import "../style/genderPieChart.css";

interface GenderPieChartProps {
    male: number;
    female: number;
    size?: number;
    /** When true the chart stretches to fill its parent container */
    fullWidth?: boolean;
}

export default function GenderPieChart({ male, female, size = 56, fullWidth }: GenderPieChartProps) {
    const total = male + female;
    const malePercent = total > 0 ? (male / total) * 100 : 0;
    const femalePercent = total > 0 ? (female / total) * 100 : 0;

    // No data — neutral gray
    if (total === 0) {
        return (
            <div
                className={`gender-pie-chart ${fullWidth ? "gender-pie-chart--full" : ""}`}
                style={fullWidth ? undefined : { width: size, height: size }}
                title="No student data"
            >
                <div
                    className="gender-pie-chart__ring"
                    style={fullWidth ? undefined : { width: size, height: size, background: "#d1d5db" }}
                >
                    <div
                        className="gender-pie-chart__center"
                        style={fullWidth ? undefined : { width: size * 0.55, height: size * 0.55 }}
                    >
                        <span className="gender-pie-chart__total">0</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`gender-pie-chart ${fullWidth ? "gender-pie-chart--full" : ""}`}
            style={fullWidth ? undefined : { width: size, height: size }}
            title={`${male} male, ${female} female (${total} total)`}
        >
            <div
                className="gender-pie-chart__ring gender-pie-chart__ring--animated"
                style={
                    fullWidth
                        ? ({
                              "--pie-male": `${malePercent}%`,
                              "--pie-female": `${malePercent + femalePercent}%`,
                          } as React.CSSProperties)
                        : ({
                              width: size,
                              height: size,
                              "--pie-male": `${malePercent}%`,
                              "--pie-female": `${malePercent + femalePercent}%`,
                          } as React.CSSProperties)
                }
            >
                <div
                    className="gender-pie-chart__center"
                    style={fullWidth ? undefined : { width: size * 0.55, height: size * 0.55 }}
                >
                    <span className="gender-pie-chart__total">{total}</span>
                </div>
            </div>
        </div>
    );
}
