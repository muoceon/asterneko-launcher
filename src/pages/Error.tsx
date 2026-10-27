import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useRouteError, isRouteErrorResponse } from "react-router-dom"
import Nav from "@/components/layout/Nav"

export default function ErrorPage() {
  const { t } = useTranslation("common")
  const error = useRouteError()

  let errorMessage = t("error.description")
  if (isRouteErrorResponse(error)) {
    errorMessage = error.statusText || errorMessage
  } else if (error instanceof Error) {
    errorMessage = error.message
  }

  return (
    <>
      <Nav />
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 px-4 py-4 pt-(--nav-height)">
        <h2 className="text-2xl font-bold">{t("error.title")}</h2>
        <p className="mt-4 text-center text-lg text-gray-600 dark:text-gray-300">
          {errorMessage}
        </p>
        <Link to="/">
          <Button className="mt-8">{t("goBackHome")}</Button>
        </Link>
      </div>
    </>
  )
}