import logo1 from "../assets/logo1.webp";
import "../style/fullscreenLoader.css";

interface FullscreenLoaderProps {
    message?: string;
}

/**
 * Full-screen splash shown while the app is waiting on an initial load
 * (e.g. the landing page verifying the visitor's session).
 */
export default function FullscreenLoader({ message = "Loading…" }: FullscreenLoaderProps) {
    return (
        <div
            className="fullscreen-loader"
            role="status"
            aria-live="polite"
            aria-label={message}
        >
            <div className="fullscreen-loader__content">
                <div className="fullscreen-loader__logo" aria-hidden="true">
                    <img src={logo1} alt="GradeSync Logo" />
                </div>
                <div className="fullscreen-loader__bar-track" aria-hidden="true">
                    <div className="fullscreen-loader__bar-fill" />
                </div>
                <p className="fullscreen-loader__status">{message}</p>
            </div>
        </div>
    );
}
