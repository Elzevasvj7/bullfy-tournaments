// ============================================================================
// Hashing de contraseñas para partner_users (QA C1).
// ----------------------------------------------------------------------------
// Mismo esquema PBKDF2 (Web Crypto, nativo en Edge Runtime) que
// tournament-helpers.ts, con formato interoperable:  pbkdf2$<iter>$<salt>$<hash>
//
// Añade soporte de MIGRACIÓN TRANSPARENTE: las contraseñas legacy guardadas en
// texto plano se validan por comparación directa y se marcan needsRehash=true
// para re-hashearlas en el próximo login exitoso (estrategia "hash al login").
// ============================================================================

const PBKDF2_ITER = 100_000;
const SCHEME = "pbkdf2";

/** ¿El valor almacenado ya está hasheado con nuestro esquema? */
export function isHashed(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(`${SCHEME}$`);
}

/** Hashea una contraseña en claro → "pbkdf2$<iter>$<saltHex>$<hashHex>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITER, hash: "SHA-256" }, key, 256,
  );
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${SCHEME}$${PBKDF2_ITER}$${saltHex}$${hashHex}`;
}

async function verifyHashed(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, iterStr, saltHex, hashHex] = stored.split("$");
    if (scheme !== SCHEME) return false;
    const iterations = parseInt(iterStr, 10);
    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256,
    );
    const computed = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return computed === hashHex;
  } catch {
    return false;
  }
}

export interface VerifyResult {
  /** La contraseña coincide. */
  valid: boolean;
  /** El match fue contra un valor legacy en texto plano → re-hashear. */
  needsRehash: boolean;
}

/**
 * Verifica `password` contra el valor almacenado.
 *  - Si `stored` está hasheado → compara PBKDF2 (needsRehash=false).
 *  - Si `stored` es texto plano legacy → compara directo; si coincide,
 *    needsRehash=true para migrarlo en el próximo login.
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<VerifyResult> {
  if (!stored) return { valid: false, needsRehash: false };
  if (isHashed(stored)) {
    return { valid: await verifyHashed(password, stored), needsRehash: false };
  }
  // Legacy en texto plano.
  if (stored === password) return { valid: true, needsRehash: true };
  return { valid: false, needsRehash: false };
}
