import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Menu, X, Home } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Logo } from "@/components/layout/Logo"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function ResponsiveSheetMenu() {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const { t, i18n } = useTranslation("nav")

  const handleOpenChange = (open: boolean) => {
    setOpen(open)
    if (open) {
      document.documentElement.style.overflow = "hidden"
      document.body.style.overflow = "hidden"
    } else {
      setTimeout(() => {
        document.documentElement.style.overflow = "auto"
        document.body.style.overflow = "auto"
      }, 300)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button aria-label={t("menu.button")}>
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent
        showCloseButton={false}
        side={isMobile ? "top" : "right"}
        className={`flex flex-col pl-2 pb-2 m-0 overflow-y-auto ${isMobile && "h-screen! w-full bg-background"}`}
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Navigation menu</SheetDescription>

        {isMobile && (
          <div className="container flex justify-between items-center mx-auto px-2 py-2 pt-4 md:px-4 md:py-4 border-b">
            <Logo />
            <SheetClose asChild>
              <Button variant="outline" size="icon" aria-label="Close">
                <X className="h-5 w-5" />
              </Button>
            </SheetClose>
          </div>
        )}

        <div className="flex py-8">
          <div className="container mx-auto px-4 space-y-6">
            <h2 className="text-xl font-bold text-primary mb-6">
              {t("menu.title")}
            </h2>
            <div className="space-y-2">
              <SheetClose asChild>
                <Link
                  to={`/${i18n.language}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <Home className="h-5 w-5 text-primary" />
                  <span className="text-lg font-medium">{t("home")}</span>
                </Link>
              </SheetClose>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}