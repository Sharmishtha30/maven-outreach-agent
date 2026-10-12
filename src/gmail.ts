declare global {
  interface Window {
    google?: any;
  }
}
const scope =
  "https://www.googleapis.com/auth/gmail.compose openid https://www.googleapis.com/auth/userinfo.email";
let loading: Promise<void> | undefined;
function loadGoogle() {
  if (window.google?.accounts) return Promise.resolve();
  if (!loading)
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loading = undefined;
        reject(
          new Error("Google sign-in could not load. Check your connection."),
        );
      };
      document.head.append(s);
    });
  return loading;
}
export async function prepareGmail() {
  if (import.meta.env.VITE_GOOGLE_CLIENT_ID) await loadGoogle();
}
export function connectGmail(): Promise<{
  token: string;
  email: string;
  expiresAt: number;
}> {
  return new Promise((resolve, reject) => {
    const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!id || !window.google?.accounts) {
      reject(new Error("Gmail connection is not configured yet."));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope,
      prompt: "select_account",
      error_callback: () =>
        reject(new Error("Gmail connection was cancelled.")),
      callback: async (response: any) => {
        try {
          if (
            response.error ||
            !window.google.accounts.oauth2.hasGrantedAllScopes(
              response,
              "https://www.googleapis.com/auth/gmail.compose",
              "openid",
              "https://www.googleapis.com/auth/userinfo.email",
            )
          )
            throw new Error(
              "Allow Gmail draft access to connect your account.",
            );
          const r = await fetch(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            { headers: { Authorization: `Bearer ${response.access_token}` } },
          );
          if (!r.ok)
            throw new Error("Could not confirm the connected Gmail account.");
          const user = await r.json();
          if (!user.email_verified)
            throw new Error("Google did not verify this account.");
          resolve({
            token: response.access_token,
            email: user.email,
            expiresAt: Date.now() + Number(response.expires_in) * 1000,
          });
        } catch (e) {
          reject(e);
        }
      },
    });
    client.requestAccessToken();
  });
}
export function disconnectGmail(token: string) {
  window.google?.accounts.oauth2.revoke(token, () => {});
}
