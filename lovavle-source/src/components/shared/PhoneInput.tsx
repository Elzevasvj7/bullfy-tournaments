import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parsePhoneNumberFromString, AsYouType, type CountryCode as LibCountryCode } from "libphonenumber-js";

export interface CountryCode {
  code: string;
  dial: string;
  flag: string;
  name: string;
  minLen: number;
  maxLen: number;
}

export const COUNTRY_CODES: CountryCode[] = [
  // North America
  { code: "US", dial: "+1", flag: "🇺🇸", name: "Estados Unidos", minLen: 10, maxLen: 10 },
  { code: "CA", dial: "+1", flag: "🇨🇦", name: "Canadá", minLen: 10, maxLen: 10 },
  { code: "MX", dial: "+52", flag: "🇲🇽", name: "México", minLen: 10, maxLen: 10 },
  // Central America
  { code: "GT", dial: "+502", flag: "🇬🇹", name: "Guatemala", minLen: 8, maxLen: 8 },
  { code: "SV", dial: "+503", flag: "🇸🇻", name: "El Salvador", minLen: 8, maxLen: 8 },
  { code: "HN", dial: "+504", flag: "🇭🇳", name: "Honduras", minLen: 8, maxLen: 8 },
  { code: "NI", dial: "+505", flag: "🇳🇮", name: "Nicaragua", minLen: 8, maxLen: 8 },
  { code: "CR", dial: "+506", flag: "🇨🇷", name: "Costa Rica", minLen: 8, maxLen: 8 },
  { code: "PA", dial: "+507", flag: "🇵🇦", name: "Panamá", minLen: 7, maxLen: 8 },
  // Caribbean
  { code: "CU", dial: "+53", flag: "🇨🇺", name: "Cuba", minLen: 8, maxLen: 8 },
  { code: "DO", dial: "+1809", flag: "🇩🇴", name: "República Dominicana", minLen: 7, maxLen: 7 },
  { code: "PR", dial: "+1787", flag: "🇵🇷", name: "Puerto Rico", minLen: 7, maxLen: 7 },
  // South America
  { code: "CO", dial: "+57", flag: "🇨🇴", name: "Colombia", minLen: 10, maxLen: 10 },
  { code: "VE", dial: "+58", flag: "🇻🇪", name: "Venezuela", minLen: 10, maxLen: 10 },
  { code: "EC", dial: "+593", flag: "🇪🇨", name: "Ecuador", minLen: 9, maxLen: 9 },
  { code: "PE", dial: "+51", flag: "🇵🇪", name: "Perú", minLen: 9, maxLen: 9 },
  { code: "BO", dial: "+591", flag: "🇧🇴", name: "Bolivia", minLen: 8, maxLen: 8 },
  { code: "PY", dial: "+595", flag: "🇵🇾", name: "Paraguay", minLen: 9, maxLen: 9 },
  { code: "UY", dial: "+598", flag: "🇺🇾", name: "Uruguay", minLen: 8, maxLen: 9 },
  { code: "AR", dial: "+54", flag: "🇦🇷", name: "Argentina", minLen: 10, maxLen: 10 },
  { code: "CL", dial: "+56", flag: "🇨🇱", name: "Chile", minLen: 9, maxLen: 9 },
  { code: "BR", dial: "+55", flag: "🇧🇷", name: "Brasil", minLen: 10, maxLen: 11 },
  // Europe
  { code: "ES", dial: "+34", flag: "🇪🇸", name: "España", minLen: 9, maxLen: 9 },
  // Middle East
  { code: "AE", dial: "+971", flag: "🇦🇪", name: "Emiratos Árabes Unidos", minLen: 9, maxLen: 9 },
];

interface PhoneInputProps {
  value: string;
  countryCode: string;
  onPhoneChange: (phone: string) => void;
  onCountryChange: (code: string) => void;
  error?: string;
  disabled?: boolean;
}

