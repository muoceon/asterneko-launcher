import { useTheme } from "@/components/theme-provider"

function resolveSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export function useThemeToggle() {
  const { theme, setTheme } = useTheme()
  const resolvedTheme = theme === "system" ? resolveSystemTheme() : theme
  const isDark = resolvedTheme === "dark"

  const toggleTheme = () => {
    if (theme === "system") {
      setTheme(resolvedTheme === "dark" ? "light" : "dark")
    } else {
      setTheme(theme === "dark" ? "light" : "dark")
    }
  }

  return {
    isDark,
    toggleTheme,
  }
}