import { authClient } from "./auth-client";

export function useSession() {
  return authClient.useSession();
}

export async function signInWithGoogle() {
  const { error } = await authClient.signIn.social({
    provider: "google",
    callbackURL: "/",
  });
  if (error) {
    throw new Error(error.message ?? "Google sign-in failed. Please try again.");
  }
}

export async function signOut() {
  await authClient.signOut();
}
