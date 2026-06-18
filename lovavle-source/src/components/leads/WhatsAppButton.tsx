import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageCircle } from "lucide-react";
import WhatsAppChatPanel from "./WhatsAppChatPanel";

interface Props {
  lead: { id: string; nombre: string; telefono?: string | null };
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost";
  showLabel?: boolean;
}

const WhatsAppButton = ({ lead, size = "icon", variant = "ghost", showLabel = false }: Props) => {
  const [open, setOpen] = useState(false);

  if (!lead.telefono) {
    return (
      <Button size={size} variant={variant} disabled title="Sin teléfono">
        <MessageCircle className="w-4 h-4 text-muted-foreground" />
        {showLabel && <span className="ml-2">WhatsApp</span>}
      </Button>
    );
  }

  return (
    <>
      <Button
        size={size}
        variant={variant}
        className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
        title={`WhatsApp con ${lead.nombre}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <MessageCircle className="w-4 h-4" />
        {showLabel && <span className="ml-2">WhatsApp</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-500" />
              WhatsApp — {lead.nombre}
            </DialogTitle>
          </DialogHeader>
          <WhatsAppChatPanel lead={lead} />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WhatsAppButton;
