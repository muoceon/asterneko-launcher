import { lazy } from "react"

export const HomePage = lazy(() => import("@/pages/Home"))
export const InstancesPage = lazy(() => import("@/pages/Instances"))
export const DownloadPage = lazy(() => import("@/pages/Download"))
export const MultiplayerPage = lazy(() => import("@/pages/Multiplayer"))
export const AccountPage = lazy(() => import("@/pages/Account"))
export const NewsPage = lazy(() => import("@/pages/News"))
export const ThemePage = lazy(() => import("@/pages/Theme"))
export const SettingsPage = lazy(() => import("@/pages/Settings"))
export const AboutPage = lazy(() => import("@/pages/About"))