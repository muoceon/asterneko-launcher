import { HomePage, InstancesPage, DownloadPage, MultiplayerPage, AccountPage, NewsPage, ThemePage, SettingsPage, AboutPage } from "@/pages/lazy"
import NotFoundPage from "@/pages/NotFound"
import type { RouteObject } from "react-router-dom"
import type { RouteMeta } from "@/components/layout/PageMeta"

type PublicRoute = RouteObject & { handle?: RouteMeta }

export const publicRoutes: PublicRoute[] = [
  {
    index: true,
    element: <HomePage />,
    handle: { key: "home" },
  },
  {
    path: "instances",
    element: <InstancesPage />,
    handle: { key: "instances" },
  },
  {
    path: "download",
    element: <DownloadPage />,
    handle: { key: "download" },
  },
  {
    path: "multiplayer",
    element: <MultiplayerPage />,
    handle: { key: "multiplayer" },
  },
  {
    path: "account",
    element: <AccountPage />,
    handle: { key: "account" },
  },
  {
    path: "news",
    element: <NewsPage />,
    handle: { key: "news" },
  },
  {
    path: "theme",
    element: <ThemePage />,
    handle: { key: "theme" },
  },
  {
    path: "settings",
    element: <SettingsPage />,
    handle: { key: "settings" },
  },
  {
    path: "about",
    element: <AboutPage />,
    handle: { key: "about" },
  },
  {
    path: "*",
    element: <NotFoundPage />,
    handle: { key: "notFound" },
  },
]