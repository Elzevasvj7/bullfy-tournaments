import { useEffect, useRef, useState } from "react";
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}

const readFileAsDataUrl = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

export default function InvoiceCropDialog({ open, file, onCancel, onConfirm }: Props) {
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    setBusy(true);
    setSrcUrl(null);
    setCrop(undefined);
    setCompletedCrop(null);
    setRotation(0);
    (async () => {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        if (!cancelled) setSrcUrl(dataUrl);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, file]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    // Inicia con un rectángulo que cubre ~90% — usuario arrastra los bordes hacia adentro
    const initial = centerCrop(
      makeAspectCrop({ unit: "%", width: 90 }, width / height, width, height),
      width,
      height,
    );
    setCrop(initial);
  };

  const confirmCrop = async () => {
    if (!completedCrop || !imgRef.current || !file) {
      return toast({ title: "Selecciona un área de recorte", variant: "destructive" });
    }
    const img = imgRef.current;
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    const cropW = completedCrop.width * scaleX;
    const cropH = completedCrop.height * scaleY;
    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;

    const rad = (rotation * Math.PI) / 180;

    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    if (rotation === 0) {
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    } else {
      // Rotar alrededor del centro del recorte
      const sin = Math.abs(Math.sin(rad));
      const cos = Math.abs(Math.cos(rad));
      const fullW = img.naturalWidth;
      const fullH = img.naturalHeight;
      const bW = fullW * cos + fullH * sin;
      const bH = fullW * sin + fullH * cos;
      const tmp = document.createElement("canvas");
      tmp.width = bW;
      tmp.height = bH;
      const tctx = tmp.getContext("2d")!;
      tctx.translate(bW / 2, bH / 2);
      tctx.rotate(rad);
      tctx.drawImage(img, -fullW / 2, -fullH / 2);
      ctx.drawImage(tmp, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    }
    ctx.restore();

    canvas.toBlob(
      (blob) => {
        if (!blob) return toast({ title: "No se pudo recortar", variant: "destructive" });
        onConfirm(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Recortar documento</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="ghost" onClick={() => setRotation((r) => (r + 90) % 360)} disabled={!srcUrl}>
            <RotateCw className="h-4 w-4 mr-1" /> Rotar
          </Button>
          <p className="text-xs text-muted-foreground self-center ml-auto">
            Arrastra las esquinas o lados del recuadro para ajustar el recorte.
          </p>
        </div>

        <div className="relative bg-muted rounded-md overflow-auto grid place-items-center" style={{ minHeight: 460, maxHeight: "70vh" }}>
          {busy || !srcUrl ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              keepSelection
              ruleOfThirds
            >
              <img
                ref={imgRef}
                src={srcUrl}
                alt="Documento"
                onLoad={onImageLoad}
                style={{
                  transform: `rotate(${rotation}deg)`,
                  maxHeight: "65vh",
                  maxWidth: "100%",
                  display: "block",
                }}
              />
            </ReactCrop>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button onClick={confirmCrop} disabled={!completedCrop?.width}>
            Confirmar recorte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
