import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const status = document.getElementById("authStatus");
const form = document.getElementById("authForm");
if (!form || !status) {
  // The auth module is loaded on every page, but the account view may be absent in an older cached shell.
} else {
  const configScript = document.createElement("script");
  configScript.src = "./assets/supabase-config.js";
  configScript.onload = initialise;
  configScript.onerror = () => { status.textContent = "Could not load the account configuration."; };
  document.head.append(configScript);
}

function initialise() {
  const cfg = window.AVAGRIFF_SUPABASE_CONFIG || {};
  if (!cfg.url || !cfg.publishableKey) {
    status.textContent = "Not connected yet. The owner must add the Supabase Project URL and publishable key. No password or customer data is sent anywhere.";
    return;
  }
  let client;
  try {
    client = createClient(cfg.url, cfg.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  } catch {
    status.textContent = "The Supabase configuration is invalid. Check the Project URL and publishable key.";
    return;
  }

  const email = document.getElementById("authEmail");
  const password = document.getElementById("authPassword");
  const signIn = document.getElementById("signInBtn");
  const signUp = document.getElementById("signUpBtn");
  const reset = document.getElementById("resetPasswordBtn");
  const signOut = document.getElementById("signOutBtn");
  const redirectTo = window.location.origin + window.location.pathname;

  function showMessage(message) { status.textContent = message; }
  function showSession(session) {
    if (session?.user) {
      showMessage("Signed in as " + session.user.email + ". Email confirmation and project security settings still apply.");
      signOut.style.display = "inline-block";
      signIn.disabled = signUp.disabled = false;
    } else {
      showMessage("Not signed in. Your personal demo data remains stored only in this browser.");
      signOut.style.display = "none";
    }
  }
  client.auth.getSession().then(({ data, error }) => {
    if (error) showMessage("Could not read sign-in status. Please try again.");
    else showSession(data.session);
  });
  client.auth.onAuthStateChange((_event, session) => showSession(session));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!email.checkValidity() || !password.checkValidity()) return;
    signIn.disabled = signUp.disabled = true;
    showMessage("Signing in securely…");
    const { data, error } = await client.auth.signInWithPassword({
      email: email.value.trim(), password: password.value
    });
    signIn.disabled = signUp.disabled = false;
    if (error) showMessage("Sign-in failed: " + error.message);
    else showSession(data.session);
  });

  signUp.addEventListener("click", async () => {
    if (!email.checkValidity() || !password.checkValidity()) {
      showMessage("Enter a valid email and a password of at least 8 characters.");
      return;
    }
    signIn.disabled = signUp.disabled = true;
    showMessage("Creating your account…");
    const { data, error } = await client.auth.signUp({
      email: email.value.trim(),
      password: password.value,
      options: { emailRedirectTo: redirectTo }
    });
    signIn.disabled = signUp.disabled = false;
    if (error) showMessage("Account creation failed: " + error.message);
    else if (data.session) showSession(data.session);
    else showMessage("Account request received. Check your email to confirm your address before signing in.");
  });

  reset.addEventListener("click", async () => {
    if (!email.checkValidity()) {
      showMessage("Enter your account email first.");
      return;
    }
    reset.disabled = true;
    const { error } = await client.auth.resetPasswordForEmail(email.value.trim(), { redirectTo });
    reset.disabled = false;
    showMessage(error ? "Password reset could not be sent: " + error.message : "If the account exists, a password reset email will arrive shortly.");
  });

  signOut.addEventListener("click", async () => {
    signOut.disabled = true;
    const { error } = await client.auth.signOut();
    signOut.disabled = false;
    showMessage(error ? "Sign-out failed. Please try again." : "You are signed out.");
  });
}
