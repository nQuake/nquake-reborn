// Entry point. Detect what this surface can do, paint the theme before the
// first render so there is no flash, and mount the wizard.

import { render } from "preact";

import "../styles.css";
import { detectCapabilities } from "../platform/capabilities.ts";
import { App } from "./App.tsx";
import { applyTheme, initialTheme } from "./theme.ts";
import { QUERY } from "./wizard.ts";

applyTheme(initialTheme(QUERY.theme));

const root = document.getElementById("app");
if (!root) throw new Error("missing #app mount point");

render(<App caps={detectCapabilities({ forceMock: QUERY.mock })} />, root);
