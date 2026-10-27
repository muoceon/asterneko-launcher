import { Suspense } from "react"
import { RouterProvider } from "react-router-dom"
import { router } from "@/routes"
import { Loader2 } from "lucide-react"

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <RouterProvider router={router} />
    </Suspense>
  )
}