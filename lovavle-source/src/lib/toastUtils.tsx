import { toast as sonnerToast, ExternalToast } from "sonner";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
      title="Copiar error"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-500" />
      ) : (
        <Copy className="w-3.5 h-3.5 opacity-50 hover:opacity-100" />
      )}
    </button>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 w-full min-w-0">
      <span className="flex-1 break-words">{message}</span>
      <CopyButton text={message} />
    </div>
  );
}

// Patched toast.error that adds a copy button
const originalError = sonnerToast.error.bind(sonnerToast);

const patchedError = (message: string | React.ReactNode, options?: ExternalToast) => {
  if (typeof message === "string") {
    return originalError(<ErrorMessage message={message} />, options);
  }
  return originalError(message, options);
};

// Export a patched toast object
export const toast = Object.assign((...args: Parameters<typeof sonnerToast>) => sonnerToast(...args), {
  ...sonnerToast,
  error: patchedError,
});
