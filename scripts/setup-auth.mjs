import { generateKeyPair, exportJWK, exportPKCS8 } from "jose";
import { spawnSync } from "node:child_process";
const prod = process.argv.includes("--prod");
const site = process.env.SITE_URL;
if (!site || !/^https:\/\/[a-z0-9-]+\.convex\.site$/.test(site))
  throw new Error(
    "Set SITE_URL to your deployment https://…convex.site address.",
  );
const { privateKey, publicKey } = await generateKeyPair("RS256", {
  extractable: true,
});
const jwk = await exportJWK(publicKey);
jwk.use = "sig";
const values = {
  JWT_PRIVATE_KEY: (await exportPKCS8(privateKey)).trim().replace(/\n/g, " "),
  JWKS: JSON.stringify({ keys: [jwk] }),
  SITE_URL: site,
};
for (const [name, value] of Object.entries(values)) {
  const result = spawnSync(
    "npx",
    ["convex", "env", "set", ...(prod ? ["--prod"] : []), name],
    { encoding: "utf8", input: value },
  );
  if (result.status !== 0)
    throw new Error(
      `Could not set ${name}. Check Convex CLI access. No credentials were printed.`,
    );
  console.log(`Configured ${name}.`);
}
console.log(
  "Auth keys configured. Add your Google client ID and secret in the Convex dashboard. Re-running this script rotates signing keys and signs out existing sessions.",
);
