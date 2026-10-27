import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export default function NotFoundPage() {
  const { t } = useTranslation("common")

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-bold">{t("notFound.title")}</h2>
      <p className="mt-4 text-center text-lg text-gray-600 dark:text-gray-300">
        {t("notFound.description")}
      </p>
      <Link to="/">
        <Button className="mt-8">{t("goBackHome")}</Button>
      </Link>
    </div>
  )
}