export function validatePhone(localNumber: string, countryCode: string): { valid: boolean; message: string } {
  const country = COUNTRY_CODES.find(c => c.code === countryCode);
  if (!country) return { valid: false, message: "Selecciona un país" };

  const digits = localNumber.replace(/\D/g, "");
  if (!digits) return { valid: false, message: "Ingresa tu número de teléfono" };

  // Validación estricta con libphonenumber-js (evita SMS fallidos por error 21211 en Twilio)
  try {
    const fullNumber = `${country.dial}${digits}`;
    const isoCode = country.code.replace(/^1/, "") as LibCountryCode; // PR/DO usan US
    const parsed = parsePhoneNumberFromString(fullNumber, isoCode as LibCountryCode);

    if (!parsed) {
      return { valid: false, message: `Número inválido para ${country.name}` };
    }
    if (!parsed.isValid()) {
      return {
        valid: false,
        message: `Número inválido para ${country.name}. Verifica longitud y prefijo.`,
      };
    }
    // Para SMS, idealmente debe ser móvil
    const type = parsed.getType();
    if (type && type !== "MOBILE" && type !== "FIXED_LINE_OR_MOBILE") {
      return {
        valid: false,
        message: "Debe ser un número móvil para recibir SMS",
      };
    }
  } catch {
    // Fallback a validación por longitud si la librería falla
    if (digits.length < country.minLen) return { valid: false, message: `Mínimo ${country.minLen} dígitos para ${country.name}` };
    if (digits.length > country.maxLen) return { valid: false, message: `Máximo ${country.maxLen} dígitos para ${country.name}` };
  }

  return { valid: true, message: "" };
}

export function getFullPhone(localNumber: string, countryCode: string): string {
  const country = COUNTRY_CODES.find(c => c.code === countryCode);
  if (!country) return localNumber;
  const digits = localNumber.replace(/\D/g, "");
  return `${country.dial}${digits}`;
}

export function formatPhoneDisplay(localNumber: string, countryCode: string): string {
  const country = COUNTRY_CODES.find(c => c.code === countryCode);
  if (!country) return localNumber;
  try {
    const formatter = new AsYouType(country.code.replace(/^1/, "") as LibCountryCode);
    return formatter.input(`${country.dial}${localNumber}`);
  } catch {
    return localNumber;
  }
}

const PhoneInput = ({ value, countryCode, onPhoneChange, onCountryChange, error, disabled }: PhoneInputProps) => {
  const [touched, setTouched] = useState(false);

  const selectedCountry = useMemo(() => COUNTRY_CODES.find(c => c.code === countryCode), [countryCode]);

  const validation = useMemo(() => {
    if (!touched || !value) return null;
    return validatePhone(value, countryCode);
  }, [value, countryCode, touched]);

  const displayError = error || (validation && !validation.valid ? validation.message : "");

  return (
    <div className="space-y-1.5">
      <Label>Teléfono</Label>
      <div className="flex gap-2">
        <Select value={countryCode} onValueChange={onCountryChange} disabled={disabled}>
          <SelectTrigger className="w-[140px] shrink-0">
            <SelectValue>
              {selectedCountry ? `${selectedCountry.flag} ${selectedCountry.dial}` : "País"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[280px]">
            {COUNTRY_CODES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.flag} {c.dial} — {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="tel"
          value={value}
          onChange={(e) => {
            const onlyDigits = e.target.value.replace(/\D/g, "");
            const maxLen = selectedCountry?.maxLen ?? 15;
            onPhoneChange(onlyDigits.slice(0, maxLen));
          }}
          onBlur={() => setTouched(true)}
          placeholder={selectedCountry ? `${selectedCountry.minLen} dígitos` : "Número"}
          disabled={disabled}
          className="flex-1"
        />
      </div>
      {displayError && <p className="text-xs text-destructive">{displayError}</p>}
      {validation?.valid && touched && (
        <p className="text-xs text-primary">✓ Número válido</p>
      )}
    </div>
  );
};

export default PhoneInput;
