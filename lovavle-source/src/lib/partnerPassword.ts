// ============================================================================
// Hashing de contraseñas de partner_users en el navegador (QA C1).
// ----------------------------------------------------------------------------
// Mismo esquema PBKDF2 (Web Crypto) y MISMO formato que el módulo de las edge
// functions (supabase/functions/_shared/partner-password.ts):
//     pbkdf2$<iter>$<saltHex>$<hashHex>
// para que un hash creado en el cliente sea verificable por el backend (login)
// y viceversa. Se usa al registrarse desde el cliente, donde la inserción a
// partner_users la hace el rol anon directamente.
// ============================================================================

const PBKDF2_ITER = 100_000;

const toHex = (buf: ArrayBuffer | Uint8Array): string =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

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
  return `pbkdf2$${PBKDF2_ITER}$${toHex(salt)}$${toHex(bits)}`;
}
