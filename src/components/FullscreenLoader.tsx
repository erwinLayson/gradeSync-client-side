import { FiLoader } from "react-icons/fi";

import logo1 from "../assets/logo1.webp";
import "../style/fullscreenLoader.css";

/**
 * Full-screen splash shown while the app is waiting on an initial load
 * (e.g. the landing page verifying the visitor's session).
 */
export default function FullscreenLoader() {
    return (
        <div
            className="fullscreen-loader"
            role="status"
            aria-live="polite"
            aria-label="Loading"
        >
            <div className="fullscreen-loader__logo" aria-hidden="true">
                <img src={logo1} alt="" />
            </div>
            <div className="fullscreen-loader__loader" aria-hidden="true">
                <span className="fullscreen-loader__bounce-dot" />
                <span className="fullscreen-loader__bounce-dot" />
                <span className="fullscreen-loader__bounce-dot" />
            </div>
            <FiLoader className="fullscreen-loader__spin" size={22} aria-hidden="true" />
            <p className="fullscreen-loader__status">Loading…</p>
        </div>
    );
}
