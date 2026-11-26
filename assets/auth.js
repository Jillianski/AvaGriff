import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const status = document.getElementById("authStatus");
const form = document.getElementById("authForm");

if (form && status) {
  const configScript = document.createElement("script");
  configScript.src = "./assets/supabase-config.js?v=2";
  configScript.onload = initialise;
  configScript.onerror = () => { status.textContent = "Could not load the account configuration. Refresh the page and try again."; };
  document.head.append(configScript);
}

function initialise() {
  const cfg = window.AVAGRIFF_SUPABASE_CONFIG || {};
  if (!cfg.url || !cfg.publishableKey) {
    status.textContent = "Account setup is incomplete. The Supabase project URL and publishable key are required.";
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
  function setBusy(busy) {
    signIn.disabled = busy;
    signUp.disabled = busy;
    reset.disabled = busy;
    signOut.disabled = busy;
  }
  function showSession(session) {
    const signedIn = Boolean(session?.user);
    showMessage(signedIn
      ? "Signed in as " + session.user.email + "."
      : "Not signed in. Enter an email and password to sign in or create a free account.");
    signOut.style.display = signedIn ? "inline-block" : "none";
    signIn.disabled = signUp.disabled = reset.disabled = false;
  }

  client.auth.getSession().then(({ data, error }) => {
    if (error) showMessage("Could not read sign-in status. Refresh the page and try again.");
    else showSession(data.session);
  });
  client.auth.onAuthStateChange((_event, session) => showSession(session));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!email.checkValidity() || !password.checkValidity()) {
      showMessage("Enter a valid email and a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    showMessage("Signing in securely…");
    const { data, error } = await client.auth.signInWithPassword({
      email: email.value.trim(), password: password.value
    });
    setBusy(false);
    if (error) showMessage("Sign-in failed: " + error.message);
    else showSession(data.session);
  });

  signUp.addEventListener("click", async () => {
    if (!email.checkValidity() || !password.checkValidity()) {
      showMessage("Enter a valid email and a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    showMessage("Preparing a new account…");
    // A user already signed in should be signed out before switching to a different account.
    const { data: current, error: sessionError } = await client.auth.getSession();
    if (sessionError) {
      setBusy(false);
      showMessage("Could not check the current session. Please refresh and try again.");
      return;
    }
    if (current.session) {
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) {
        setBusy(false);
        showMessage("Could not sign out the current account: " + signOutError.message);
        return;
      }
    }
    showMessage("Creating your free account…");
    const { data, error } = await client.auth.signUp({
      email: email.value.trim(),
      password: password.value,
      options: { emailRedirectTo: redirectTo }
    });
    setBusy(false);
    if (error) { const detail = error.message || "Unknown error"; showMessage(/security purposes|after \d+ seconds|rate limit/i.test(detail) ? "Account creation is temporarily rate-limited by Supabase. Wait at least 20 seconds without retrying, then try once. " + detail : "Account creation failed: " + detail); }
    else if (data.session) showSession(data.session);
    else showMessage("Account request received. Check your email to confirm the new address, then sign in.");
  });

  reset.addEventListener("click", async () => {
    if (!email.checkValidity()) {
      showMessage("Enter your account email first.");
      return;
    }
    setBusy(true);
    const { error } = await client.auth.resetPasswordForEmail(email.value.trim(), { redirectTo });
    setBusy(false);
    showMessage(error ? "Password reset could not be sent: " + error.message : "If the account exists, a password reset email will arrive shortly.");
  });

  signOut.addEventListener("click", async () => {
    setBusy(true);
    showMessage("Signing out…");
    const { error } = await client.auth.signOut();
    setBusy(false);
    if (error) showMessage("Sign-out failed: " + error.message);
    else showSession(null);
  });
}
