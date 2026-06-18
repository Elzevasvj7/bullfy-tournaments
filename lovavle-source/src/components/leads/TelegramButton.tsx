import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send } from "lucide-react";
import TelegramPanel from "./TelegramPanel";

interface Props {
  lead: { id: string; nombre: string; telegram_chat_id?: number | null; telegram_username?: string | null; telegram_last_seen_at?: string | null };
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost";
  showLabel?: boolean;
}

const TelegramButton = ({ lead, size = "icon", variant = "ghost", showLabel = false }: Props) => {
  const [open, setOpen] = useState(false);
  const linked = !!lead.telegram_chat_id;

  return (
    <>
      <Button
        size={size}
        variant={variant}
        className={linked ? "text-sky-500 hover:text-sky-600 hover:bg-sky-500/10" : "text-muted-foreground"}
        title={linked ? `Telegram con ${lead.nombre}` : "Telegram no vinculado"}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Send className="w-4 h-4" />
        {showLabel && <span className="ml-2">Telegram</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-sky-500" />
              Telegram — {lead.nombre}
            </DialogTitle>
          </DialogHeader>
          <TelegramPanel lead={lead} />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TelegramButton;
