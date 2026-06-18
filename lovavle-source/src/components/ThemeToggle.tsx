import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground text-sm"
    >
      {theme === "dark" ? (
        <>
          <Sun className="w-4 h-4" />
          Modo claro
        </>
      ) : (
        <>
          <Moon className="w-4 h-4" />
          Modo oscuro
        </>
      )}
    </Button>
  );
};

export default ThemeToggle;
