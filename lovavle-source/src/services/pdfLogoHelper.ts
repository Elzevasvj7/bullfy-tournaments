import logoSrc from "@/assets/logo-bullfy.png";

let cachedLogoBase64: string | null = null;

export async function getLogoBase64(): Promise<string | null> {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const response = await fetch(logoSrc);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoBase64 = reader.result as string;
        resolve(cachedLogoBase64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function addLogoToHeader(doc: any, logoBase64: string | null) {
  if (!logoBase64) return;
  try {
    doc.addImage(logoBase64, "PNG", 120, 2, 75, 36);
  } catch {
    // Silently fail if image can't be added
  }
}
