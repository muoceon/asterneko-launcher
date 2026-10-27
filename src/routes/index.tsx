import { createBrowserRouter } from "react-router-dom"
import Layout from "@/components/layout/Layout"
import ErrorPage from "@/pages/Error"
import LocaleGuard from "@/components/features/locale/LocaleGuard"
import LocaleRedirect from "@/components/features/locale/LocaleRedirect"
import { publicRoutes } from "./public.route"

export const router = createBrowserRouter([
  {
    path: "/:locale",
    element: <LocaleGuard />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <Layout />,
        children: publicRoutes,
      },
    ],
  },
  {
    path: "/",
    element: <LocaleRedirect />,
  },
])