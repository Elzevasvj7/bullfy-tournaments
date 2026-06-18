import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface CertificateData {
  userName: string;
  courseTitle: string;
  certificateCode: string;
  issuedAt: string;
  portalName: string;
  branding: {
    primary_color: string;
    accent_color: string;
    logo_url: string | null;
    display_name_override: string | null;
  };
}

export async function generateCertificatePDF(data: CertificateData): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = 297;
  const h = 210;

  const primary = data.branding.primary_color || "#146EF5";
  const accent = data.branding.accent_color || "#83CBFF";

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, "F");

  // Border frame
  doc.setDrawColor(primary);
  doc.setLineWidth(2);
  doc.rect(10, 10, w - 20, h - 20);
  doc.setLineWidth(0.5);
  doc.rect(14, 14, w - 28, h - 28);

  // Decorative corners
  doc.setDrawColor(accent);
  doc.setLineWidth(1.5);
  const cornerLen = 20;
  // Top-left
  doc.line(10, 10, 10 + cornerLen, 10);
  doc.line(10, 10, 10, 10 + cornerLen);
  // Top-right
  doc.line(w - 10, 10, w - 10 - cornerLen, 10);
  doc.line(w - 10, 10, w - 10, 10 + cornerLen);
  // Bottom-left
  doc.line(10, h - 10, 10 + cornerLen, h - 10);
  doc.line(10, h - 10, 10, h - 10 - cornerLen);
  // Bottom-right
  doc.line(w - 10, h - 10, w - 10 - cornerLen, h - 10);
  doc.line(w - 10, h - 10, w - 10, h - 10 - cornerLen);

  // Portal logo
  let logoY = 30;
  if (data.branding.logo_url) {
    try {
      const response = await fetch(data.branding.logo_url);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      doc.addImage(base64, "PNG", w / 2 - 25, logoY, 50, 20);
      logoY = 55;
    } catch {
      logoY = 35;
    }
  }

  // Title
  doc.setTextColor(primary);
  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.text("CERTIFICADO DE FINALIZACIÓN", w / 2, logoY + 5, { align: "center" });

  // Decorative line
  doc.setDrawColor(accent);
  doc.setLineWidth(0.8);
  doc.line(w / 2 - 60, logoY + 10, w / 2 + 60, logoY + 10);

  // "Se otorga a"
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Se otorga a", w / 2, logoY + 22, { align: "center" });

  // User name
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(data.userName, w / 2, logoY + 36, { align: "center" });

  // "por completar el curso"
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("por completar exitosamente el curso", w / 2, logoY + 48, { align: "center" });

  // Course title
  doc.setTextColor(primary);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(data.courseTitle, w / 2, logoY + 60, { align: "center" });

  // Date
  const dateStr = new Date(data.issuedAt).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha de emisión: ${dateStr}`, w / 2, logoY + 75, { align: "center" });

  // Certificate code
  doc.setFontSize(8);
  doc.text(`Código de verificación: ${data.certificateCode}`, w / 2, logoY + 82, { align: "center" });

  // Portal name
  const displayName = data.branding.display_name_override || data.portalName;
  doc.setTextColor(primary);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(displayName, w / 2, logoY + 95, { align: "center" });

  // Signature line
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(w / 2 - 40, logoY + 100, w / 2 + 40, logoY + 100);
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text("Firma del administrador", w / 2, logoY + 105, { align: "center" });

  // "powered by Bullfy" footer
  doc.setTextColor(160, 160, 160);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("powered by", w / 2 - 8, h - 16, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(6, 43, 99);
  doc.text("Bullfy", w / 2 + 5, h - 16, { align: "center" });

  doc.save(`Certificado_${data.courseTitle.replace(/\s+/g, "_")}_${data.userName.replace(/\s+/g, "_")}.pdf`);
}
