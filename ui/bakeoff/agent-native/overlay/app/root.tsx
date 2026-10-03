// Candidate B: the root. Every route renders full-bleed: the chat shell
// (sidebar, command menu, agent inspector) is not used and not shipped, so the
// slice and the gate sit on the paper, one decision per view (spike 007, trail
// 11; UI-SPEC). No analytics configuration, no web font link. Hyphens only.
import { appPath } from "@agent-native/core/client/api-path";
import { createAgentNativeQueryClient } from "@agent-native/core/client/hooks";
import { getLocaleInitScript } from "@agent-native/core/client/i18n";
import { getThemeInitScript } from "@agent-native/core/client/theme";
import { AppProviders } from "@agent-native/toolkit/app/providers";
import { useState } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { LinksFunction } from "react-router";

import { AppToolkitProvider } from "./components/ui/toolkit-provider";

import { i18nCatalog } from "./i18n";

import stylesheet from "./global.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: stylesheet }];

const THEME_INIT_SCRIPT = getThemeInitScript();
const LOCALE_INIT_SCRIPT = getLocaleInitScript();

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script data-agent-native-locale-init suppressHydrationWarning dangerouslySetInnerHTML={{ __html: LOCALE_INIT_SCRIPT }} />
        <meta name="theme-color" content="#F5F0E6" />
        <link rel="icon" type="image/svg+xml" href={appPath("/favicon.svg")} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  const [queryClient] = useState(() => createAgentNativeQueryClient());
  return (
    <AppToolkitProvider>
      <AppProviders queryClient={queryClient} skeletonLayout="assistant" i18n={{ catalog: i18nCatalog }}>
        <Outlet />
      </AppProviders>
    </AppToolkitProvider>
  );
}

export { ErrorBoundary } from "@agent-native/toolkit/app/shared/ErrorBoundary";
